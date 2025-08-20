import { Client } from '@line/bot-sdk';
import { WebSocketMessage, OrderState } from '../types';

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
      case OrderState.RECEIVED:
        notificationText += '藥局已收到您的訂單，正在處理中...';
        break;
      case OrderState.SUPPLEMENT:
        notificationText += '⚠️ 藥局需要您補充資料，請查看訂單詳情或聯絡藥局。';
        break;
      case OrderState.REJECTED:
        notificationText += '❌ 很抱歉，藥局無法處理此訂單。請查看拒絕原因或聯絡藥局。';
        break;
      case OrderState.SCHEDULED:
        notificationText += '✅ 藥局已安排配藥時程，請耐心等候製作完成。';
        break;
      case OrderState.CANCELLED:
        notificationText += '🚫 訂單已取消。如有疑問請聯絡藥局。';
        break;
      case OrderState.COMPLETED:
        notificationText += '🎉 配藥完成！請依約定時間前往取藥或等候外送。';
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
    case OrderState.RECEIVED: return '已收單';
    case OrderState.SUPPLEMENT: return '需補單';
    case OrderState.REJECTED: return '已拒單';
    case OrderState.SCHEDULED: return '已排單';
    case OrderState.CANCELLED: return '已取消';
    case OrderState.COMPLETED: return '已完成';
    default: return '未知狀態';
  }
}

function getOrderStateEmoji(state: number): string {
  switch (state) {
    case OrderState.RECEIVED: return '📥';
    case OrderState.SUPPLEMENT: return '📝';
    case OrderState.REJECTED: return '❌';
    case OrderState.SCHEDULED: return '⏰';
    case OrderState.CANCELLED: return '🚫';
    case OrderState.COMPLETED: return '✅';
    default: return '❓';
  }
}