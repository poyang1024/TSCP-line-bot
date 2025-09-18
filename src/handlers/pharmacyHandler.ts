import { MessageEvent, Client, PostbackEvent } from '@line/bot-sdk';
import { searchPharmacies } from '../services/apiService';
import { createPharmacyCarousel, createPharmacyPaginationButtons } from '../templates/messageTemplates';
import { getUserState, isUserLoggedIn } from '../services/userService';
import { getUserLoginState } from '../services/redisService';

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

    // 首先檢查 Redis 中的登入狀態
    const loginState = await getUserLoginState(userId);
    
    if (!loginState) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 請先登入才能搜尋藥局'
      });
      return;
    }

    const token = loginState.accessToken;
    
    if (!token) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 登入資訊已過期，請重新登入'
      });
      return;
    }

    // 備用：檢查記憶體中的用戶狀態來取得會員地址
    const userState = getUserState(userId);
    
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
    
    // 使用新的分頁藥局輪播
    const carouselMessage = createPharmacyCarousel(pharmacies, 1); // 第一頁
    const messages = [
      {
        type: 'text' as const,
        text: searchResultMessage
      },
      carouselMessage
    ];
    
    // 如果有超過10家藥局，添加分頁按鈕
    if (pharmacies.length > 10) {
      const paginationButtons = createPharmacyPaginationButtons(pharmacies, 1);
      messages.push(paginationButtons);
    }
    
    await client.replyMessage(event.replyToken, messages);
    
  } catch (error) {
    console.error('搜尋藥局錯誤:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 搜尋藥局時發生錯誤，請稍後再試。'
    });
  }
}

// 處理藥局分頁導航
export async function handlePharmacyPageNavigation(event: PostbackEvent, client: Client, data: URLSearchParams): Promise<void> {
  try {
    const userId = event.source.userId;
    if (!userId) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 無法識別用戶身份'
      });
      return;
    }

    // 檢查 Redis 中的登入狀態
    const loginState = await getUserLoginState(userId);
    
    if (!loginState) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 請先登入才能查看藥局'
      });
      return;
    }

    const token = loginState.accessToken;
    const page = parseInt(data.get('page') || '1');
    
    // 重新搜尋藥局資料
    const userState = getUserState(userId); // 備用：取得會員地址
    const memberAddress = userState.tempData?.memberPersonalInfo?.address;
    let searchKeyword: string | undefined;
    
    if (memberAddress && memberAddress.trim() !== '') {
      searchKeyword = memberAddress.trim();
    }

    const pharmacies = await searchPharmacies(token, searchKeyword);
    
    if (pharmacies.length === 0) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🏥 沒有找到可用的藥局。'
      });
      return;
    }

    // 創建指定頁面的輪播
    const carouselMessage = createPharmacyCarousel(pharmacies, page);
    const messages = [carouselMessage];
    
    // 添加分頁按鈕
    if (pharmacies.length > 10) {
      const paginationButtons = createPharmacyPaginationButtons(pharmacies, page);
      messages.push(paginationButtons);
    }
    
    await client.replyMessage(event.replyToken, messages);
    
  } catch (error) {
    console.error('處理藥局分頁錯誤:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 查看藥局時發生錯誤，請稍後再試。'
    });
  }
}