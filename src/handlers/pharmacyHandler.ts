import { MessageEvent, Client } from '@line/bot-sdk';
import { searchPharmacies } from '../services/apiService';
import { createPharmacyCarousel } from '../templates/messageTemplates';
import { getUserState, isUserLoggedIn } from '../services/userService';

export async function handlePharmacySearch(event: MessageEvent, client: Client): Promise<void> {
  try {
    const userId = event.source.userId;
    if (!userId) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 無法識別用戶身份'
      });
      return;
    }

    const userState = getUserState(userId);
    
    // 檢查用戶是否已登入 - 使用實際的登入狀態檢查
    if (!userState.accessToken || !userState.memberId) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 請先登入才能搜尋藥局'
      });
      return;
    }

    const token = userState.accessToken;
    
    if (!token) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 登入資訊已過期，請重新登入'
      });
      return;
    }

    // 搜尋藥局（不使用關鍵字過濾，返回所有可用藥局）
    const pharmacies = await searchPharmacies(token);
    
    if (pharmacies.length === 0) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `🏥 目前沒有找到可用的藥局，請稍後再試。`
      });
      return;
    }
    
    // 限制顯示前10家藥局
    const limitedPharmacies = pharmacies.slice(0, 10);
    
    await client.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: `🏥 找到 ${pharmacies.length} 家藥局，以下是附近的藥局：`
      },
      createPharmacyCarousel(limitedPharmacies)
    ]);
    
  } catch (error) {
    console.error('搜尋藥局錯誤:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 搜尋藥局時發生錯誤，請稍後再試。'
    });
  }
}