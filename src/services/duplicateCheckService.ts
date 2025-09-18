/**
 * 請求去重服務
 * 用於防止用戶過度點擊，但避免誤判正常請求
 */

import { 
  setRequestTimestamp, 
  getRequestTimestamp, 
  setRequestCount, 
  getRequestCount 
} from './redisService';

// 請求去重配置
const DUPLICATE_CHECK_CONFIG = {
  // 不同操作的最小間隔時間（毫秒）
  intervals: {
    'view_orders': 2000,      // 查看訂單：2秒
    'member_center': 1000,    // 會員中心：1秒
    'create_order': 3000,     // 創建訂單：3秒
    'login': 5000,            // 登入：5秒
    'logout': 2000,           // 登出：2秒
    'upload': 10000,          // 上傳：10秒
    'default': 1500           // 預設：1.5秒
  },
  // 靜默模式：不顯示重複請求訊息的次數
  silentThreshold: 2,
  // 重置計數器的時間（毫秒）
  resetInterval: 30000,       // 30秒
};

/**
 * 檢查是否為重複請求
 * @param userId 用戶ID
 * @param action 操作類型
 * @param silent 是否靜默模式（不返回訊息）
 * @returns { isDuplicate: boolean, shouldShowMessage: boolean }
 */
export async function checkDuplicateRequest(
  userId: string, 
  action: string, 
  silent: boolean = false
): Promise<{ isDuplicate: boolean, shouldShowMessage: boolean }> {
  try {
    const now = Date.now();
    const requestKey = `request:${userId}:${action}`;
    const countKey = `count:${userId}:${action}`;
    
    // 獲取上次請求時間
    const lastRequestTime = await getRequestTimestamp(requestKey);
    
    // 獲取最小間隔時間
    const minInterval = DUPLICATE_CHECK_CONFIG.intervals[action] || 
                       DUPLICATE_CHECK_CONFIG.intervals.default;
    
    if (lastRequestTime) {
      const timeDiff = now - lastRequestTime;
      
      if (timeDiff < minInterval) {
        console.log(`⚠️ 檢測到用戶 ${userId} 重複請求 ${action}，間隔：${timeDiff}ms (最小：${minInterval}ms)`);
        
        if (silent) {
          return { isDuplicate: true, shouldShowMessage: false };
        }
        
        // 檢查重複請求次數
        const duplicateCount = await getRequestCount(countKey) || 0;
        const newCount = duplicateCount + 1;
        
        // 更新計數器
        await setRequestCount(countKey, newCount);
        
        // 如果重複次數超過閾值，則靜默處理
        const shouldShowMessage = newCount <= DUPLICATE_CHECK_CONFIG.silentThreshold;
        
        if (!shouldShowMessage) {
          console.log(`🔇 用戶 ${userId} 重複請求次數過多，啟用靜默模式`);
        }
        
        return { isDuplicate: true, shouldShowMessage };
      }
    }
    
    // 記錄本次請求時間
    await setRequestTimestamp(requestKey, now);
    
    // 重置計數器（如果時間間隔足夠長）
    if (lastRequestTime && (now - lastRequestTime) > DUPLICATE_CHECK_CONFIG.resetInterval) {
      await setRequestCount(countKey, 0);
    }
    
    return { isDuplicate: false, shouldShowMessage: false };
    
  } catch (error) {
    console.error('❌ 檢查重複請求時發生錯誤:', error);
    // 發生錯誤時，允許請求通過
    return { isDuplicate: false, shouldShowMessage: false };
  }
}

/**
 * 重置用戶的請求計數器
 */
export async function resetUserRequestCounters(userId: string): Promise<void> {
  try {
    const actions = Object.keys(DUPLICATE_CHECK_CONFIG.intervals);
    
    for (const action of actions) {
      const countKey = `count:${userId}:${action}`;
      await setRequestCount(countKey, 0);
    }
    
    console.log(`🔄 已重置用戶 ${userId} 的請求計數器`);
  } catch (error) {
    console.error('❌ 重置請求計數器時發生錯誤:', error);
  }
}

/**
 * 生成友善的重複請求提醒訊息
 */
export function generateDuplicateRequestMessage(action: string): string {
  const actionMessages = {
    'view_orders': '您的訂單資料正在載入中，請稍候...',
    'member_center': '會員中心正在載入，請稍候...',
    'create_order': '訂單建立中，請稍候...',
    'login': '登入處理中，請稍候...',
    'logout': '登出處理中，請稍候...',
    'upload': '檔案上傳中，請稍候...',
  };
  
  return actionMessages[action] || '處理中，請稍候...';
}
