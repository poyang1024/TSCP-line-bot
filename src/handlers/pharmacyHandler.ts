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

    // 取得會員地址作為搜尋關鍵字
    const memberAddress = userState.tempData?.memberPersonalInfo?.address;
    let searchKeyword: string | undefined;
    
    if (memberAddress && memberAddress.trim() !== '') {
      searchKeyword = memberAddress.trim();
      console.log(`🔍 使用會員地址作為搜尋關鍵字: ${searchKeyword}`);
    } else {
      console.log(`🔍 沒有會員地址，使用預設搜尋`);
    }

    // 搜尋藥局（如果有會員地址則使用地址作為關鍵字）
    const pharmacies = await searchPharmacies(token, searchKeyword);
    
    if (pharmacies.length === 0) {
      const noResultMessage = searchKeyword 
        ? `🏥 在您的地址附近（${searchKeyword}）沒有找到可用的藥局。\n\n請稍後再試或聯絡客服。`
        : '🏥 目前沒有找到可用的藥局，請稍後再試。';
        
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: noResultMessage
      });
      return;
    }
    
    // 限制顯示前10家藥局
    const limitedPharmacies = pharmacies.slice(0, 10);
    
    const searchResultMessage = searchKeyword
      ? `🏥 根據您的地址（${searchKeyword}），找到 ${pharmacies.length} 家藥局：`
      : `🏥 找到 ${pharmacies.length} 家藥局，以下是附近的藥局：`;
    
    await client.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: searchResultMessage
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