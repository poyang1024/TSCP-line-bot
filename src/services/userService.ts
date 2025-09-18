import { UserState } from '../types';
import { disconnectUserWebSocket } from './websocketService';
import { verifyUserToken, JWTPayload } from './jwtService';

// 簡單的記憶體儲存，主要用於暫存資料
// 主要狀態現在透過 JWT 管理
const userTempData = new Map<string, any>();
const userStates = new Map<string, Partial<UserState>>();

// 處理過的 webhook 事件 ID 記錄（用於防重複）
const processedEventIds = new Set<string>();

// 從 JWT Token 取得用戶狀態
export function getUserStateFromToken(lineId: string, token?: string): UserState {
  const baseState: UserState = { userId: lineId };
  
  if (!token) {
    return baseState;
  }
  
  const decoded = verifyUserToken(token);
  if (!decoded || decoded.lineId !== lineId) {
    return baseState;
  }
  
  return {
    userId: lineId,
    memberId: decoded.memberId,
    accessToken: decoded.accessToken,
    memberName: decoded.memberName,
    currentStep: undefined,
    loginMethod: 'account',
    tempData: userTempData.get(lineId)
  };
}

// 檢查用戶是否已透過 Web 登入
export async function checkWebLoginStatus(userId: string): Promise<UserState | null> {
  try {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://tscp-line-bot.vercel.app' 
      : `http://localhost:${process.env.PORT || 3000}`;
      
    const response = await fetch(`${baseUrl}/auth/status?userId=${userId}`);
    const result = await response.json() as any;
    
    if (result.success && result.isLoggedIn) {
      return {
        userId: userId,
        memberId: result.user.memberId,
        memberName: result.user.memberName,
        currentStep: 'menu',
        loginMethod: 'account'
      };
    }
    
    return null;
  } catch (error) {
    console.error('檢查 Web 登入狀態失敗:', error);
    return null;
  }
}

// 取得用戶狀態 (同步版本，保持向後相容)
export function getUserState(userId: string): UserState {
  const storedState = userStates.get(userId) || {};
  return {
    userId,
    tempData: userTempData.get(userId),
    ...storedState
  };
}

// 輔助函數：確保用戶狀態是最新的（包含 Web 登入檢查）
export async function ensureUserState(userId: string): Promise<void> {
  const currentState = getUserState(userId);
  
  // 如果已經有登入狀態，就不需要再檢查
  if (currentState.memberId && currentState.accessToken) {
    return;
  }
  
  // 檢查 Web 登入狀態
  try {
    const webLoginState = await checkWebLoginStatus(userId);
    if (webLoginState) {
      updateUserState(userId, {
        memberId: webLoginState.memberId,
        memberName: webLoginState.memberName,
        accessToken: webLoginState.accessToken,
        loginMethod: 'account',
        currentStep: 'menu'
      });
      console.log(`🔄 自動恢復用戶登入狀態: ${userId}`);
    }
  } catch (error) {
    console.error('檢查 Web 登入狀態失敗:', error);
  }
}

// 更新用戶暫存資料
export function updateUserTempData(userId: string, tempData: any): void {
  if (tempData) {
    userTempData.set(userId, tempData);
  } else {
    userTempData.delete(userId);
  }
  
  console.log(`🔗 Updated temp data for LINE User ${userId}`);
}

// 清除用戶暫存資料
export function clearUserTempData(userId: string): void {
  userTempData.delete(userId);
  console.log(`🗑️ Cleared temp data for LINE User ${userId}`);
}

// 更新用戶狀態
export function updateUserState(userId: string, updates: Partial<UserState>): void {
  const currentState = userStates.get(userId) || {};
  const newState = { ...currentState, ...updates };
  
  // 處理 tempData 的特殊情況
  if (updates.tempData !== undefined) {
    updateUserTempData(userId, updates.tempData);
    delete newState.tempData; // 不在 userStates 中儲存 tempData
  }
  
  userStates.set(userId, newState);
  console.log(`🔄 Updated user state for ${userId}:`, newState);
}

// 清除用戶狀態
export function clearUserState(userId: string): void {
  clearUserTempData(userId);
  userStates.delete(userId);
  console.log(`🧹 Cleared all state for user ${userId}`);
}

// 檢查用戶是否已登入 (從 JWT)
export function isUserLoggedInFromToken(lineId: string, token?: string): boolean {
  if (!token) return false;
  
  const decoded = verifyUserToken(token);
  return !!(decoded && decoded.lineId === lineId && decoded.memberId && decoded.accessToken);
}

// 向後相容的檢查方法
export function isUserLoggedIn(userId: string): boolean {
  const state = getUserState(userId);
  return !!(state.memberId && state.accessToken);
}

// 檢查事件是否已處理過（防重複處理）
export function hasEventBeenProcessed(eventId: string): boolean {
  return processedEventIds.has(eventId);
}

// 標記事件為已處理
export function markEventAsProcessed(eventId: string): void {
  processedEventIds.add(eventId);
  
  // 限制記錄數量，避免記憶體洩漏（保留最近 1000 個事件 ID）
  if (processedEventIds.size > 1000) {
    const eventIdsArray = Array.from(processedEventIds);
    const toKeep = eventIdsArray.slice(-800); // 保留最後 800 個
    processedEventIds.clear();
    toKeep.forEach(id => processedEventIds.add(id));
  }
}

// 檢查是否為重新投遞的事件
export function isDuplicateEvent(eventId: string, deliveryContext?: { isRedelivery?: boolean }): boolean {
  // 檢查是否明確標記為重新投遞
  if (deliveryContext?.isRedelivery) {
    return true;
  }
  
  // 檢查事件 ID 是否已處理過
  return hasEventBeenProcessed(eventId);
}
