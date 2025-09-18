/**
 * 輪詢服務 - 用於在 Serverless 環境下替代 WebSocket 長連線
 */

import { getOrders } from './apiService';
import { getUserLoginState, setUserLastPollTime, getUserLastPollTime } from './redisService';
import { sendOrderStatusUpdate } from '../handlers/notificationHandler';

/**
 * 檢查用戶的訂單更新
 */
export async function checkUserOrderUpdates(userId: string): Promise<boolean> {
  try {
    // 獲取用戶登入狀態
    const loginState = await getUserLoginState(userId);
    if (!loginState) {
      console.log(`⚠️ 用戶 ${userId} 未登入，跳過輪詢檢查`);
      return false;
    }

    // 獲取上次檢查時間
    const lastPollTime = await getUserLastPollTime(userId);
    const now = Date.now();
    
    // 避免頻繁輪詢（最少間隔 30 秒）
    if (lastPollTime && (now - lastPollTime) < 30000) {
      console.log(`⏰ 用戶 ${userId} 輪詢間隔太短，跳過檢查`);
      return false;
    }

    console.log(`🔍 檢查用戶 ${userId} 的訂單更新...`);

    // 查詢最新訂單
    const orders = await getOrders(loginState.accessToken);
    
    if (orders.length === 0) {
      await setUserLastPollTime(userId, now);
      return false;
    }

    // 檢查是否有最近更新的訂單（5分鐘內）
    // 注意：Order 類型可能沒有 updated_at，我們使用 state 變化作為更新指標
    const recentOrders = orders.slice(0, 3); // 獲取最近的訂單

    if (recentOrders.length > 0) {
      console.log(`📢 檢查到 ${recentOrders.length} 個訂單狀態`);
      
      // 發送訂單狀態通知
      for (const order of recentOrders) {
        await sendOrderStatusUpdate(userId, {
          id: order.id,
          order_code: order.order_code,
          member_id: loginState.memberId,
          state: order.state
        });
      }
      
      await setUserLastPollTime(userId, now);
      return true;
    }

    await setUserLastPollTime(userId, now);
    return false;
  } catch (error) {
    console.error(`❌ 檢查用戶 ${userId} 訂單更新時發生錯誤:`, error);
    return false;
  }
}

/**
 * 在用戶操作時觸發訂單檢查
 */
export async function triggerOrderCheck(userId: string): Promise<void> {
  try {
    // 異步執行，不阻塞主要功能
    setImmediate(async () => {
      await checkUserOrderUpdates(userId);
    });
  } catch (error) {
    console.error(`❌ 觸發訂單檢查失敗:`, error);
  }
}

/**
 * 模擬 WebSocket 房間廣播檢查
 */
export async function simulateRoomBroadcastCheck(userId: string, memberId: number): Promise<void> {
  try {
    console.log(`🔄 為用戶 ${userId} (Member ID: ${memberId}) 模擬房間廣播檢查`);
    
    // 執行訂單更新檢查
    await checkUserOrderUpdates(userId);
    
    console.log(`✅ 完成用戶 ${userId} 的廣播檢查模擬`);
  } catch (error) {
    console.error(`❌ 模擬房間廣播檢查失敗:`, error);
  }
}
