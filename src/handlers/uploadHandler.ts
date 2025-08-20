import { MessageEvent, Client, ImageMessage } from '@line/bot-sdk';
import { getUserState, updateUserState } from '../services/userService';
import fs from 'fs';
import path from 'path';

export async function handleImageUpload(event: MessageEvent & { message: ImageMessage }, client: Client): Promise<void> {
  const userId = event.source.userId!;
  const userState = getUserState(userId);
  
  // 檢查登入狀態 - 需要檢查 accessToken 和 memberId
  if (!userState.accessToken || !userState.memberId) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 請先登入會員帳號才能上傳處方籤\n\n請使用下方選單的「中藥預約」功能進行登入。'
    });
    return;
  }
  
  try {
    // 下載圖片
    const messageId = event.message.id;
    const stream = await client.getMessageContent(messageId);
    
    // 確保上傳目錄存在
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 儲存圖片
    const fileName = `prescription_${userId}_${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, fileName);
    
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    stream.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(filePath, buffer);
      
      console.log(`📷 處方籤已儲存: ${filePath}`);
      
      // 重新獲取最新的用戶狀態
      const currentUserState = getUserState(userId);
      console.log(`📷 上傳後狀態檢查: accessToken=${!!currentUserState.accessToken}, memberId=${currentUserState.memberId}`);
      
      // 儲存檔案資訊到用戶狀態，確保保留登入資訊
      updateUserState(userId, {
        currentStep: 'prescription_uploaded',
        tempData: {
          ...currentUserState.tempData,
          prescriptionFile: filePath,
          prescriptionFileName: fileName
        }
      });
      
      console.log(`✅ 用戶狀態已更新 - 處方籤上傳完成`);
      
      // 獲取用戶姓名
      const memberName = currentUserState.tempData?.memberInfo?.memberName || currentUserState.memberName || '';
      const greeting = memberName ? `${memberName}，` : '';
      
      // 提示選擇藥局
      await client.replyMessage(event.replyToken, {
        type: 'template',
        altText: '處方籤上傳成功',
        template: {
          type: 'buttons',
          title: '📷 處方籤上傳成功！',
          text: `${greeting}請選擇要配藥的藥局：`,
          actions: [
            {
              type: 'message',
              label: '🔍 搜尋藥局',
              text: '搜尋藥局'
            },
            {
              type: 'postback',
              label: '📋 查看我的訂單',
              data: 'action=view_orders'
            }
          ]
        }
      });
    });
    
    stream.on('error', (error) => {
      console.error('下載圖片錯誤:', error);
      client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 處方籤上傳失敗，請稍後再試。'
      });
    });
    
  } catch (error) {
    console.error('處理圖片上傳錯誤:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 處方籤上傳失敗，請稍後再試。'
    });
  }
}