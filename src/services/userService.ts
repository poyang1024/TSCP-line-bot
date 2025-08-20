import { UserState } from '../types';
import { disconnectUserWebSocket } from './websocketService';
import { verifyUserToken, JWTPayload } from './jwtService';

// 簡單的記憶體儲存，主要用於暫存資料
// 主要狀態現在透過 JWT 管理
const userTempData = new Map<string, any>();
const userStates = new Map<string, Partial<UserState>>();

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
    currentStep: undefined,
    loginMethod: 'account',
    tempData: userTempData.get(lineId)
  };
}

// 取得用戶狀態 (向後相容)
export function getUserState(userId: string): UserState {
  const storedState = userStates.get(userId) || {};
  return {
    userId,
    tempData: userTempData.get(userId),
    ...storedState
  };
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

// 檢查用戶是否已登入 (從 JWT)
export function isUserLoggedInFromToken(lineId: string, token?: string): boolean {
  if (!token) return false;
  
  const decoded = verifyUserToken(token);
  return !!(decoded && decoded.lineId === lineId && decoded.memberId && decoded.accessToken);
}

// 向後相容的檢查方法
export function isUserLoggedIn(userId: string): boolean {
  return false; // 在 JWT 模式下，總是返回 false，需要傳入 token
}

// 清除用戶狀態 (保留向後相容)
export function clearUserState(userId: string): void {
  clearUserTempData(userId);
  userStates.delete(userId);
  console.log(`🧹 Cleared all state for user ${userId}`);
}

// 更新用戶狀態 (保留向後相容)
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

// 根據 Member ID 查找 LINE User ID（在 JWT 模式下較難實現）
export function findUserIdByMemberId(memberId: number): string | null {
  // 在 JWT 模式下，這個功能需要其他方式實現
  // 或者使用外部儲存（如 Redis）來維護這個映射
  return null;
}