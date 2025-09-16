import { MessageEvent, Client } from '@line/bot-sdk';
import { getUserState, ensureUserState } from '../services/userService';
import { getOrders } from '../services/apiService';
import { createOrderDetailCard } from '../templates/messageTemplates';
import { createUserToken } from '../services/jwtService';

export async function handleOrderInquiry(event: MessageEvent, client: Client): Promise<void> {
  const userId = event.source.userId!;
  
  // 確保用戶狀態是最新的
  await ensureUserState(userId);
  const userState = getUserState(userId);
  
  console.log(`📋 處理訂單查詢: userId=${userId}, accessToken=${!!userState.accessToken}, memberId=${userState.memberId}`);
  
  if (!userState.accessToken || !userState.memberId) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 請先登入會員帳號'
    });
    return;
  }
  
  try {
    // 查詢所有訂單
    console.log(`📋 調用 getOrders API, token=${userState.accessToken?.substring(0, 10)}...`);
    const orders = await getOrders(userState.accessToken);
    console.log(`📋 API 回傳訂單數量: ${orders.length}`);
    
    if (orders.length === 0) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '📋 您目前沒有任何訂單記錄。\n\n如需配藥服務，請先搜尋藥局並上傳藥單。'
      });
      return;
    }
    
    // 顯示最近的3筆訂單 (確保不超過 LINE 的訊息限制)
    const recentOrders = orders.slice(-3);
    console.log(`📋 準備顯示 ${recentOrders.length} 筆訂單`);
    
    // 生成 JWT token
    const jwtToken = createUserToken(userId, userState.memberId!, userState.accessToken!, userState.memberName || '用戶');
    
    try {
      const orderCards = recentOrders.map(order => {
        console.log(`📋 建立訂單卡片: ${order.order_code}`);
        return createOrderDetailCard(order, jwtToken);
      });
      
      // 先發送概要訊息
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📋 找到 ${orders.length} 筆訂單記錄，以下是最近的 ${recentOrders.length} 筆訂單：`
      });
      
      // 然後逐一發送訂單卡片
      for (const orderCard of orderCards) {
        try {
          await client.pushMessage(userId, orderCard);
          // 添加小延遲避免發送太快
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (cardError) {
          console.error('發送訂單卡片錯誤:', cardError);
        }
      }
    } catch (cardCreationError) {
      console.error('建立訂單卡片錯誤:', cardCreationError);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📋 找到 ${orders.length} 筆訂單，但顯示詳情時發生錯誤。\n\n訂單代碼：${recentOrders.map(o => o.order_code).join(', ')}`
      });
    }
    
  } catch (error) {
    console.error('查詢訂單錯誤:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 查詢訂單時發生錯誤，請稍後再試。'
    });
  }
}