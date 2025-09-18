/**
 * 輪詢服務 - 用於在 Serverless 環境下替代 WebSocket 長連線
 * 使用通知 API 來檢查新的通知，避免重複發送舊通知
 */

import { getNotifications, markNotificationAsRead, Notification } from './apiService';
import { getUserLoginState, setUserLastNotificationCheck, getUserLastNotificationCheck } from './redisService';
import { sendNotification } from '../handlers/notificationHandler';

/**
 * 檢查用戶的新通知
 */
export async function checkUserNotifications(userId: string): Promise<boolean> {
  try {
    // 獲取用戶登入狀態
    const loginState = await getUserLoginState(userId);
    if (!loginState) {
      console.log(`⚠️ 用戶 ${userId} 未登入，跳過通知檢查`);
      return false;
    }

    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    
    // 獲取上次檢查時間
    const lastCheckTime = await getUserLastNotificationCheck(userId);
    
    // 如果是第一次檢查，設定為30分鐘前開始檢查，避免發送過多舊通知
    const startTime = lastCheckTime || (now - 1800); // 30分鐘前
    
    console.log(`🔍 檢查用戶 ${userId} 的新通知 (從 ${new Date(startTime * 1000).toISOString()} 開始)...`);

    // 查詢未讀通知
    const notifications = await getNotifications(
      loginState.accessToken,
      startTime,
      now,
      false // 只查詢未讀通知
    );
    
    if (notifications.length === 0) {
      console.log(`📭 用戶 ${userId} 沒有新通知`);
      await setUserLastNotificationCheck(userId, now);
      return false;
    }

    console.log(`📬 用戶 ${userId} 有 ${notifications.length} 個新通知`);
    
    // 發送通知並標記為已讀
    let hasNewNotifications = false;
    for (const notification of notifications) {
      try {
        // 發送通知到 LINE
        await sendNotification(userId, notification);
        
        // 標記通知為已讀
        await markNotificationAsRead(loginState.accessToken, notification.id);
        
        hasNewNotifications = true;
        console.log(`✅ 已處理通知 ${notification.id}: ${notification.subject}`);
      } catch (error) {
        console.error(`❌ 處理通知 ${notification.id} 時發生錯誤:`, error);
      }
    }
    
    // 更新最後檢查時間
    await setUserLastNotificationCheck(userId, now);
    
    return hasNewNotifications;
    
  } catch (error) {
    console.error('❌ 檢查用戶通知時發生錯誤:', error);
    return false;
  }
}

/**
 * 觸發用戶通知檢查
 */
export async function triggerNotificationCheck(userId: string): Promise<void> {
  try {
    console.log(`🔔 觸發用戶 ${userId} 的通知檢查`);
    await checkUserNotifications(userId);
  } catch (error) {
    console.error('❌ 觸發通知檢查時發生錯誤:', error);
  }
}

/**
 * 模擬房間廣播檢查（保持 WebSocket 相容性）
 * 在 serverless 環境中，這個函數會觸發通知檢查
 */
export async function simulateRoomBroadcastCheck(userId: string, memberId?: number): Promise<void> {
  try {
    const memberInfo = memberId ? ` (Member ID: ${memberId})` : '';
    console.log(`📡 模擬房間廣播檢查，觸發用戶 ${userId}${memberInfo} 的通知檢查`);
    await checkUserNotifications(userId);
    console.log(`✅ 完成用戶 ${userId} 的廣播檢查模擬`);
  } catch (error) {
    console.error('❌ 模擬廣播檢查時發生錯誤:', error);
  }
}

// 保持向後相容性的別名
export const triggerOrderCheck = triggerNotificationCheck;
export const checkUserOrderUpdates = checkUserNotifications;
