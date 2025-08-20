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
  
  try {
    // 下載圖片
    const messageId = event.message.id;
    console.log(`📷 [handleImageUpload] 開始下載圖片，messageId: ${messageId}`);
    const stream = await client.getMessageContent(messageId);
    console.log(`📷 [handleImageUpload] 圖片下載 stream 已取得`);
    
    // 判斷是否為生產環境
    const isProduction = process.env.NODE_ENV === 'production';
    
    // 生產環境使用 /tmp 目錄，開發環境使用 uploads 目錄
    const uploadDir = isProduction ? '/tmp' : (process.env.UPLOAD_DIR || 'uploads');
    
    // 確保上傳目錄存在（僅開發環境需要）
    if (!isProduction && !fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 儲存圖片
    const fileName = `prescription_${userId}_${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, fileName);
    
    const chunks: Buffer[] = [];
    console.log(`📷 [handleImageUpload] 設置 stream 事件監聽器`);
    
    // 設置超時機制，防止 stream 處理卡住
    let streamProcessed = false;
    const streamTimeout = setTimeout(async () => {
      if (!streamProcessed) {
        console.error(`❌ [handleImageUpload] 圖片處理超時 (30秒)`);
        streamProcessed = true; // 防止重複處理
        try {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ 圖片處理超時，請重新上傳。'
          });
          console.log(`❌ [handleImageUpload] 超時錯誤訊息已發送給用戶 ${userId}`);
        } catch (e) {
          console.error(`❌ [handleImageUpload] 發送超時錯誤訊息失敗:`, e);
        }
      }
    }, 30000); // 30 秒超時
    
    stream.on('data', (chunk) => {
      chunks.push(chunk);
      console.log(`📷 [handleImageUpload] 收到 data chunk，大小: ${chunk.length}, 總 chunks: ${chunks.length}`);
    });
    
    stream.on('end', async () => {
      console.log(`📷 [handleImageUpload] stream 結束，開始處理圖片數據，共 ${chunks.length} 個 chunks`);
      
      // 清除超時並標記為已處理
      clearTimeout(streamTimeout);
      streamProcessed = true;
      
      if (chunks.length === 0) {
        console.error(`❌ [handleImageUpload] 沒有收到圖片數據！`);
        try {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ 圖片下載失敗，請重新上傳。'
          });
        } catch (e) {
          console.error(`❌ [handleImageUpload] 發送錯誤訊息失敗:`, e);
        }
        return;
      }
      
      const buffer = Buffer.concat(chunks);
      console.log(`📷 [handleImageUpload] 圖片 buffer 大小: ${buffer.length} bytes`);
      
      let replyMessageSent = false; // 標記是否已發送回復
      
      try {
        // 在生產環境中，也嘗試保存到 /tmp，但主要依賴 buffer
        if (isProduction) {
          console.log(`📷 生產環境：處理處方籤 buffer (${buffer.length} bytes)`);
        } else {
          fs.writeFileSync(filePath, buffer);
          console.log(`📷 開發環境：處方籤已儲存至 ${filePath}`);
        }
        
        // 重新獲取最新的用戶狀態
        const currentUserState = getUserState(userId);
        console.log(`📷 上傳後狀態檢查: accessToken=${!!currentUserState.accessToken}, memberId=${currentUserState.memberId}`);
        
        // 儲存檔案資訊到用戶狀態，生產環境保存 buffer，開發環境保存路徑
        updateUserState(userId, {
          currentStep: 'prescription_uploaded',
          tempData: {
            ...currentUserState.tempData,
            prescriptionFile: isProduction ? null : filePath,
            prescriptionFileName: fileName,
            prescriptionBuffer: isProduction ? buffer.toString('base64') : null
          }
        });
        
        console.log(`✅ 用戶狀態已更新 - 處方籤上傳完成 (${isProduction ? '生產模式' : '開發模式'})`);
        
        // 獲取用戶姓名
        const memberName = currentUserState.tempData?.memberInfo?.memberName || currentUserState.memberName || '';
        const greeting = memberName ? `${memberName}，` : '';
        
        console.log(`📷 準備發送回復訊息給用戶 ${userId}, greeting: "${greeting}"`);
        
        // 提示選擇藥局
        const replyMessage = {
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
        
        await client.replyMessage(event.replyToken, replyMessage);
        replyMessageSent = true;
        console.log(`✅ 回復訊息已成功發送給用戶 ${userId}`);
        
      } catch (saveError) {
        console.error('📷 處理處方籤過程中發生錯誤:', saveError);
        console.error('錯誤詳細資訊:', saveError?.stack);
        
        // 如果還沒發送回復，發送錯誤訊息
        if (!replyMessageSent) {
          try {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '❌ 處方籤上傳失敗，請稍後再試。'
            });
            console.log(`❌ 錯誤回復訊息已發送給用戶 ${userId}`);
          } catch (replyError) {
            console.error('❌ 發送錯誤回復訊息也失敗:', replyError);
            // 嘗試用 push 訊息作為備案
            try {
              await client.pushMessage(userId, {
                type: 'text',
                text: '❌ 處方籤上傳失敗，請稍後再試。'
              });
              console.log(`❌ 錯誤訊息已透過 push 發送給用戶 ${userId}`);
            } catch (pushError) {
              console.error('❌ push 訊息也失敗:', pushError);
            }
          }
        }
      }
    });
    
    stream.on('error', async (error) => {
      console.error(`❌ [handleImageUpload] 下載圖片錯誤:`, error);
      
      // 清除超時並標記為已處理
      clearTimeout(streamTimeout);
      streamProcessed = true;
      
      try {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ 處方籤下載失敗，請稍後再試。'
        });
        console.log(`❌ [handleImageUpload] 下載錯誤訊息已發送給用戶 ${userId}`);
      } catch (replyError) {
        console.error(`❌ [handleImageUpload] 發送下載錯誤訊息失敗:`, replyError);
        // 嘗試 push 訊息
        try {
          await client.pushMessage(userId, {
            type: 'text',
            text: '❌ 處方籤下載失敗，請稍後再試。'
          });
          console.log(`❌ [handleImageUpload] 下載錯誤訊息已透過 push 發送給用戶 ${userId}`);
        } catch (pushError) {
          console.error(`❌ [handleImageUpload] push 下載錯誤訊息也失敗:`, pushError);
        }
      }
    });
    
  } catch (error) {
    console.error('處理圖片上傳錯誤:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 處方籤上傳失敗，請稍後再試。'
    });
  }
}