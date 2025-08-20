import { MessageEvent, Client, ImageMessage } from '@line/bot-sdk';
import { getUserState, updateUserState } from '../services/userService';
import fs from 'fs';
import path from 'path';

export async function handleImageUpload(event: MessageEvent & { message: ImageMessage }, client: Client): Promise<void> {
  const userId = event.source.userId!;
  console.log(`📷 [handleImageUpload] 開始處理用戶 ${userId} 的圖片上傳`);
  
  const userState = getUserState(userId);
  console.log(`📷 [handleImageUpload] 用戶狀態: accessToken=${!!userState.accessToken}, memberId=${userState.memberId}`);
  
  // 檢查登入狀態 - 需要檢查 accessToken 和 memberId
  if (!userState.accessToken || !userState.memberId) {
    console.log(`📷 [handleImageUpload] 用戶未登入，發送登入提示`);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 請先登入會員帳號才能上傳處方籤\n\n請使用下方選單的「中藥預約」功能進行登入。'
    });
    return;
  }
  
  // 設置全局備用超時機制變數
  let processCompleted = false;
  let globalTimeout: NodeJS.Timeout;
  
  try {
    // 立即回覆確認訊息，讓用戶知道已收到圖片
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '📷 已收到您的處方籤\n\n⏳ 正在處理中，請稍候...'
    });
    console.log(`📷 [handleImageUpload] 已發送處理中確認訊息給用戶 ${userId}`);
    
    // 設置全局備用超時機制 (2分鐘)，確保用戶一定會收到回復
    globalTimeout = setTimeout(async () => {
      if (!processCompleted) {
        console.error(`❌ [handleImageUpload] 處理流程超時 (2分鐘)，發送備用訊息`);
        processCompleted = true;
        try {
          await client.pushMessage(userId, {
            type: 'text',
            text: '❌ 處方籤處理超時，請重新上傳。如問題持續發生，請聯絡客服。'
          });
          console.log(`❌ [handleImageUpload] 備用超時訊息已推送給用戶 ${userId}`);
        } catch (e) {
          console.error(`❌ [handleImageUpload] 推送備用超時訊息失敗:`, e);
        }
      }
    }, 120000); // 2分鐘超時
    
    // 下載圖片
    const messageId = event.message.id;
    console.log(`📷 [handleImageUpload] 開始下載圖片，messageId: ${messageId}`);
    
    let stream;
    try {
      stream = await client.getMessageContent(messageId);
      console.log(`📷 [handleImageUpload] 圖片下載 stream 已取得`);
    } catch (downloadError) {
      console.error(`❌ [handleImageUpload] 下載圖片失敗:`, downloadError);
      clearTimeout(globalTimeout);
      processCompleted = true;
      await client.pushMessage(userId, {
        type: 'text',
        text: '❌ 圖片下載失敗，請重新上傳。'
      });
      return;
    }
    
    // 判斷是否為生產環境
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // 🚀 生產環境優化：不下載圖片，直接保存 messageId 讓後台處理
      console.log(`📷 [生產環境] 跳過圖片下載，直接保存 messageId: ${messageId}`);
      
      try {
        // 重新獲取最新的用戶狀態
        const currentUserState = getUserState(userId);
        console.log(`📷 上傳後狀態檢查: accessToken=${!!currentUserState.accessToken}, memberId=${currentUserState.memberId}`);
        
        // 儲存 messageId 到用戶狀態，讓後台 API 直接下載
        const fileName = `prescription_${userId}_${Date.now()}.jpg`;
        updateUserState(userId, {
          currentStep: 'prescription_uploaded',
          tempData: {
            ...currentUserState.tempData,
            prescriptionMessageId: messageId,  // 保存 messageId 供後台使用
            prescriptionFileName: fileName,
            prescriptionFile: null,
            prescriptionBuffer: null
          }
        });
        
        console.log(`✅ 生產環境：已保存 messageId，用戶狀態已更新`);
        
        // 獲取用戶姓名
        const memberName = currentUserState.tempData?.memberInfo?.memberName || currentUserState.memberName || '';
        const greeting = memberName ? `${memberName}，` : '';
        
        console.log(`📷 準備發送回復訊息給用戶 ${userId}, greeting: "${greeting}"`);
        
        // 提示選擇藥局
        const pharmacySelectionMessage = {
          type: 'template' as const,
          altText: '處方籤上傳成功',
          template: {
            type: 'buttons' as const,
            title: '📷 處方籤上傳成功！',
            text: `${greeting}請選擇要配藥的藥局：`,
            actions: [
              {
                type: 'message' as const,
                label: '🔍 搜尋藥局',
                text: '搜尋藥局'
              },
              {
                type: 'postback' as const,
                label: '📋 查看我的訂單',
                data: 'action=view_orders'
              }
            ]
          }
        };
        
        await client.pushMessage(userId, pharmacySelectionMessage);
        clearTimeout(globalTimeout);
        processCompleted = true;
        console.log(`✅ 生產環境：處方籤處理完成訊息已成功推送給用戶 ${userId}`);
        
      } catch (saveError) {
        console.error('📷 生產環境處理處方籤發生錯誤:', saveError);
        clearTimeout(globalTimeout);
        processCompleted = true;
        try {
          await client.pushMessage(userId, {
            type: 'text',
            text: '❌ 處方籤處理失敗，請重新上傳。'
          });
          console.log(`❌ 生產環境錯誤訊息已推送給用戶 ${userId}`);
        } catch (pushError) {
          console.error('❌ 推送錯誤訊息失敗:', pushError);
        }
      }
      
    } else {
      // 🛠️ 開發環境：保持原有的下載處理邏輯
      console.log(`📷 [開發環境] 開始下載圖片進行本地處理`);
      
      // 開發環境使用 uploads 目錄
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      
      // 確保上傳目錄存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // 儲存圖片
      const fileName = `prescription_${userId}_${Date.now()}.jpg`;
      const filePath = path.join(uploadDir, fileName);
      
      const chunks: Buffer[] = [];
      console.log(`📷 [開發環境] 設置 stream 事件監聽器`);
      
      // 設置超時機制，防止 stream 處理卡住
      let streamProcessed = false;
      const streamTimeout = setTimeout(async () => {
        if (!streamProcessed && !processCompleted) {
          console.error(`❌ [開發環境] 圖片處理超時 (30秒)`);
          streamProcessed = true;
          processCompleted = true;
          clearTimeout(globalTimeout);
          try {
            await client.pushMessage(userId, {
              type: 'text',
              text: '❌ 圖片處理超時，請重新上傳。'
            });
            console.log(`❌ [開發環境] 超時錯誤訊息已推送給用戶 ${userId}`);
          } catch (e) {
            console.error(`❌ [開發環境] 推送超時錯誤訊息失敗:`, e);
          }
        }
      }, 30000); // 30 秒超時
      
      stream.on('data', (chunk) => {
        chunks.push(chunk);
        // 減少日誌頻率
        if (chunks.length === 1 || chunks.length % 5 === 0) {
          const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
          console.log(`📷 [開發環境] 下載進度: ${chunks.length} chunks, ${totalSize} bytes`);
        }
      });
      
      stream.on('end', async () => {
        console.log(`📷 [開發環境] stream 結束，處理圖片數據，共 ${chunks.length} chunks`);
        
        clearTimeout(streamTimeout);
        streamProcessed = true;
        
        if (chunks.length === 0) {
          console.error(`❌ [開發環境] 沒有收到圖片數據！`);
          clearTimeout(globalTimeout);
          processCompleted = true;
          try {
            await client.pushMessage(userId, {
              type: 'text',
              text: '❌ 圖片下載失敗，請重新上傳。'
            });
          } catch (e) {
            console.error(`❌ [開發環境] 推送錯誤訊息失敗:`, e);
          }
          return;
        }
        
        const buffer = Buffer.concat(chunks);
        console.log(`📷 [開發環境] 圖片 buffer 大小: ${buffer.length} bytes`);
        
        try {
          fs.writeFileSync(filePath, buffer);
          console.log(`📷 [開發環境] 處方籤已儲存至 ${filePath}`);
          
          const currentUserState = getUserState(userId);
          updateUserState(userId, {
            currentStep: 'prescription_uploaded',
            tempData: {
              ...currentUserState.tempData,
              prescriptionFile: filePath,
              prescriptionFileName: fileName,
              prescriptionBuffer: null,
              prescriptionMessageId: null
            }
          });
          
          console.log(`✅ [開發環境] 用戶狀態已更新`);
          
          const memberName = currentUserState.tempData?.memberInfo?.memberName || currentUserState.memberName || '';
          const greeting = memberName ? `${memberName}，` : '';
          
          const pharmacySelectionMessage = {
            type: 'template' as const,
            altText: '處方籤上傳成功',
            template: {
              type: 'buttons' as const,
              title: '📷 處方籤上傳成功！',
              text: `${greeting}請選擇要配藥的藥局：`,
              actions: [
                {
                  type: 'message' as const,
                  label: '🔍 搜尋藥局',
                  text: '搜尋藥局'
                },
                {
                  type: 'postback' as const,
                  label: '📋 查看我的訂單',
                  data: 'action=view_orders'
                }
              ]
            }
          };
          
          await client.pushMessage(userId, pharmacySelectionMessage);
          clearTimeout(globalTimeout);
          processCompleted = true;
          console.log(`✅ [開發環境] 處理完成訊息已推送給用戶 ${userId}`);
          
        } catch (saveError) {
          console.error('📷 [開發環境] 處理錯誤:', saveError);
          clearTimeout(globalTimeout);
          processCompleted = true;
          try {
            await client.pushMessage(userId, {
              type: 'text',
              text: '❌ 處方籤處理失敗，請重新上傳。'
            });
          } catch (pushError) {
            console.error('❌ 推送錯誤訊息失敗:', pushError);
          }
        }
      });
      
      // stream 錯誤處理
      stream.on('error', async (error) => {
        console.error(`❌ [開發環境] 下載圖片錯誤:`, error);
        
        clearTimeout(streamTimeout);
        clearTimeout(globalTimeout);
        streamProcessed = true;
        processCompleted = true;
        
        try {
          await client.pushMessage(userId, {
            type: 'text',
            text: '❌ 處方籤下載失敗，請稍後再試。'
          });
          console.log(`❌ [開發環境] 下載錯誤訊息已推送給用戶 ${userId}`);
        } catch (pushError) {
          console.error(`❌ [開發環境] 推送下載錯誤訊息失敗:`, pushError);
        }
      });
    }
    
  } catch (error) {
    console.error(`❌ [handleImageUpload] 處理圖片上傳發生致命錯誤:`, error);
    
    // 清除全局超時
    clearTimeout(globalTimeout);
    processCompleted = true;
    
    // 嘗試發送錯誤訊息，優先使用 replyMessage（如果還沒用過）
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 處方籤上傳失敗，請稍後再試。'
      });
      console.log(`❌ [handleImageUpload] 致命錯誤訊息已回覆給用戶 ${userId}`);
    } catch (replyError) {
      console.error(`❌ [handleImageUpload] 回覆致命錯誤訊息失敗，嘗試推送:`, replyError);
      // 如果 replyMessage 失敗，改用 pushMessage
      try {
        await client.pushMessage(userId, {
          type: 'text',
          text: '❌ 處方籤上傳失敗，請稍後再試。'
        });
        console.log(`❌ [handleImageUpload] 致命錯誤訊息已推送給用戶 ${userId}`);
      } catch (pushError) {
        console.error(`❌ [handleImageUpload] 推送致命錯誤訊息也失敗:`, pushError);
      }
    }
  }
}