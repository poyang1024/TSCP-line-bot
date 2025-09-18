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
    'view_orders': 1000,      // 查看訂單：1秒
    'member_center': 800,     // 會員中心：0.8秒
    'create_order': 2000,     // 創建訂單：2秒
    'login_required': 1000,   // 登入提示：1秒
    'login': 3000,            // 登入：3秒
    'logout': 1500,           // 登出：1.5秒
    'upload': 5000,           // 上傳：5秒
    'default': 1000           // 預設：1秒
  },
  // 顯示警告訊息的閾值（在此之前顯示提醒）
  warningThreshold: 3,
  // 完全靜默的閾值（超過此次數後完全靜默）
  silentThreshold: 10,
  // 重置計數器的時間（毫秒）
  resetInterval: 60000,       // 60秒後重置
};

/**
 * 檢查是否為重複請求
 * @param userId 用戶ID
 * @param action 操作類型
 * @param silent 是否靜默模式（不返回訊息）
 * @returns { isDuplicate: boolean, shouldShowMessage: boolean, shouldExecute: boolean }
 */
export async function checkDuplicateRequest(
  userId: string, 
  action: string, 
  silent: boolean = false
): Promise<{ isDuplicate: boolean, shouldShowMessage: boolean, shouldExecute: boolean }> {
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
        
        // 檢查重複請求次數
        const duplicateCount = await getRequestCount(countKey) || 0;
        const newCount = duplicateCount + 1;
        
        // 更新計數器
        await setRequestCount(countKey, newCount);
        
        // 判斷是否應該顯示訊息和是否應該執行
        let shouldShowMessage = false;
        let shouldExecute = true;
        
        if (newCount <= DUPLICATE_CHECK_CONFIG.warningThreshold) {
          // 在警告閾值內，顯示友善提醒但仍執行
          shouldShowMessage = !silent;
          shouldExecute = true;
          console.log(`💬 用戶 ${userId} 重複請求 ${action}，顯示提醒並執行 (${newCount}/${DUPLICATE_CHECK_CONFIG.warningThreshold})`);
        } else if (newCount <= DUPLICATE_CHECK_CONFIG.silentThreshold) {
          // 在靜默閾值內，不顯示訊息但仍執行
          shouldShowMessage = false;
          shouldExecute = true;
          console.log(`🔇 用戶 ${userId} 重複請求 ${action}，靜默執行 (${newCount}/${DUPLICATE_CHECK_CONFIG.silentThreshold})`);
        } else {
          // 超過靜默閾值，開始限制執行
          shouldShowMessage = false;
          shouldExecute = false;
          console.log(`� 用戶 ${userId} 重複請求過多 ${action}，暫時阻止執行 (${newCount}/${DUPLICATE_CHECK_CONFIG.silentThreshold})`);
        }
        
        return { isDuplicate: true, shouldShowMessage, shouldExecute };
      }
    }
    
    // 記錄本次請求時間
    await setRequestTimestamp(requestKey, now);
    
    // 重置計數器（如果時間間隔足夠長）
    if (lastRequestTime && (now - lastRequestTime) > DUPLICATE_CHECK_CONFIG.resetInterval) {
      await setRequestCount(countKey, 0);
      console.log(`🔄 重置用戶 ${userId} 的 ${action} 請求計數器`);
    }
    
    return { isDuplicate: false, shouldShowMessage: false, shouldExecute: true };
    
  } catch (error) {
    console.error('❌ 檢查重複請求時發生錯誤:', error);
    // 發生錯誤時，允許請求通過
    return { isDuplicate: false, shouldShowMessage: false, shouldExecute: true };
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
