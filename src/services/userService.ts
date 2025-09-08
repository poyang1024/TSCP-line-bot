import { UserState, UserTempData, OrderStep, ORDER_STEP_TIMEOUT } from '../types';
import { disconnectUserWebSocket } from './websocketService';
import { verifyUserToken, JWTPayload } from './jwtService';

// 僅用於暫存訂單步驟資料，不儲存登入狀態
// 登入狀態完全由 JWT 管理
const userTempData = new Map<string, UserTempData>();
const userOrderSteps = new Map<string, { step: string; startTime: number }>();
// 短期 JWT token 快取 (用於在同一個請求流程中避免重複解析)
const jwtTokenCache = new Map<string, { token: string; session: JWTPayload; timestamp: number }>();

// JWT 快取過期時間 (5分鐘)
const JWT_CACHE_TIMEOUT = 5 * 60 * 1000;

// 清理過期的 JWT 快取
function cleanExpiredJwtCache(): void {
  const now = Date.now();
  for (const [userId, cache] of jwtTokenCache.entries()) {
    if (now - cache.timestamp > JWT_CACHE_TIMEOUT) {
      jwtTokenCache.delete(userId);
    }
  }
}

// 緩存 JWT token (短期)
export function cacheUserJwtToken(userId: string, token: string): void {
  const session = verifyUserToken(token);
  if (session && session.lineId === userId) {
    jwtTokenCache.set(userId, {
      token,
      session,
      timestamp: Date.now()
    });
  }
}

// 從快取獲取 JWT session
function getCachedJwtSession(userId: string): JWTPayload | null {
  cleanExpiredJwtCache();
  const cache = jwtTokenCache.get(userId);
  if (cache) {
    // 驗證 token 是否仍然有效
    const session = verifyUserToken(cache.token);
    if (session && session.lineId === userId) {
      return session;
    } else {
      // 清除無效的快取
      jwtTokenCache.delete(userId);
    }
  }
  return null;
}

// 檢查訂單步驟是否超時
function checkOrderStepTimeout(userId: string): boolean {
  const orderStep = userOrderSteps.get(userId);
  if (!orderStep) return false;
  
  const now = Date.now();
  const elapsed = now - orderStep.startTime;
  
  if (elapsed > ORDER_STEP_TIMEOUT) {
    console.log(`⏰ 用戶 ${userId} 的訂單步驟已超時 (${Math.floor(elapsed / 1000)}秒)，清除步驟`);
    clearOrderStep(userId);
    return true;
  }
  
  return false;
}

// 設定訂單步驟
export function setOrderStep(userId: string, step: string): void {
  userOrderSteps.set(userId, {
    step,
    startTime: Date.now()
  });
  
  // 同時更新暫存資料中的時間戳
  const tempData = userTempData.get(userId) || {};
  tempData.orderStepStartTime = Date.now();
  userTempData.set(userId, tempData);
  
  console.log(`📝 設定用戶 ${userId} 訂單步驟: ${step}`);
}

// 取得訂單步驟
export function getOrderStep(userId: string): string | null {
  // 先檢查是否超時
  if (checkOrderStepTimeout(userId)) {
    return null;
  }
  
  const orderStep = userOrderSteps.get(userId);
  return orderStep ? orderStep.step : null;
}

// 清除訂單步驟
export function clearOrderStep(userId: string): void {
  userOrderSteps.delete(userId);
  
  // 同時清除暫存資料中的相關資料
  const tempData = userTempData.get(userId);
  if (tempData) {
    delete tempData.orderStepStartTime;
    delete tempData.prescriptionFile;
    delete tempData.prescriptionFileName;
    delete tempData.messageId;
    delete tempData.selectedPharmacyId;
    delete tempData.processingStartTime;
    
    if (Object.keys(tempData).length === 0) {
      userTempData.delete(userId);
    } else {
      userTempData.set(userId, tempData);
    }
  }
  
  console.log(`🗑️ 清除用戶 ${userId} 的訂單步驟`);
}

// 檢查用戶是否在訂單步驟中
export function isUserInOrderProcess(userId: string): boolean {
  const step = getOrderStep(userId);
  return step !== null && step !== OrderStep.NONE;
}

// 從 JWT Token 取得用戶狀態
export function getUserStateFromToken(lineId: string, token?: string): UserState {
  const baseState: UserState = { userId: lineId };
  
  if (!token) {
    return baseState;
  }
  
  // 同時緩存此 token 以供後續使用
  cacheUserJwtToken(lineId, token);
  
  const decoded = verifyUserToken(token);
  if (!decoded || decoded.lineId !== lineId) {
    return baseState;
  }
  
  // 檢查並清理超時的訂單步驟
  const currentStep = getOrderStep(lineId);
  
  return {
    userId: lineId,
    memberId: decoded.memberId,
    memberName: decoded.memberName,
    accessToken: decoded.accessToken,
    currentStep: currentStep || undefined,
    loginMethod: 'account',
    tempData: userTempData.get(lineId)
  };
}

// 取得用戶狀態 (嘗試從快取的 JWT 中獲取登入狀態)
export function getUserState(userId: string): UserState {
  // 檢查並清理超時的訂單步驟
  const currentStep = getOrderStep(userId);
  
  // 嘗試從快取的 JWT 中獲取登入狀態
  const cachedSession = getCachedJwtSession(userId);
  
  if (cachedSession) {
    return {
      userId,
      memberId: cachedSession.memberId,
      memberName: cachedSession.memberName,
      accessToken: cachedSession.accessToken,
      currentStep: currentStep || undefined,
      loginMethod: 'account',
      tempData: userTempData.get(userId)
    };
  }
  
  // 如果沒有快取的登入狀態，返回基本狀態
  return {
    userId,
    currentStep: currentStep || undefined,
    tempData: userTempData.get(userId)
  };
}

// 更新用戶暫存資料
export function updateUserTempData(userId: string, tempData: UserTempData | null): void {
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

// 向後相容的檢查方法 (在 JWT 模式下總是返回 false)
export function isUserLoggedIn(userId: string): boolean {
  return false; // 在 JWT 模式下，總是返回 false，需要傳入 token
}

// 清除用戶狀態 (僅清除暫存資料和訂單步驟)
export function clearUserState(userId: string): void {
  clearUserTempData(userId);
  clearOrderStep(userId);
  console.log(`🧹 Cleared all temp state for user ${userId}`);
}

// 更新用戶狀態 (僅用於訂單步驟管理)
export function updateUserState(userId: string, updates: Partial<UserState>): void {
  // 處理訂單步驟
  if (updates.currentStep !== undefined) {
    if (updates.currentStep) {
      setOrderStep(userId, updates.currentStep);
    } else {
      clearOrderStep(userId);
    }
  }
  
  // 處理 tempData
  if (updates.tempData !== undefined) {
    updateUserTempData(userId, updates.tempData);
  }
  
  console.log(`🔄 Updated user state for ${userId}:`, {
    currentStep: updates.currentStep,
    hasTempData: !!updates.tempData
  });
}

// 根據 Member ID 查找 LINE User ID（在 JWT 模式下較難實現）
export function findUserIdByMemberId(memberId: number): string | null {
  // 在 JWT 模式下，這個功能需要其他方式實現
  // 或者使用外部儲存（如 Redis）來維護這個映射
  return null;
}