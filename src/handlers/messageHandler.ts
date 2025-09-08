import { MessageEvent, Client, TextMessage, ImageMessage } from '@line/bot-sdk';
import { getUserState, ensureUserState, updateUserState, updateUserTempData, clearUserTempData, clearUserState } from '../services/userService';
import { handleLogin, createLoginMenu, handlePasswordChange } from './loginHandler';
import { handleImageUpload } from './uploadHandler';
import { handlePharmacySearch } from './pharmacyHandler';
import { handleOrderInquiry } from './orderHandler';
import { updateUserRichMenu } from '../services/menuManager';

export async function handleMessage(event: MessageEvent, client: Client): Promise<{ success: boolean; action?: string; error?: string }> {
  const userId = event.source.userId!;
  
  // 確保用戶狀態是最新的（包含 Web 登入檢查）
  await ensureUserState(userId);
  const userState = getUserState(userId);
  
  try {
    
    // 檢查是否正在處理圖片，如果是則阻止其他操作
    if (userState.currentStep === 'processing_image') {
      const processingTime = Date.now() - (userState.tempData?.processingStartTime || 0);
      const processingMinutes = Math.floor(processingTime / 60000);
      
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `⏳ 正在處理您上傳的藥單${processingMinutes > 0 ? ` (${processingMinutes}分鐘)` : ''}...\n\n請稍候，處理期間請勿進行其他操作。\n\n如果超過 2 分鐘仍未完成，您可以重新上傳藥單。`
      });
      return { success: true, action: 'blocked_during_processing' };
    }
    
    // 確保用戶有正確的選單（根據登入狀態）
    const isLoggedIn = !!(userState.accessToken && userState.memberId);
    console.log(`🎨 設置富選單: userId=${userId}, isLoggedIn=${isLoggedIn}, accessToken=${!!userState.accessToken}, memberId=${userState.memberId}`);
    await updateUserRichMenu(client, userId, isLoggedIn);
    
    // 處理文字訊息
    if (event.message.type === 'text') {
      const text = event.message.text.trim();
      
      // 檢查是否為登入流程中的步驟
      if (userState.currentStep === 'waiting_account' || userState.currentStep === 'waiting_password') {
        await handleLogin(event, client);
        return { success: true, action: 'login_process' };
      }
      
      // 檢查是否為修改密碼流程中的步驟 (開發環境)
      if (userState.currentStep === 'waiting_old_password' || userState.currentStep === 'waiting_new_password' || userState.currentStep === 'waiting_confirm_password') {
        await handlePasswordChange(event, client);
        return { success: true, action: 'password_change_process' };
      }
      
      // 主要功能選單
      switch (text) {
        case '會員登入':
        case '登入':
          await client.replyMessage(event.replyToken, createLoginMenu(userId));
          return { success: true, action: 'show_login_menu' };
          
        case '搜尋藥局':
        case '附近藥局':
          // 檢查用戶是否已登入
          if (userState.accessToken && userState.memberId) {
            // 已登入，提供搜尋藥局功能
            await handlePharmacySearch(event, client);
          } else {
            // 未登入，要求登入
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '🔒 搜尋藥局功能需要先登入會員帳號\n\n請使用下方選單中的「中藥預約」功能，系統會引導您登入並搜尋藥局。'
            });
          }
          return { success: true, action: 'pharmacy_search' };
          
        case '我的訂單':
        case '訂單查詢':
          // 檢查用戶是否已登入
          if (userState.accessToken && userState.memberId) {
            // 已登入，提供訂單查詢功能
            await handleOrderInquiry(event, client);
          } else {
            // 未登入，要求登入
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '🔒 訂單查詢功能需要先登入會員帳號\n\n請使用下方選單中的「中藥預約」功能進行登入。'
            });
          }
          return { success: true, action: 'order_inquiry' };
          
        case '主選單':
        case '選單':
        case '功能':
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '📋 請使用下方的圖文選單來操作各項功能：\n\n🔓 開放功能：\n• 藥師諮詢\n• 中藥新知\n• 使用教學\n\n🔒 會員功能：\n• 中藥預約（需登入）'
          });
          return { success: true, action: 'show_main_menu' };
          
        case '狀態':
        case '登入狀態':
          if (userState.accessToken && userState.memberId) {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `🔑 登入狀態: ✅ 已登入\n會員名稱: ${userState.memberName || '未知'}\n會員編號: ${userState.memberId}\n\n您可以使用下方選單的所有功能。`
            });
          } else {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '🔑 登入狀態: ❌ 未登入\n\n請使用下方選單的「中藥預約」功能進行登入，或直接輸入「登入」來顯示登入選單。'
            });
          }
          return { success: true, action: 'check_status' };
          
        case '登出':
        case 'logout':
          clearUserState(userId);
          await updateUserRichMenu(client, userId, false);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '👋 已確保為訪客模式\n\n如需登入，請使用下方選單的「中藥預約」功能。'
          });
          return { success: true, action: 'logout' };
          
        case '說明':
        case 'help':
        case '幫助':
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '📖 使用說明\n\n🔸 請使用下方的圖文選單操作\n🔸 中藥預約需要先登入會員\n🔸 藥師諮詢、中藥新知等為開放功能\n🔸 如有問題，請直接詢問我們的客服人員'
          });
          return { success: true, action: 'show_help' };
          
        default:
          // 處理其他文字訊息（可能是藥師諮詢或一般問題）
          await handleGeneralMessage(event, client, text);
          return { success: true, action: 'general_message' };
      }
    } else if (event.message.type === 'image') {
      // 處理圖片上傳 - 檢查是否已登入
      console.log(`📷 收到圖片訊息，用戶登入狀態檢查: accessToken=${!!userState.accessToken}, memberId=${userState.memberId}`);
      
      if (userState.accessToken && userState.memberId) {
        console.log(`📷 用戶已登入，開始處理藥單上傳`);
        await handleImageUpload(event as MessageEvent & { message: any }, client);
        return { success: true, action: 'prescription_upload' };
      } else {
        console.log(`📷 用戶未登入，提示登入訊息`);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '📷 收到您的圖片！\n\n如果您想要上傳藥單，請先使用「中藥預約」功能並登入會員。'
        });
        return { success: true, action: 'image_received_not_logged_in' };
      }
    }
    
    return { success: true, action: 'message_processed' };
    
  } catch (error) {
    console.error('❌ 訊息處理錯誤:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'message_error'
    };
  }
}

// 處理一般訊息（藥師諮詢等）
async function handleGeneralMessage(event: MessageEvent, client: Client, messageText: string): Promise<void> {
  // 簡單的關鍵字回應
  if (messageText.includes('中藥') || messageText.includes('藥材') || messageText.includes('藥效')) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '👨‍⚕️ 感謝您的詢問！\n\n您的問題我們已經收到，我們的專業藥師會盡快為您解答。\n\n如需更詳細的諮詢，建議您使用下方選單的「藥師諮詢」功能，我們會提供更完整的服務。'
    });
  } else {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🤖 感謝您的訊息！\n\n如果您有中藥相關問題，請使用下方選單的「藥師諮詢」功能。\n如果想要預約中藥服務，請使用「中藥預約」功能。\n\n我們將竭誠為您服務！'
    });
  }
}
