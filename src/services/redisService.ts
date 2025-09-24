import { createClient, RedisClientType } from 'redis';

// Redis 客戶端實例
let redisClient: RedisClientType | null = null;

/**
 * 初始化 Redis 連線
 */
export async function initRedis(): Promise<void> {
  try {
    if (!process.env.REDIS_URL) {
      console.error('❌ REDIS_URL 環境變數未設置');
      return;
    }

    console.log('🔌 正在初始化 Redis 連線...');
    
    redisClient = createClient({ 
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 10000,
      }
    });

    // 錯誤處理
    redisClient.on('error', (err) => {
      console.error('❌ Redis 連線錯誤:', err);
    });

    redisClient.on('connect', () => {
      console.log('🔌 Redis 正在連線...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis 連線就緒');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis 正在重新連線...');
    });

    redisClient.on('end', () => {
      console.log('🔌 Redis 連線已關閉');
    });

    // 建立連線
    await redisClient.connect();
    
    // 等待連線完全就緒
    if (!redisClient.isReady) {
      await new Promise((resolve) => {
        redisClient!.once('ready', resolve);
      });
    }
    
    console.log('✅ Redis 初始化完成');
  } catch (error) {
    console.error('❌ Redis 初始化失敗:', error);
    redisClient = null;
  }
}

/**
 * 取得 Redis 客戶端
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * 檢查 Redis 是否可用
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.isReady;
}

/**
 * 安全地執行 Redis 操作
 */
async function safeRedisOperation<T>(operation: () => Promise<T>): Promise<T | null> {
  if (!isRedisAvailable()) {
    console.warn('⚠️ Redis 不可用，跳過操作');
    return null;
  }

  try {
    return await operation();
  } catch (error) {
    console.error('❌ Redis 操作失敗:', error);
    return null;
  }
}

// ==================== 登入狀態管理 ====================

/**
 * 儲存用戶登入狀態
 */
export async function setUserLoginState(userId: string, loginData: {
  memberId: number;
  accessToken: string;
  memberName: string;
  loginTime: number;
}): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    const key = `login:${userId}`;
    const data = JSON.stringify(loginData);
    // 設置 7 天過期時間，與 JWT 一致
    await redisClient!.setEx(key, 7 * 24 * 60 * 60, data);
    return true;
  });
  
  return result !== null;
}

/**
 * 取得用戶登入狀態
 */
export async function getUserLoginState(userId: string): Promise<{
  memberId: number;
  accessToken: string;
  memberName: string;
  loginTime: number;
} | null> {
  const result = await safeRedisOperation(async () => {
    const key = `login:${userId}`;
    const data = await redisClient!.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      return JSON.parse(data as string);
    } catch (error) {
      console.error('❌ 解析登入狀態 JSON 失敗:', error);
      return null;
    }
  });
  
  return result;
}

/**
 * 檢查用戶是否已登入
 */
export async function isUserLoggedIn(userId: string): Promise<boolean> {
  const loginState = await getUserLoginState(userId);
  return loginState !== null;
}

/**
 * 刪除用戶登入狀態
 */
export async function removeUserLoginState(userId: string): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    const key = `login:${userId}`;
    const deleted = await redisClient!.del(key);
    return deleted > 0;
  });
  
  return result !== null && result;
}

/**
 * 更新登入狀態的過期時間（延長 session）
 */
export async function extendUserLoginSession(userId: string): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    const key = `login:${userId}`;
    const exists = await redisClient!.exists(key);
    
    if (exists) {
      // 延長到 7 天
      await redisClient!.expire(key, 7 * 24 * 60 * 60);
      return true;
    }
    
    return false;
  });
  
  return result !== null && result;
}


// ==================== 部署版本管理 ====================

/**
 * 設置當前部署版本
 */
export async function setDeploymentVersion(version: string): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    const key = 'deployment:version';
    await redisClient!.set(key, version);
    return true;
  });
  
  return result !== null;
}

/**
 * 取得當前部署版本
 */
export async function getDeploymentVersion(): Promise<string | null> {
  const result = await safeRedisOperation(async () => {
    const key = 'deployment:version';
    const data = await redisClient!.get(key);
    return data as string | null;
  });
  
  return result;
}

/**
 * 檢查是否為新部署（版本不同）
 */
export async function checkNewDeployment(currentVersion: string): Promise<boolean> {
  const storedVersion = await getDeploymentVersion();
  
  if (!storedVersion) {
    // 第一次部署，設置版本
    await setDeploymentVersion(currentVersion);
    return true;
  }
  
  if (storedVersion !== currentVersion) {
    // 版本不同，表示重新部署
    await setDeploymentVersion(currentVersion);
    return true;
  }
  
  return false;
}

/**
 * 清除所有登入狀態（重新部署時使用）
 */
export async function clearAllLoginStates(): Promise<number> {
  const result = await safeRedisOperation(async () => {
    // 取得所有登入狀態的 key
    const keys = await redisClient!.keys('login:*');
    
    if (keys.length === 0) {
      return 0;
    }
    
    // 批量刪除
    const deleted = await redisClient!.del(keys);
    return deleted;
  });
  
  return result || 0;
}

/**
 * 清除所有 WebSocket 連線狀態（重新部署時使用）
 */
export async function clearAllWebSocketConnections(): Promise<number> {
  const result = await safeRedisOperation(async () => {
    // 取得所有 WebSocket 連線狀態的 key
    const wsKeys = await redisClient!.keys('websocket:*');
    
    if (wsKeys.length === 0) {
      return 0;
    }
    
    // 批量刪除
    const deleted = await redisClient!.del(wsKeys);
    return deleted;
  });
  
  return result || 0;
}

/**
 * 設置鍵值對
 */
export async function setRedisValue(key: string, value: string, expireInSeconds?: number): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    if (expireInSeconds) {
      await redisClient!.setEx(key, expireInSeconds, value);
    } else {
      await redisClient!.set(key, value);
    }
    return true;
  });
  
  return result !== null;
}

/**
 * 取得鍵值
 */
export async function getRedisValue(key: string): Promise<string | null> {
  const result = await safeRedisOperation(async () => {
    const data = await redisClient!.get(key);
    return data as string | null;
  });
  
  return result;
}

/**
 * 刪除鍵
 */
export async function deleteRedisKey(key: string): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    const deleted = await redisClient!.del(key);
    return deleted > 0;
  });
  
  return result !== null && result;
}

/**
 * 檢查鍵是否存在
 */
export async function keyExists(key: string): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    const exists = await redisClient!.exists(key);
    return exists > 0;
  });
  
  return result !== null && result;
}

// ==================== 輪詢時間管理 ====================

/**
 * 設置用戶最後輪詢時間
 */
export async function setUserLastPollTime(userId: string, timestamp: number): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    const key = `poll_time:${userId}`;
    await redisClient!.setEx(key, 3600, timestamp.toString()); // 1小時過期
    return true;
  });
  
  return result !== null;
}

/**
 * 獲取用戶最後輪詢時間
 */
export async function getUserLastPollTime(userId: string): Promise<number | null> {
  const result = await safeRedisOperation(async () => {
    const key = `poll_time:${userId}`;
    const timestamp = await redisClient!.get(key);
    return timestamp ? parseInt(timestamp as string, 10) : null;
  });
  
  return result;
}

// ==================== 通知檢查時間管理 ====================

/**
 * 設置用戶最後通知檢查時間
 */
export async function setUserLastNotificationCheck(userId: string, timestamp: number): Promise<boolean> {
  const result = await safeRedisOperation(async () => {
    const key = `notification_check:${userId}`;
    await redisClient!.setEx(key, 86400, timestamp.toString()); // 24小時過期
    return true;
  });
  
  return result !== null;
}

/**
 * 獲取用戶最後通知檢查時間
 */
export async function getUserLastNotificationCheck(userId: string): Promise<number | null> {
  const result = await safeRedisOperation(async () => {
    const key = `notification_check:${userId}`;
    const timestamp = await redisClient!.get(key);
    return timestamp ? parseInt(timestamp as string, 10) : null;
  });
  
  return result;
}

/**
 * 關閉 Redis 連線
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis 連線已關閉');
    } catch (error) {
      console.error('❌ 關閉 Redis 連線時發生錯誤:', error);
    } finally {
      redisClient = null;
    }
  }
}
