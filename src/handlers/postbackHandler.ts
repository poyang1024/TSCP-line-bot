import { PostbackEvent, Client } from '@line/bot-sdk';
import { getUserState, updateUserState } from '../services/userService';
import { createOrder, getOrderDetail } from '../services/apiService';
import { createOrderDetailCard, createPharmacyCarousel, createPharmacyPaginationButtons } from '../templates/messageTemplates';
import { handleOrderInquiry } from './orderHandler';
import { handleLoginPostback } from './loginHandler';
import { handleRichMenuPostback } from './richMenuHandler';
import { handlePharmacyPageNavigation } from './pharmacyHandler';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// 即時下載圖片函數
async function downloadImageImmediately(client: Client, messageId: string): Promise<Buffer> {
  const stream = await client.getMessageContent(messageId);
  const chunks: Buffer[] = [];
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

export async function handlePostback(event: PostbackEvent, client: Client): Promise<{ success: boolean; action?: string; error?: string }> {
  const userId = event.source.userId!;
  const userState = getUserState(userId);
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');
  
  // 檢查是否為重新投遞事件
  if ('deliveryContext' in event && event.deliveryContext?.isRedelivery) {
    console.log('🔄 檢測到重新投遞事件，使用 pushMessage 回應');
    
    // 對於重新投遞事件，直接使用 pushMessage 而不是 replyMessage
    try {
      await client.pushMessage(userId, {
        type: 'text',
        text: '⚠️ 檢測到重複請求，請避免快速點擊按鈕。\n\n如需協助，請稍候再試。'
      });
    } catch (pushError) {
      console.error('❌ 推送重新投遞提醒失敗:', pushError);
    }
    
    return { success: true, action: 'redelivery_handled' };
  }
  
  try {
    // 檢查是否正在處理圖片，如果是則阻止其他操作
    if (userState.currentStep === 'processing_image') {
      const processingTime = Date.now() - (userState.tempData?.processingStartTime || 0);
      const processingMinutes = Math.floor(processingTime / 60000);
      
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `⏳ 正在處理您上傳的藥單${processingMinutes > 0 ? ` (${processingMinutes}分鐘)` : ''}...\n\n請稍候，處理期間請勿點選按鈕。\n\n如果超過 2 分鐘仍未完成，您可以重新上傳藥單。`
      });
      return { success: true, action: 'blocked_during_processing' };
    }
    
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
      case 'line_direct_login':
        await handleLoginPostback(event, client);
        return { success: true, action: action };
        
      case 'select_pharmacy':
        await handlePharmacySelection(event, client, data);
        return { success: true, action: 'select_pharmacy' };
        
      case 'pharmacy_page':
        await handlePharmacyPageNavigation(event, client, data);
        return { success: true, action: 'pharmacy_page' };
        
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
    
    // 嘗試發送錯誤訊息，但要處理 replyToken 可能已被使用的情況
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 處理請求時發生錯誤，請稍後再試。'
      });
    } catch (replyError) {
      console.error('❌ 回覆錯誤訊息失敗:', replyError);
      
      // 如果 replyMessage 失敗（可能是 replyToken 已被使用），嘗試使用 pushMessage
      if (replyError instanceof Error && replyError.message.includes('400')) {
        console.log('🔄 replyToken 已被使用，改用 pushMessage 發送錯誤訊息');
        try {
          await client.pushMessage(event.source.userId!, {
            type: 'text',
            text: '❌ 處理請求時發生錯誤，請稍後再試。'
          });
        } catch (pushError) {
          console.error('❌ pushMessage 也失敗:', pushError);
        }
      }
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
  
  // 檢查是否有上傳的藥單（統一使用檔案路徑檢查）
  const isProduction = process.env.NODE_ENV === 'production';
  const hasPrescription = !!userState.tempData?.prescriptionFile;
  
  console.log(`🏥 用戶狀態檢查:`, {
    currentStep: userState.currentStep,
    isProduction,
    hasFile: !!userState.tempData?.prescriptionFile,
    fileName: userState.tempData?.prescriptionFileName,
    hasPrescription
  });
  
  if (userState.currentStep !== 'prescription_uploaded' || !hasPrescription) {
    console.log(`❌ 用戶狀態檢查失敗 - 缺少藥單資料`);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '📷 請先上傳藥單照片，然後再選擇藥局。'
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
          label: '🚚 外送到府 （功能即將開放）',
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
  
  // 檢查外送功能是否可用
  if (isDelivery) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🚚 外送到府功能即將開放！\n\n目前僅提供到店自取服務，請選擇到店自取選項。\n\n感謝您的耐心等候。'
    });
    return;
  }
  
  // 檢查是否有藥單資料（統一使用檔案路徑檢查）
  const isProduction = process.env.NODE_ENV === 'production';
  const hasPrescription = !!userState.tempData?.prescriptionFile;
  
  if (!userState.accessToken || !hasPrescription) {
    console.error('❌ 訂單資訊不完整:', {
      hasToken: !!userState.accessToken,
      hasFile: !!userState.tempData?.prescriptionFile,
      fileName: userState.tempData?.prescriptionFileName,
      hasPrescription,
      isProduction,
      userState: userState
    });
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 訂單資訊不完整，請重新上傳藥單並選擇藥局。'
    });
    return;
  }
  
  try {
    // 準備訂單資料
    const formData = new FormData();
    formData.append('area_id', pharmacyId!);
    formData.append('is_delivery', isDelivery ? '1' : '0');
    
    // 如果是外送，使用會員資訊或設定預設值
    if (isDelivery) {
      // 優先使用會員的個人資訊
      const memberInfo = userState.tempData?.memberPersonalInfo;
      const memberPhone = memberInfo?.phone;
      const memberAddress = memberInfo?.address;
      
      // 使用會員電話，若無則使用預設值
      const phone = memberPhone && memberPhone.trim() !== '' 
        ? memberPhone 
        : '請聯繫藥局確認聯絡電話';
      
      // 使用會員地址，若無則使用預設值
      const address = memberAddress && memberAddress.trim() !== '' 
        ? memberAddress 
        : '請聯繫藥局確認配送地址';
      
      formData.append('address', address);
      formData.append('phone', phone);
      
      console.log('📍 使用配送資訊:', { 
        phone: phone === memberPhone ? '會員電話' : '預設值',
        address: address === memberAddress ? '會員地址' : '預設值'
      });
    }
    
    // 準備藥單檔案 - 檢查是否為臨時檔案需要即時下載
    let fileBuffer: Buffer;
    
    if (!userState.tempData.prescriptionFile) {
      console.error(`❌ 藥單檔案路徑不存在`);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 藥單檔案遺失，請重新上傳。'
      });
      return;
    }
    
    try {
      // 檢查是否為臨時路徑，需要即時下載
      if (userState.tempData.prescriptionFile.includes('temp_')) {
        console.log(`📷 檢測到臨時檔案，開始即時下載 - ${userId}`);
        
        const messageId = userState.tempData.messageId;
        if (!messageId) {
          console.error(`❌ 臨時檔案缺少 messageId`);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ 藥單檔案資訊不完整，請重新上傳。'
          });
          return;
        }
        
        // 即時下載圖片
        fileBuffer = await downloadImageImmediately(client, messageId);
        console.log(`📤 即時下載完成，檔案大小: ${fileBuffer.length} bytes`);
        
        // 更新用戶狀態為實際檔案路徑（可選，但不影響當前流程）
        const fileName = userState.tempData.prescriptionFileName || `prescription_${userId}_${Date.now()}.jpg`;
        const uploadDir = isProduction ? '/tmp' : (process.env.UPLOAD_DIR || 'uploads');
        const actualPath = path.join(uploadDir, fileName);
        
        updateUserState(userId, {
          currentStep: userState.currentStep,
          tempData: {
            ...userState.tempData,
            prescriptionFile: actualPath
          }
        });
        
      } else {
        // 從實際檔案讀取
        if (!fs.existsSync(userState.tempData.prescriptionFile)) {
          console.error(`❌ 藥單檔案不存在:`, userState.tempData.prescriptionFile);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ 藥單檔案遺失，請重新上傳。'
          });
          return;
        }
        
        fileBuffer = fs.readFileSync(userState.tempData.prescriptionFile);
        console.log(`📤 從檔案讀取藥單 (${fileBuffer.length} bytes)`);
      }
      
    } catch (readError) {
      console.error('❌ 讀取藥單檔案失敗:', readError);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 讀取藥單檔案失敗，請重新上傳。'
      });
      return;
    }
    
    // 上傳藥單檔案
    formData.append('files[]', fileBuffer, {
      filename: userState.tempData.prescriptionFileName || 'prescription.jpg',
      contentType: 'image/jpeg'
    });
    
    console.log(`📤 準備傳送訂單資料... (${isProduction ? '生產模式 (buffer)' : '開發模式 (file)'})`);
    
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