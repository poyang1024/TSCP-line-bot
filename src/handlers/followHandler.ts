import { FollowEvent, UnfollowEvent, Client, FlexMessage } from '@line/bot-sdk';
import { updateUserRichMenu } from '../services/menuManager';

export async function handleFollow(event: FollowEvent, client: Client): Promise<void> {
  const userId = event.source.userId!;
  
  console.log(`👋 新用戶關注: ${userId}`);
  
  // 設定為訪客選單
  await updateUserRichMenu(client, userId, false);
  
  const welcomeMessage: FlexMessage = {
    type: 'flex',
    altText: '歡迎使用中藥預約服務',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🌿 歡迎使用中藥預約服務！',
            weight: 'bold',
            size: 'xl',
            color: '#27AE60'
          }
        ],
        backgroundColor: '#E8F5E8'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '感謝您加入我們的服務！',
            weight: 'bold',
            margin: 'md'
          },
          {
            type: 'text',
            text: '您可以使用下方選單：',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: '🔓 開放功能：',
            weight: 'bold',
            margin: 'md',
            color: '#27AE60'
          },
          {
            type: 'text',
            text: '• 藥師諮詢 - 專業藥師為您解答\n• 中藥新知 - 最新養生資訊\n• 了解更多 - 詳細操作說明',
            wrap: true,
            margin: 'sm',
            color: '#666666'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: '🔒 會員功能：',
            weight: 'bold',
            margin: 'md',
            color: '#E67E22'
          },
          {
            type: 'text',
            text: '• 中藥預約 - 需要先登入會員',
            wrap: true,
            margin: 'sm',
            color: '#666666'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: '🎯 建議首次使用者先註冊會員，享受完整的配藥服務！',
            wrap: true,
            margin: 'md',
            color: '#3498DB',
            weight: 'bold'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'postback',
              label: '🌿 開始使用',
              data: 'action=tutorial'
            }
          }
        ]
      }
    }
  };
  
  await client.replyMessage(event.replyToken, welcomeMessage);
}

export async function handleUnfollow(event: UnfollowEvent, client: Client): Promise<void> {
  const userId = event.source.userId!;
  
  console.log(`👋 用戶取消關注: ${userId}`);
  
  // 清除用戶資料（如果有的話）
  // 在 JWT 模式下，主要是清除暫存資料
  // clearUserTempData(userId); // 如果需要的話
}
