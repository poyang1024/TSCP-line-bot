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
      text: '❌ 請先登入會員帳號才能上傳藥單\n\n請使用下方選單的「中藥預約」功能進行登入。'
    });
    return;
  }
  
  // 檢查是否正在處理中，防止重複上傳
  if (userState.currentStep === 'processing_image') {
    console.log(`📷 [handleImageUpload] 用戶正在處理中，忽略重複請求`);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '⏳ 正在處理您之前上傳的藥單，請稍候...\n\n如需上傳新的藥單，請等待當前處理完成。'
    });
    return;
  }
  
  // 立即回覆確認訊息並設置狀態
  const messageId = event.message.id;
  const fileName = `prescription_${userId}_${Date.now()}.jpg`;
  
  // 立即設置上傳完成狀態，不等待實際下載
  const currentUserState = getUserState(userId);
  updateUserState(userId, {
    currentStep: 'prescription_uploaded',
    tempData: {
      ...currentUserState.tempData,
      prescriptionFile: `temp_${messageId}`, // 臨時路徑，實際下載在背景進行
      prescriptionFileName: fileName,
      prescriptionBuffer: null,
      messageId: messageId, // 儲存 messageId 供後續使用
      processingStartTime: undefined
    }
  });
  
  const memberName = currentUserState.tempData?.memberInfo?.memberName || currentUserState.memberName || '';
  const greeting = memberName ? `${memberName}，` : '';
  
  console.log(`✅ 立即設置藥單上傳完成狀態 - ${userId}`);
  
  try {
    // 立即回覆成功訊息並提供選項
    const pharmacySelectionMessage = {
      type: 'template' as const,
      altText: '藥單接收成功',
      template: {
        type: 'buttons' as const,
        title: '✅ 藥單接收成功！',
        text: `${greeting}已收到您的藥單，請選擇要配藥的藥局：`,
        actions: [
          {
            type: 'message' as const,
            label: '🔍 搜尋藥局',
            text: '搜尋藥局'
          }
        ]
      }
    };
    
    await client.replyMessage(event.replyToken, pharmacySelectionMessage);
    console.log(`✅ 藥單接收成功訊息已發送給用戶 ${userId}`);
    
    // 背景下載圖片（不阻塞用戶操作）
    downloadImageInBackground(client, userId, messageId, fileName);
  } catch (error) {
    console.error(`❌ [handleImageUpload] 發送成功訊息失敗:`, error);
    
    // 如果發送失敗，嘗試發送簡單文字訊息
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '✅ 已收到您的藥單！請使用「搜尋藥局」功能選擇藥局。'
      });
    } catch (fallbackError) {
      console.error(`❌ [handleImageUpload] 發送備用訊息也失敗:`, fallbackError);
    }
  }
}

// 背景下載圖片（非阻塞）
async function downloadImageInBackground(client: Client, userId: string, messageId: string, fileName: string): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const uploadDir = isProduction ? '/tmp' : (process.env.UPLOAD_DIR || 'uploads');
  const filePath = path.join(uploadDir, fileName);
  
  try {
    console.log(`📷 [背景下載] 開始背景下載圖片 - ${userId}`);
    
    // 確保上傳目錄存在（僅開發環境需要）
    if (!isProduction && !fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 下載圖片
    const stream = await client.getMessageContent(messageId);
    const chunks: Buffer[] = [];
    
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        console.log(`📷 [背景下載] 圖片下載完成，大小: ${buffer.length} bytes - ${userId}`);
        
        // 異步儲存檔案
        fs.writeFile(filePath, buffer, (err) => {
          if (err) {
            console.error(`❌ [背景下載] 儲存檔案失敗:`, err);
          } else {
            console.log(`📷 [背景下載] 檔案儲存成功: ${filePath}`);
            
            // 更新用戶狀態，將臨時路徑改為實際路徑
            const userState = getUserState(userId);
            if (userState.tempData?.prescriptionFile?.includes('temp_')) {
              updateUserState(userId, {
                currentStep: userState.currentStep,
                tempData: {
                  ...userState.tempData,
                  prescriptionFile: filePath // 更新為實際檔案路徑
                }
              });
              console.log(`✅ [背景下載] 用戶狀態已更新為實際檔案路徑 - ${userId}`);
            }
          }
        });
      } catch (saveError) {
        console.error(`❌ [背景下載] 處理檔案錯誤:`, saveError);
      }
    });
    
    stream.on('error', (error) => {
      console.error(`❌ [背景下載] 下載圖片錯誤:`, error);
    });
    
  } catch (error) {
    console.error(`❌ [背景下載] 背景下載失敗:`, error);
  }
}