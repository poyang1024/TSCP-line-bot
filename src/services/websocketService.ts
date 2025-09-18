import { io, Socket } from 'socket.io-client';
import { WebSocketMessage } from '../types';
import { getUserState } from './userService';
import { sendOrderStatusUpdate, sendWebSocketNotification } from '../handlers/notificationHandler';
import { 
  setWebSocketConnection, 
  getWebSocketConnection, 
  removeWebSocketConnection, 
  getUserIdByMemberId,
  isUserConnectedToWebSocket,
  updateWebSocketHeartbeat,
  getAllConnectedUsers
} from './redisService';

let socket: Socket | null = null;

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
  const WEBSOCKET_URL = process.env.WEBSOCKET_URL || '';
  
  console.log('🔌 初始化 WebSocket 連線...');
  
  // 這裡先建立基礎連線，實際的用戶連線會在登入時處理
}

// 驗證 WebSocket 連線參數
function validateConnectionParams(url: string, token: string): boolean {
  if (!url) {
    console.error('❌ WebSocket URL 未設置');
    return false;
  }
  
  if (!token) {
    console.error('❌ WebSocket token 未提供');
    return false;
  }
  
  // 檢查 token 格式（JWT 應該有 3 個由 . 分隔的部分）
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    console.error('❌ Token 格式不正確，應該是 JWT 格式');
    return false;
  }
  
  // 檢查 URL 格式
  try {
    new URL(url);
  } catch (error) {
    console.error('❌ WebSocket URL 格式不正確:', url);
    return false;
  }
  
  return true;
}

// 延遲重試連線
// 斷開用戶 WebSocket 連線
export async function disconnectUserWebSocket(memberId: number): Promise<void> {
  try {
    // 從 Redis 取得用戶 ID
    const userId = await getUserIdByMemberId(memberId);
    
    if (socket && userId) {
      const room = `member.delivery.medicine.${memberId}`;
      
      console.log(`🚪 準備離開房間: ${room}`);
      console.log(`👤 離開用戶: ${userId} (Member ID: ${memberId})`);
      
      // 檢查 socket 是否仍然連接後再執行操作
      if (!socket.disconnected) {
        socket.emit('leave_room', room);
        console.log(`✅ 已發送離開房間請求: ${room}`);
        
        socket.disconnect();
      } else {
        console.log(`⚠️ Socket 已斷線，跳過離開房間操作`);
      }
      
      socket = null;
      
      // 從 Redis 移除連線記錄
      const removed = await removeWebSocketConnection(userId);
      if (removed) {
        console.log(`✅ 已從 Redis 移除 WebSocket 連線記錄 - ${userId}`);
      }
      
      console.log(`🔌 用戶 WebSocket 連線已斷開 (Member ID: ${memberId})`);
    } else {
      console.log(`⚠️ 嘗試斷開不存在的連線 (Member ID: ${memberId})`);
      
      // 即使連線不存在，也要確保 Redis 中的記錄被清除
      if (userId) {
        await removeWebSocketConnection(userId);
      }
    }
  } catch (error) {
    console.error('❌ 斷開 WebSocket 連線時發生錯誤:', error);
  }
}

// 為特定用戶建立 WebSocket 連線
export async function connectUserWebSocket(userId: string, memberId: number, token: string): Promise<void> {
  const WEBSOCKET_URL = process.env.WEBSOCKET_URL || '';
  
  console.log('🔌 初始化用戶 WebSocket 連線...');
  console.log(`👤 用戶 ID: ${userId}`);
  console.log(`🆔 會員 ID: ${memberId}`);
  
  // 檢查 URL 是否已經包含 /member 路徑
  const wsUrl = WEBSOCKET_URL.endsWith('/member') ? WEBSOCKET_URL : `${WEBSOCKET_URL}/member`;
  
  // 驗證連線參數
  if (!validateConnectionParams(wsUrl, token)) {
    return;
  }
  
  // 如果用戶已經連線，先斷開舊連線
  const existingConnection = await isUserConnectedToWebSocket(userId);
  if (existingConnection) {
    console.log(`🔄 用戶 ${userId} (Member ID: ${memberId}) 已有連線，先斷開舊連線`);
    await disconnectUserWebSocket(memberId);
  }
  
  // 開始連線
  connectUserWebSocketInternal(userId, memberId, token, wsUrl);
}

// 內部連線函數
async function connectUserWebSocketInternal(userId: string, memberId: number, token: string, wsUrl: string): Promise<void> {
  console.log(`🔌 嘗試連接 WebSocket: ${wsUrl}`);
  console.log(`🔑 Token 長度: ${token?.length || 0}`);
  
  // 先進行簡單的健康檢查
  try {
    const urlCheck = new URL(wsUrl);
    console.log(`🔍 URL 檢查通過: ${urlCheck.protocol}//${urlCheck.host}${urlCheck.pathname}`);
  } catch (error) {
    console.error(`❌ WebSocket URL 格式錯誤: ${wsUrl}`);
    return;
  }
  
  socket = io(wsUrl, {
    transports: ['websocket', 'polling'], // 添加 polling 作為備選
    timeout: 10000, // 減少超時時間到 10 秒（適應 Vercel）
    reconnection: false, // 禁用自動重連（在 serverless 環境下無意義）
    forceNew: true, // 強制建立新連線
    upgrade: true, // 允許協議升級
    rememberUpgrade: false, // 不記住升級（避免狀態問題）
    auth: {
      token: token,
    },
  });
  
  socket.on('connect', async () => {
    console.log(`✅ 用戶 ${userId} WebSocket 連線成功，Member ID: ${memberId}`);
    console.log(`🔗 Socket ID: ${socket?.id}, 連線狀態: ${socket?.connected}`);
    
    // 檢查 socket 是否仍然有效
    if (!socket || socket.disconnected) {
      console.warn(`⚠️ Socket 在連線事件處理中已斷開，跳過後續處理`);
      return;
    }
    
    // 加入房間
    const room = `member.delivery.medicine.${memberId}`;
    console.log(`🏠 準備加入房間: ${room}`);
    console.log(`👤 用戶資訊: ${userId} (Member ID: ${memberId})`);
    
    try {
      socket.emit('join_room', room);
      console.log(`✅ 已發送加入房間請求: ${room}`);
      
      // 儲存連線狀態到 Redis
      const connectionSaved = await setWebSocketConnection(userId, {
        memberId: memberId,
        socketId: socket.id,
        connectedAt: Date.now(),
        accessToken: token
      });
      
      if (connectionSaved) {
        console.log(`✅ WebSocket 連線狀態已儲存到 Redis - ${userId}`);
      } else {
        console.warn(`⚠️ 無法儲存 WebSocket 連線狀態到 Redis - ${userId}`);
      }
      
      console.log(`📝 已記錄用戶連線: Member ID ${memberId} -> User ID ${userId}`);
    } catch (error) {
      console.error(`❌ 處理連線事件時發生錯誤:`, error);
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ WebSocket 連線錯誤:', error);
    console.error('❌ WebSocket URL:', wsUrl);
    console.error('❌ Token 長度:', token?.length || 0);
    console.error('❌ Error 類型:', error.constructor.name);
    console.error('❌ Error 訊息:', error.message);
    console.error('❌ Socket 狀態:', socket?.connected || 'undefined');
    
    // 檢查具體的錯誤類型
    if (error.message && error.message.includes('timeout')) {
      console.error('⏰ 連線超時 - 可能的原因:');
      console.error('   1. WebSocket 伺服器無回應或過載');
      console.error('   2. 網路連線問題');
      console.error('   3. Token 認證失敗');
      console.error('   4. 伺服器防火牆阻擋');
      console.error('   5. Vercel 冷啟動或網路限制');
    } else if (error.message && error.message.includes('401')) {
      console.error('🔒 認證失敗 - Token 可能無效或過期');
    } else if (error.message && error.message.includes('404')) {
      console.error('🔍 端點不存在 - WebSocket URL 可能錯誤');
    }
    
    // 在 Vercel serverless 環境下，不進行重試
    console.log(`🚫 在 serverless 環境下跳過重試，等待下次用戶操作`);
    
    // 清理 socket
    if (socket) {
      socket.removeAllListeners();
      socket = null;
    }
  });
  
  // 監聽訂單狀態更新
  const broadcastChannel = `member.deliveryMedicine.${memberId}`;
  console.log(`📡 開始監聽廣播頻道: ${broadcastChannel}`);
  
  socket.on(broadcastChannel, (data: WebSocketMessage) => {
    console.log(`📢 [房間: member.delivery.medicine.${memberId}] 收到 WebSocket 訊息:`);
    console.log(`📦 廣播頻道: ${broadcastChannel}`);
    console.log(`👤 目標用戶: ${userId} (Member ID: ${memberId})`);
    console.log(`📄 訊息內容:`, JSON.stringify(data, null, 2));
    console.log(`⏰ 接收時間: ${new Date().toISOString()}`);
    
    // 發送訂單狀態更新到 LINE
    sendOrderStatusUpdate(userId, data);
    
    console.log(`✅ 訊息已轉發到 LINE 用戶: ${userId}`);
  });
  
  // 監聽其他可能的直接訊息事件（只監聽真正的業務訊息）
  const possibleMessageEvents = [
    'pharmacy_message',    // 藥局訊息
    'delivery_update',     // 配送更新
    'system_notification', // 系統通知
    'urgent_message'       // 緊急訊息
  ];
  
  possibleMessageEvents.forEach(eventName => {
    socket.on(eventName, (data) => {
      console.log(`📨 [Member ID: ${memberId}] 收到重要訊息事件: ${eventName}`);
      console.log(`👤 目標用戶: ${userId}`);
      console.log(`📄 訊息內容:`, JSON.stringify(data, null, 2));
      
      // 發送到 LINE
      sendWebSocketNotification(userId, eventName, data);
      
      console.log(`✅ 重要訊息已轉發到 LINE 用戶: ${userId}`);
    });
  });
  
  // 添加其他事件監聽
  socket.on('error', (error) => {
    console.error('❌ WebSocket 錯誤:', error);
  });
  
  // 監聽所有可能的 WebSocket 事件
  socket.onAny((eventName, ...args) => {
    // 過濾掉連線事件和內部管理事件，只記錄真正的業務訊息
    const ignoredEvents = [
      'connect', 'disconnect', 'connect_error', 'reconnect', 'reconnect_error', 'reconnect_failed',
      'connection', 'join_room', 'leave_room', 'error', 'connect_timeout'  // 新增內部管理事件
    ];
    
    if (!ignoredEvents.includes(eventName)) {
      console.log(`🎯 [Member ID: ${memberId}] 收到 WebSocket 事件: ${eventName}`);
      console.log(`👤 目標用戶: ${userId}`);
      console.log(`📦 事件參數:`, args);
      console.log(`⏰ 時間: ${new Date().toISOString()}`);
      
      // 如果不是已知的廣播頻道，也嘗試處理這個訊息
      if (eventName !== broadcastChannel) {
        console.log(`📨 收到非標準廣播訊息，嘗試處理...`);
        
        // 嘗試解析訊息內容
        try {
          const messageData = args[0];
          if (messageData && typeof messageData === 'object') {
            // 發送通用 WebSocket 訊息到 LINE
            sendWebSocketNotification(userId, eventName, messageData);
          }
        } catch (error) {
          console.error(`❌ 處理非標準 WebSocket 訊息失敗:`, error);
        }
      }
    }
  });
  
  socket.on('connect_timeout', () => {
    console.error('⏰ WebSocket 連線超時');
    console.error('� 在 serverless 環境下不進行重連，等待下次請求');
  });
  
  socket.on('disconnect', async (reason) => {
    console.log(`🔌 用戶 ${userId} WebSocket 斷線，原因: ${reason}`);
    
    // 在 serverless 環境下，所有斷線都是正常的
    console.log(`🌐 WebSocket 斷線 (${reason})，這在 Vercel serverless 環境下是正常的`);
    console.log(`🔄 連線記錄保持在 Redis 中，等待下次用戶操作時重新連線`);
    
    // 清理當前 socket 但保留 Redis 記錄，以便下次重連
    if (socket) {
      socket.removeAllListeners();
      socket = null;
    }
  });
}

// 檢查並重新連線（用於用戶操作時）
export async function ensureUserWebSocketConnection(userId: string): Promise<boolean> {
  try {
    // 從 Redis 獲取用戶的 WebSocket 連線狀態
    const connection = await getWebSocketConnection(userId);
    
    if (!connection) {
      console.log(`❌ 用戶 ${userId} 未找到 WebSocket 連線記錄，無法建立連線`);
      return false;
    }
    
    const { memberId, accessToken } = connection;
    
    // 如果已經有活躍連線，不需要重連
    if (socket && socket.connected) {
      console.log(`✅ 用戶 ${userId} WebSocket 連線正常`);
      // 更新心跳時間
      await updateWebSocketHeartbeat(userId);
      return true;
    }
    
    // 如果連線已斷開但記錄還在，嘗試重新連線
    console.log(`🔄 檢測到用戶 ${userId} 連線中斷，嘗試重新連線...`);
    
    if (accessToken) {
      await connectUserWebSocket(userId, memberId, accessToken);
      return true;
    } else {
      console.error(`❌ 無法獲取用戶 ${userId} 的 access token，無法重新連線`);
      // 清理連線記錄
      await removeWebSocketConnection(userId);
      return false;
    }
  } catch (error) {
    console.error('❌ 檢查 WebSocket 連線時發生錯誤:', error);
    return false;
  }
}

// 測試 WebSocket 連線
export function testWebSocketConnection(): void {
  const WEBSOCKET_URL = process.env.WEBSOCKET_URL || '';
  
  if (!WEBSOCKET_URL) {
    console.error('❌ WEBSOCKET_URL 環境變數未設置');
    return;
  }
  
  const wsUrl = WEBSOCKET_URL.endsWith('/member') ? WEBSOCKET_URL : `${WEBSOCKET_URL}/member`;
  console.log(`🧪 測試 WebSocket 連線: ${wsUrl}`);
  
  const testSocket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
    auth: {
      token: 'test-token', // 使用測試 token
    },
  });
  
  testSocket.on('connect', () => {
    console.log('✅ WebSocket 測試連線成功');
    testSocket.disconnect();
  });
  
  testSocket.on('connect_error', (error) => {
    console.error('❌ WebSocket 測試連線失敗:', error.message);
    testSocket.disconnect();
  });
  
  testSocket.on('connect_timeout', () => {
    console.error('⏰ WebSocket 測試連線超時');
    testSocket.disconnect();
  });
}