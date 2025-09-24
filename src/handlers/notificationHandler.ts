import { Client } from '@line/bot-sdk';
import { WebSocketMessage, OrderState } from '../types';
import { Notification } from '../services/apiService';

// 建立 LINE Bot 客戶端的函數（延遲初始化）
function getClient(): Client {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  });
}

// 發送訂單狀態更新通知
export async function sendOrderStatusUpdate(userId: string, message: WebSocketMessage): Promise<void> {
  try {
    const stateText = getOrderStateText(message.state);
    const statusEmoji = getOrderStateEmoji(message.state);
    
    let notificationText = `${statusEmoji} 訂單狀態更新\n\n`;
    notificationText += `📋 訂單編號：${message.order_code}\n`;
    notificationText += `📊 最新狀態：${stateText}\n\n`;
    
    // 根據不同狀態提供不同的提示訊息
    switch (message.state) {
      case OrderState.REJECTED:
        notificationText += '❌ 很抱歉，藥局無法處理此訂單。請查看拒絕原因或聯絡藥局。';
        break;
      case OrderState.CANCELLED:
        notificationText += '🚫 訂單已取消。如有疑問請聯絡藥局。';
        break;
      case OrderState.COMPLETED:
        notificationText += '🎉 配藥完成！請依約定時間前往取藥或等候外送。';
        break;
      case OrderState.RESERVED:
        notificationText += '📅 您的預約已確認，請依約定時間前往藥局。';
        break;
      case OrderState.PROCESSING:
        notificationText += '⚡ 藥局正在處理您的訂單，請耐心等候...';
        break;
      case OrderState.READY:
        notificationText += '📦 您的藥品已備妥，請前往藥局取藥！';
        break;
    }
    
    // 推送訊息給用戶
    const client = getClient();
    await client.pushMessage(userId, [
      {
        type: 'text',
        text: notificationText
      },
      {
        type: 'template',
        altText: '訂單操作',
        template: {
          type: 'buttons',
          title: '📋 訂單操作',
          text: '您可以進行以下操作：',
          actions: [
            {
              type: 'postback',
              label: '📋 查看訂單詳情',
              data: `action=view_order_detail&order_id=${message.id}`
            },
            {
              type: 'message',
              label: '📞 聯絡藥局',
              text: '聯絡藥局'
            },
            {
              type: 'message',
              label: '🏠 回到主選單',
              text: '主選單'
            }
          ]
        }
      }
    ]);
    
    console.log(`✅ 已發送訂單狀態更新通知給用戶 ${userId}`);
    
  } catch (error) {
    console.error('發送訂單狀態更新通知失敗:', error);
  }
}



// 發送通用 WebSocket 訊息通知
export async function sendWebSocketNotification(userId: string, eventName: string, messageData: any): Promise<void> {
  try {
    console.log(`📧 準備發送通用 WebSocket 通知給用戶 ${userId}`);
    console.log(`📡 事件名稱: ${eventName}`);
    console.log(`📦 訊息內容:`, messageData);
    
    let notificationText = `📨 收到新訊息\n\n`;
    notificationText += `📡 事件類型：${eventName}\n`;
    notificationText += `⏰ 時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n\n`;
    
    // 嘗試解析並顯示訊息內容
    if (messageData) {
      if (typeof messageData === 'string') {
        notificationText += `💬 訊息：${messageData}`;
      } else if (typeof messageData === 'object') {
        // 如果是物件，嘗試提取有用的資訊
        if (messageData.message) {
          notificationText += `💬 訊息：${messageData.message}\n`;
        }
        if (messageData.title) {
          notificationText += `📌 標題：${messageData.title}\n`;
        }
        if (messageData.content) {
          notificationText += `📄 內容：${messageData.content}\n`;
        }
        if (messageData.order_code) {
          notificationText += `📋 訂單：${messageData.order_code}\n`;
        }
        
        // 如果沒有找到特定欄位，顯示 JSON 字符串（截斷過長的內容）
        if (!messageData.message && !messageData.title && !messageData.content) {
          const jsonString = JSON.stringify(messageData, null, 2);
          const truncatedJson = jsonString.length > 200 ? jsonString.substring(0, 200) + '...' : jsonString;
          notificationText += `📦 資料：\n${truncatedJson}`;
        }
      }
    }
    
    // 推送訊息給用戶
    const client = getClient();
    await client.pushMessage(userId, {
      type: 'text',
      text: notificationText
    });
    
    console.log(`✅ 已發送通用 WebSocket 通知給用戶 ${userId}`);
    
  } catch (error) {
    console.error(`❌ 發送通用 WebSocket 通知失敗:`, error);
  }
}

// 發送製作完成通知
export async function sendCompletionNotification(userId: string, orderCode: string, pickupInfo: string): Promise<void> {
  try {
    let completionText = `🎉 配藥完成通知\n\n`;
    completionText += `您的中藥已製作完成！\n\n`;
    completionText += `📋 訂單編號：${orderCode}\n`;
    completionText += `📍 取藥資訊：${pickupInfo}\n\n`;
    completionText += `請依約定時間前往取藥，謝謝您的使用！`;
    
    const client = getClient();
    await client.pushMessage(userId, {
      type: 'text',
      text: completionText
    });
    
    console.log(`✅ 已發送製作完成通知給用戶 ${userId}`);
    
  } catch (error) {
    console.error('發送製作完成通知失敗:', error);
  }
}

function getOrderStateText(state: number): string {
  switch (state) {
    case OrderState.REJECTED: return '已拒單';
    case OrderState.CANCELLED: return '已取消';
    case OrderState.COMPLETED: return '已完成';
    case OrderState.RESERVED: return '已預約';
    case OrderState.PROCESSING: return '處理中';
    case OrderState.READY: return '可取貨';
    default: return '未知狀態';
  }
}

function getOrderStateEmoji(state: number): string {
  switch (state) {
    case OrderState.REJECTED: return '❌';
    case OrderState.CANCELLED: return '🚫';
    case OrderState.COMPLETED: return '✅';
    case OrderState.RESERVED: return '📅';
    case OrderState.PROCESSING: return '⚡';
    case OrderState.READY: return '📦';
    default: return '❓';
  }
}

// ==================== 新通知 API 處理 ====================

/**
 * 發送通知 (使用新的通知 API)
 */
export async function sendNotification(userId: string, notification: Notification): Promise<void> {
  try {
    const client = getClient();
    
    // 根據通知類型決定emoji和格式
    let emoji = '📢';
    let notificationText = '';
    
    // 如果通知與訂單相關，使用特殊格式
    if (notification.record && notification.record.type === 0 && notification.record.order_code) {
      // 訂單相關通知
      emoji = '📋';
      notificationText = `${emoji} ${notification.subject}\n\n`;
      notificationText += `📋 訂單編號：${notification.record.order_code}\n`;
      notificationText += `💬 ${notification.content}\n\n`;
      notificationText += `⏰ 通知時間：${new Date(notification.created_at * 1000).toLocaleString('zh-TW')}`;
    } else {
      // 一般通知
      notificationText = `${emoji} ${notification.subject}\n\n`;
      notificationText += `💬 ${notification.content}\n\n`;
      notificationText += `⏰ 通知時間：${new Date(notification.created_at * 1000).toLocaleString('zh-TW')}`;
      
      if (notification.sender) {
        const senderType = notification.sender.type === 0 ? '會員系統' : '管理系統';
        notificationText += `\n👤 來自：${notification.sender.name} (${senderType})`;
      }
    }
    
    await client.pushMessage(userId, {
      type: 'text',
      text: notificationText
    });
    
    console.log(`✅ 已發送通知給用戶 ${userId}: ${notification.subject}`);
    
  } catch (error) {
    console.error('❌ 發送通知失敗:', error);
    throw error;
  }
}