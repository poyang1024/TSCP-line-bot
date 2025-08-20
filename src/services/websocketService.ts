import { io, Socket } from 'socket.io-client';
import { WebSocketMessage } from '../types';
import { getUserState } from './userService';
import { sendOrderStatusUpdate } from '../handlers/notificationHandler';

let socket: Socket | null = null;
const connectedUsers = new Map<number, string>(); // memberId -> userId

// 檢查用戶是否已連線
export function isUserConnected(userId: string): boolean {
  // 檢查是否有任何 memberId 對應到這個 userId
  for (const [memberId, connectedUserId] of connectedUsers.entries()) {
    if (connectedUserId === userId) {
      return true;
    }
  }
  return false;
}

// 獲取用戶的 Member ID（如果已連線）
export function getUserMemberId(userId: string): number | null {
  for (const [memberId, connectedUserId] of connectedUsers.entries()) {
    if (connectedUserId === userId) {
      return memberId;
    }
  }
  return null;
}

export function initWebSocket(): void {
  const WEBSOCKET_URL = process.env.WEBSOCKET_URL || '';
  
  console.log('🔌 初始化 WebSocket 連線...');
  
  // 這裡先建立基礎連線，實際的用戶連線會在登入時處理
}

// 為特定用戶建立 WebSocket 連線
export function connectUserWebSocket(userId: string, memberId: number, token: string): void {
  const WEBSOCKET_URL = process.env.WEBSOCKET_URL || '';
  
  if (!WEBSOCKET_URL) {
    console.error('❌ WEBSOCKET_URL 環境變數未設置');
    return;
  }
  
  if (!token) {
    console.error('❌ WebSocket token 未提供');
    return;
  }
  
  // 如果用戶已經連線，先斷開舊連線
  if (connectedUsers.has(memberId)) {
    console.log(`🔄 用戶 ${userId} (Member ID: ${memberId}) 已有連線，先斷開舊連線`);
    disconnectUserWebSocket(memberId);
  }
  
  // 檢查 URL 是否已經包含 /member 路徑
  const wsUrl = WEBSOCKET_URL.endsWith('/member') ? WEBSOCKET_URL : `${WEBSOCKET_URL}/member`;
  
  console.log(`🔌 嘗試連接 WebSocket: ${wsUrl}`);
  
  socket = io(wsUrl, {
    transports: ['websocket'],
    timeout: 5000,
    auth: {
      token: token,
    },
  });
  
  socket.on('connect', () => {
    console.log(`✅ 用戶 ${userId} WebSocket 連線成功，Member ID: ${memberId}`);
    
    // 加入房間
    const room = `member.delivery.medicine.${memberId}`;
    console.log(`🏠 加入房間: ${room}`);
    socket!.emit('join_room', room);
    
    // 記錄連線
    connectedUsers.set(memberId, userId);
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ WebSocket 連線錯誤:', error);
    console.error('❌ WebSocket URL:', wsUrl);
    console.error('❌ Token 長度:', token?.length || 0);
  });
  
  // 監聽訂單狀態更新
  const broadcastChannel = `member.deliveryMedicine.${memberId}`;
  socket.on(broadcastChannel, (data: WebSocketMessage) => {
    console.log(`📢 收到訂單狀態更新:`, data);
    sendOrderStatusUpdate(userId, data);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 用戶 ${userId} WebSocket 斷線`);
    connectedUsers.delete(memberId);
    socket = null;
  });
  
  // 添加其他事件監聽
  socket.on('error', (error) => {
    console.error('❌ WebSocket 錯誤:', error);
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 WebSocket 重新連線成功 (嘗試 ${attemptNumber} 次)`);
  });
  
  socket.on('reconnect_error', (error) => {
    console.error('❌ WebSocket 重新連線錯誤:', error);
  });
}

// 斷開用戶 WebSocket 連線
export function disconnectUserWebSocket(memberId: number): void {
  if (socket && connectedUsers.has(memberId)) {
    const room = `member.delivery.medicine.${memberId}`;
    socket.emit('leave_room', room);
    socket.disconnect();
    socket = null;
    connectedUsers.delete(memberId);
  }
}