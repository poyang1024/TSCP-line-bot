/**
 * WebSocket 服務 - Serverless 優化版本
 * 
 * 在 Vercel serverless 環境下，WebSocket 長連線無法維持，
 * 因此改用輪詢機制來模擬即時更新功能。
 */

import { 
  setWebSocketConnection, 
  getWebSocketConnection, 
  removeWebSocketConnection, 
  getUserIdByMemberId,
  isUserConnectedToWebSocket,
  updateWebSocketHeartbeat
} from './redisService';
import { triggerNotificationCheck } from './pollingService';

// 檢查用戶是否已連線（從 Redis 查詢）
export async function isUserConnected(userId: string): Promise<boolean> {
  return await isUserConnectedToWebSocket(userId);
}

// 獲取用戶的 Member ID（從 Redis 查詢）
export async function getUserMemberId(userId: string): Promise<number | null> {
  const connection = await getWebSocketConnection(userId);
  return connection ? connection.memberId : null;
}

export function initWebSocket(): void {
  console.log('🔌 初始化 WebSocket 服務（Serverless 模式）...');
  console.log('📝 註：在 serverless 環境下使用輪詢機制替代長連線');
}

// 連線用戶（在 serverless 環境下改為狀態記錄 + 輪詢觸發）
export async function connectUserWebSocket(userId: string, memberId: number, token: string): Promise<void> {
  try {
    console.log('🔌 初始化用戶連線檢查（Polling 模式）...');
    console.log(`👤 用戶 ID: ${userId}`);
    console.log(`🆔 會員 ID: ${memberId}`);
    
    // 在 Redis 中記錄連線狀態（用於後續操作參考）
    const connectionSaved = await setWebSocketConnection(userId, {
      memberId: memberId,
      socketId: `polling-${Date.now()}`, // 使用虛擬 socket ID
      connectedAt: Date.now(),
      accessToken: token
    });
    
    if (connectionSaved) {
      console.log(`✅ 用戶連線狀態已記錄到 Redis - ${userId}`);
    }
    
    // 觸發一次通知檢查（替代 WebSocket 即時更新）
    console.log(`🔄 觸發通知檢查以替代 WebSocket 更新...`);
    await triggerNotificationCheck(userId);
    
    console.log(`📝 已記錄用戶連線: Member ID ${memberId} -> User ID ${userId}`);
    
  } catch (error) {
    console.error('❌ 初始化用戶連線時發生錯誤:', error);
  }
}

// 斷開用戶連線
export async function disconnectUserWebSocket(memberId: number): Promise<void> {
  try {
    // 從 Redis 取得用戶 ID
    const userId = await getUserIdByMemberId(memberId);
    
    if (userId) {
      console.log(`🚪 準備清理用戶連線狀態`);
      console.log(`👤 用戶: ${userId} (Member ID: ${memberId})`);
      
      // 從 Redis 移除連線記錄
      const removed = await removeWebSocketConnection(userId);
      if (removed) {
        console.log(`✅ 已從 Redis 移除連線記錄 - ${userId}`);
      }
      
      console.log(`🔌 用戶連線狀態已清理 (Member ID: ${memberId})`);
    } else {
      console.log(`⚠️ 嘗試清理不存在的連線 (Member ID: ${memberId})`);
    }
  } catch (error) {
    console.error('❌ 清理連線狀態時發生錯誤:', error);
  }
}

// 檢查並確保用戶連線（用於用戶操作時）
export async function ensureUserWebSocketConnection(userId: string): Promise<boolean> {
  try {
    // 從 Redis 獲取用戶的連線狀態
    const connection = await getWebSocketConnection(userId);
    
    if (!connection) {
      console.log(`❌ 用戶 ${userId} 未找到連線記錄，無法建立連線`);
      return false;
    }
    
    const { memberId, accessToken } = connection;
    
    if (!accessToken) {
      console.error(`❌ 無法獲取用戶 ${userId} 的 access token，無法重新連線`);
      await removeWebSocketConnection(userId);
      return false;
    }
    
    // 檢查連線記錄是否太舊（超過2小時）
    const now = Date.now();
    const connectionAge = now - connection.connectedAt;
    
    if (connectionAge > (2 * 60 * 60 * 1000)) {
      console.log(`🔄 檢測到用戶 ${userId} 連線中斷，嘗試重新連線...`);
      await connectUserWebSocket(userId, memberId, accessToken);
      return true;
    }
    
    console.log(`✅ 用戶 ${userId} 連線正常，觸發狀態檢查`);
    // 更新心跳時間
    await updateWebSocketHeartbeat(userId);
    // 觸發通知檢查
    await triggerNotificationCheck(userId);
    return true;
    
  } catch (error) {
    console.error('❌ 檢查連線時發生錯誤:', error);
    return false;
  }
}

// 測試連線（保留向後兼容性）
export function testWebSocketConnection(): void {
  console.log('🧪 WebSocket 連線測試（Serverless 模式）');
  console.log('📝 在 serverless 環境下，WebSocket 功能由輪詢機制提供');
}

// 獲取所有連線的用戶（保留向後兼容性）
export async function getAllConnectedUsers(): Promise<string[]> {
  // 這個功能在 polling 模式下沒有意義，返回空數組
  return [];
}
