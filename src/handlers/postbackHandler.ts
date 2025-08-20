import { PostbackEvent, Client } from '@line/bot-sdk';
import { getUserState, updateUserState } from '../services/userService';
import { createOrder, getOrderDetail } from '../services/apiService';
import { createOrderDetailCard } from '../templates/messageTemplates';
import { handleOrderInquiry } from './orderHandler';
import { handleLoginPostback } from './loginHandler';
import { handleRichMenuPostback } from './richMenuHandler';
import FormData from 'form-data';
import fs from 'fs';

export async function handlePostback(event: PostbackEvent, client: Client): Promise<{ success: boolean; action?: string; error?: string }> {
  const userId = event.source.userId!;
  const userState = getUserState(userId);
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');
  
  try {
    // 檢查是否為圖文選單的 postback
    const richMenuActions = [
      'login_required', 'create_order', 'pharmacist_consultation',
      'herbal_news', 'tutorial', 'member_center', 'view_orders', 'pharmacy_search', 'logout'
    ];
    
    if (richMenuActions.includes(action || '')) {
      await handleRichMenuPostback(event, client);
      return { success: true, action: action || 'rich_menu' };
    }
    
    switch (action) {
      case 'account_login':
        await handleLoginPostback(event, client);
        return { success: true, action: 'account_login' };
        
      case 'select_pharmacy':
        await handlePharmacySelection(event, client, data);
        return { success: true, action: 'select_pharmacy' };
        
      case 'view_order_detail':
        await handleViewOrderDetail(event, client, data);
        return { success: true, action: 'view_order_detail' };
        
      case 'view_orders':
        // 重新使用訂單查詢處理器
        const mockEvent = {
          ...event,
          type: 'message' as const,
          message: { 
            type: 'text' as const, 
            text: '我的訂單',
            id: 'mock-message-id',
            quoteToken: 'mock-quote-token'
          }
        };
        await handleOrderInquiry(mockEvent, client);
        return { success: true, action: 'view_orders' };
        
      case 'confirm_order':
        await handleOrderConfirmation(event, client, data);
        return { success: true, action: 'confirm_order' };
        
      default:
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '❓ 未知的操作，請重新選擇。'
        });
        return { success: true, action: 'unknown_action' };
    }
  } catch (error) {
    console.error('❌ Postback 處理錯誤:', error);
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 處理請求時發生錯誤，請稍後再試。'
      });
    } catch (replyError) {
      console.error('❌ 回覆錯誤訊息失敗:', replyError);
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function handlePharmacySelection(event: PostbackEvent, client: Client, data: URLSearchParams): Promise<void> {
  const userId = event.source.userId!;
  const userState = getUserState(userId);
  const pharmacyId = data.get('pharmacy_id');
  
  console.log(`🏥 用戶 ${userId} 選擇藥局 ${pharmacyId}`);
  
  if (!userState.accessToken) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 請先登入會員帳號'
    });
    return;
  }
  
  // 檢查是否有上傳的處方籤（生產環境檢查 buffer，開發環境檢查檔案）
  const isProduction = process.env.NODE_ENV === 'production';
  const hasPrescription = isProduction 
    ? !!userState.tempData?.prescriptionBuffer 
    : !!userState.tempData?.prescriptionFile;
  
  console.log(`🏥 用戶狀態檢查:`, {
    currentStep: userState.currentStep,
    isProduction,
    hasFile: !!userState.tempData?.prescriptionFile,
    hasBuffer: !!userState.tempData?.prescriptionBuffer,
    hasPrescription
  });
  
  if (userState.currentStep !== 'prescription_uploaded' || !hasPrescription) {
    console.log(`❌ 用戶狀態檢查失敗 - 缺少處方籤資料`);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '📷 請先上傳處方籤照片，然後再選擇藥局。'
    });
    return;
  }
  
  // 儲存選擇的藥局
  updateUserState(userId, {
    currentStep: 'pharmacy_selected',
    tempData: {
      ...userState.tempData,
      selectedPharmacyId: pharmacyId
    }
  });
  
  console.log(`✅ 已儲存藥局選擇: ${pharmacyId}`);
  
  // 詢問取藥方式
  await client.replyMessage(event.replyToken, {
    type: 'template',
    altText: '選擇取藥方式',
    template: {
      type: 'buttons',
      title: '🏥 藥局選擇完成',
      text: '請選擇取藥方式：',
      actions: [
        {
          type: 'postback',
          label: '🏪 到店自取',
          data: `action=confirm_order&delivery=false&pharmacy_id=${pharmacyId}`
        },
        {
          type: 'postback',
          label: '🚚 外送到府',
          data: `action=confirm_order&delivery=true&pharmacy_id=${pharmacyId}`
        }
      ]
    }
  });
}

async function handleOrderConfirmation(event: PostbackEvent, client: Client, data: URLSearchParams): Promise<void> {
  const userId = event.source.userId!;
  const userState = getUserState(userId);
  const pharmacyId = data.get('pharmacy_id');
  const isDelivery = data.get('delivery') === 'true';
  
  console.log(`📋 開始建立訂單 - User: ${userId}, Pharmacy: ${pharmacyId}, Delivery: ${isDelivery}`);
  
  // 檢查是否有處方籤資料（生產環境檢查 buffer，開發環境檢查檔案）
  const isProduction = process.env.NODE_ENV === 'production';
  const hasPrescription = isProduction 
    ? !!userState.tempData?.prescriptionBuffer 
    : !!userState.tempData?.prescriptionFile;
  
  if (!userState.accessToken || !hasPrescription) {
    console.error('❌ 訂單資訊不完整:', {
      hasToken: !!userState.accessToken,
      hasFile: !!userState.tempData?.prescriptionFile,
      hasBuffer: !!userState.tempData?.prescriptionBuffer,
      hasPrescription,
      isProduction,
      userState: userState
    });
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 訂單資訊不完整，請重新上傳處方籤並選擇藥局。'
    });
    return;
  }
  
  try {
    // 生產環境變數已在上面定義，直接使用
    
    let fileBuffer: Buffer;
    
    if (isProduction) {
      // 生產環境：從 base64 字串還原 buffer
      if (!userState.tempData.prescriptionBuffer) {
        console.error('❌ 生產環境：處方籤 buffer 不存在');
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ 處方籤檔案遺失，請重新上傳。'
        });
        return;
      }
      fileBuffer = Buffer.from(userState.tempData.prescriptionBuffer, 'base64');
      console.log(`📤 生產環境：從 buffer 讀取處方籤 (${fileBuffer.length} bytes)`);
    } else {
      // 開發環境：從檔案系統讀取
      if (!userState.tempData.prescriptionFile || !fs.existsSync(userState.tempData.prescriptionFile)) {
        console.error('❌ 開發環境：處方籤檔案不存在:', userState.tempData.prescriptionFile);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ 處方籤檔案遺失，請重新上傳。'
        });
        return;
      }
      fileBuffer = fs.readFileSync(userState.tempData.prescriptionFile);
      console.log(`📤 開發環境：從檔案讀取處方籤 (${fileBuffer.length} bytes)`);
    }
    
    // 準備訂單資料
    const formData = new FormData();
    formData.append('area_id', pharmacyId!);
    formData.append('is_delivery', isDelivery ? '1' : '0');
    
    // 如果是外送，設定預設值或提示用戶輸入
    if (isDelivery) {
      // 這裡可以加入地址收集流程，暫時使用預設值
      formData.append('address', '請聯繫藥局確認配送地址');
      formData.append('phone', '請聯繫藥局確認聯絡電話');
    }
    
    // 上傳處方籤檔案
    formData.append('files[]', fileBuffer, {
      filename: userState.tempData.prescriptionFileName || 'prescription.jpg',
      contentType: 'image/jpeg'
    });
    
    console.log(`📤 準備傳送訂單資料... (${isProduction ? '生產模式' : '開發模式'})`);
    
    // 建立訂單
    const order = await createOrder(userState.accessToken, formData);
    
    if (order) {
      console.log('✅ 訂單建立成功:', order);
      
      // 清除暫存資料
      updateUserState(userId, {
        currentStep: undefined,
        tempData: undefined
      });
      
      // 刪除暫存檔案
      try {
        fs.unlinkSync(userState.tempData.prescriptionFile);
        console.log('🗑️ 已刪除暫存檔案');
      } catch (error) {
        console.error('❌ 刪除暫存檔案失敗:', error);
      }
      
      // 根據是否有詳細訂單資料來決定回應內容
      const successMessage = {
        type: 'text' as const,
        text: `🎉 訂單建立成功！\n\n📋 訂單編號：${order.order_code || '系統產生中'}\n🏥 配藥藥局：${order.area_name || '選定藥局'}\n🚚 取藥方式：${isDelivery ? '外送到府' : '到店自取'}\n\n藥局會盡快處理您的訂單，請耐心等候。`
      };
      
      // 如果有完整的訂單資料，就顯示詳細卡片；否則只顯示成功訊息
      if (order.order_code && order.order_code !== '系統產生中') {
        await client.replyMessage(event.replyToken, [
          successMessage,
          createOrderDetailCard(order)
        ]);
      } else {
        await client.replyMessage(event.replyToken, [
          successMessage,
          {
            type: 'text',
            text: '📋 您可以稍後輸入「我的訂單」查看詳細的訂單資訊。'
          }
        ]);
      }
      
    } else {
      console.error('❌ 訂單建立失敗 - API 回傳失敗');
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 訂單建立失敗，請檢查網路連線後稍後再試。'
      });
    }
    
  } catch (error) {
    console.error('❌ 建立訂單錯誤:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `❌ 訂單建立失敗：${error instanceof Error ? error.message : '未知錯誤'}，請稍後再試。`
    });
  }
}

async function handleViewOrderDetail(event: PostbackEvent, client: Client, data: URLSearchParams): Promise<void> {
  const userId = event.source.userId!;
  const userState = getUserState(userId);
  const orderId = data.get('order_id');
  
  if (!userState.accessToken || !orderId) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 無法查看訂單詳情'
    });
    return;
  }
  
  try {
    const order = await getOrderDetail(userState.accessToken, parseInt(orderId));
    
    if (order) {
      let detailText = `📋 訂單詳情\n\n`;
      detailText += `🆔 訂單編號：${order.order_code}\n`;
      detailText += `🏥 藥局：${order.area_name}\n`;
      detailText += `📊 狀態：${getOrderStateText(order.state)}\n`;
      detailText += `🚚 取藥方式：${order.is_delivery ? '外送到府' : '到店自取'}\n`;
      
      if (order.hospital) {
        detailText += `🏥 醫療院所：${order.hospital}\n`;
      }
      if (order.department) {
        detailText += `🏥 科別：${order.department}\n`;
      }
      if (order.phone) {
        detailText += `📞 聯絡電話：${order.phone}\n`;
      }
      if (order.address) {
        detailText += `📍 地址：${order.address}\n`;
      }
      if (order.remark) {
        detailText += `📝 備註：${order.remark}\n`;
      }
      if (order.confirmation_code) {
        detailText += `🔑 確認碼：${order.confirmation_code}\n`;
      }
      
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: detailText
      });
      
    } else {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 找不到訂單資訊'
      });
    }
    
  } catch (error) {
    console.error('查看訂單詳情錯誤:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 查看訂單詳情時發生錯誤'
    });
  }
}

function getOrderStateText(state: number): string {
  switch (state) {
    case 0: return '📥 已收單';
    case 1: return '📝 需補單';
    case 2: return '❌ 已拒單';
    case 3: return '⏰ 已排單';
    case 4: return '🚫 已取消';
    case 5: return '✅ 已完成';
    default: return '❓ 未知狀態';
  }
}