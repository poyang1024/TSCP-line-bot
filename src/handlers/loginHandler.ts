import { MessageEvent, PostbackEvent, Client, TextMessage, FlexMessage } from '@line/bot-sdk';
import { getUserState, updateUserState, updateUserTempData } from '../services/userService';
import { loginMember } from '../services/apiService';
import { connectUserWebSocket } from '../services/websocketService';
import { createMainMenu } from '../templates/messageTemplates';
import { createUserToken } from '../services/jwtService';
import { updateUserRichMenu } from '../services/menuManager';

// 創建登入選單
export function createLoginMenu(userId: string): FlexMessage {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://tscp-line-bot.vercel.app' 
    : `http://localhost:${process.env.PORT || 3000}`;
  
  if (isProduction) {
    // 生產環境：使用網頁登入
    return {
      type: 'flex' as const,
      altText: '會員登入選單',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🔐 會員登入',
              weight: 'bold',
              size: 'xl',
              color: '#ffffff',
              align: 'center'
            }
          ],
          backgroundColor: '#007bff',
          paddingAll: 'md'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '請點選下方按鈕進行會員管理',
              size: 'md',
              color: '#666666',
              align: 'center',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '🔑 會員登入',
                uri: `${baseUrl}/login?userId=${userId}&action=login`
              },
              style: 'primary',
              color: '#007bff',
              margin: 'lg'
            },
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '📝 註冊新帳號',
                uri: `${baseUrl}/login?userId=${userId}&action=register`
              },
              style: 'secondary',
              margin: 'md'
            },
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '🔐 修改密碼',
                uri: `${baseUrl}/login?userId=${userId}&action=password`
              },
              style: 'link',
              margin: 'md'
            }
          ],
          spacing: 'sm',
          paddingAll: 'lg'
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '安全提示：請在官方頁面進行登入操作',
              size: 'xs',
              color: '#aaaaaa',
              align: 'center'
            }
          ],
          paddingAll: 'sm'
        }
      }
    };
  } else {
    // 開發環境：使用傳統 LINE 訊息登入
    return {
      type: 'flex' as const,
      altText: '會員登入選單',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🔐 會員登入',
              weight: 'bold',
              size: 'xl',
              color: '#ffffff',
              align: 'center'
            }
          ],
          backgroundColor: '#007bff',
          paddingAll: 'md'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '請選擇您的登入方式',
              size: 'md',
              color: '#666666',
              align: 'center',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label: '👤 帳號密碼登入',
                data: `action=account_login&userId=${userId}`
              },
              style: 'primary',
              color: '#007bff',
              margin: 'lg'
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '🌐 網頁登入 (測試)',
                uri: `${baseUrl}/login?userId=${userId}&action=login`
              },
              style: 'link',
              margin: 'md'
            }
          ],
          spacing: 'sm',
          paddingAll: 'lg'
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '開發環境：支援兩種登入方式',
              size: 'xs',
              color: '#aaaaaa',
              align: 'center'
            }
          ],
          paddingAll: 'sm'
        }
      }
    };
  }
}

// 產生 LINE Login URL (預留功能)
export function generateLineLoginUrl(userId: string, state?: string): string {
  const channelId = process.env.LINE_CHANNEL_ID;
  const redirectUri = encodeURIComponent(process.env.LINE_LOGIN_REDIRECT_URI || '');
  const stateParam = state || userId;
  
  return `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${stateParam}&scope=profile%20openid`;
}

// 處理登入選單的 Postback 事件
export async function handleLoginPostback(event: PostbackEvent, client: Client): Promise<void> {
  const userId = event.source.userId!;
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  switch (action) {
    case 'account_login':
      updateUserState(userId, { 
        currentStep: 'waiting_account',
        loginMethod: 'account'
      });
      
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🔑 請輸入您的帳號：'
      });
      break;

    default:
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 無效的登入選項，請重新選擇。'
      });
  }
}

export async function handleLogin(event: MessageEvent, client: Client): Promise<void> {
  const userId = event.source.userId!;
  const userState = getUserState(userId);
  const message = event.message as TextMessage;
  const text = message.text.trim();
  
  // 帳號密碼登入流程
  if (userState.currentStep === 'waiting_account') {
    // 儲存帳號，要求密碼
    updateUserState(userId, {
      currentStep: 'waiting_password',
      tempData: { account: text }
    });
    
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🔐 請輸入您的密碼：'
    });
    
  } else if (userState.currentStep === 'waiting_password') {
    // 帳號密碼登入
    const account = userState.tempData?.account;
    await performLogin(userId, account, text, 'account', event, client);
  }
}

// 執行登入邏輯
async function performLogin(
  userId: string, 
  identifier: string | undefined, 
  password: string, 
  method: string,
  event: MessageEvent, 
  client: Client
): Promise<void> {
  if (!identifier) {
    updateUserState(userId, { currentStep: undefined, tempData: undefined });
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 登入流程發生錯誤，請重新開始。'
    });
    return;
  }
  
  try {
    // 呼叫登入 API
    const member = await loginMember(identifier, password);
    
    if (member) {
      // 建立 JWT Token
      const token = createUserToken(userId, member.user_id, member.access_token, member.name);
      
      // 清除用戶狀態和暫存資料，並保存會員資訊
      updateUserState(userId, { 
        currentStep: undefined, 
        tempData: undefined,
        memberId: member.user_id,
        accessToken: member.access_token,
        memberName: member.name
      });
      
      // 嘗試切換到會員選單，但不讓失敗影響登入流程
      try {
        await updateUserRichMenu(client, userId, true);
        console.log(`✅ Rich Menu 更新成功`);
      } catch (menuError) {
        console.error(`⚠️ Rich Menu 更新失敗，但不影響登入:`, menuError);
      }
      
      // 建立 WebSocket 連線
      connectUserWebSocket(userId, member.user_id, member.access_token);
      
      // 發送簡化的登入成功訊息
      const successMessage = {
        type: 'text' as const,
        text: `🎉 登入成功！\n\n歡迎回來，${member.name}！\n\n✅ 已切換到會員模式\n✅ 現在可以使用中藥預約功能\n✅ 請使用下方選單開始服務`
      };

      try {
        await client.replyMessage(event.replyToken, successMessage);
        console.log(`✅ 登入成功訊息已發送`);
      } catch (replyError) {
        console.error(`❌ 發送登入成功訊息失敗:`, replyError);
        // 如果回覆失敗，嘗試推送訊息
        try {
          await client.pushMessage(userId, successMessage);
          console.log(`✅ 登入成功訊息已推送`);
        } catch (pushError) {
          console.error(`❌ 推送登入成功訊息也失敗:`, pushError);
        }
      }
      
    } else {
      // 登入失敗
      updateUserState(userId, { currentStep: undefined, tempData: undefined });
      
      // 確保選單為訪客模式
      try {
        await updateUserRichMenu(client, userId, false);
      } catch (menuError) {
        console.error(`⚠️ 重置 Rich Menu 失敗:`, menuError);
      }
      
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 登入失敗，請檢查帳號密碼是否正確。\n\n如需重新登入，請使用下方選單的「中藥預約」功能。'
      });
    }
  } catch (error) {
    console.error('登入錯誤:', error);
    
    // 重置用戶狀態
    updateUserState(userId, { currentStep: undefined, tempData: undefined });
    
    const errorMessage = {
      type: 'text' as const,
      text: '❌ 系統錯誤，請稍後再試。\n\n如果問題持續發生，請聯絡客服。'
    };

    try {
      await client.replyMessage(event.replyToken, errorMessage);
    } catch (replyError) {
      console.error('❌ 發送錯誤訊息失敗:', replyError);
      try {
        await client.pushMessage(userId, errorMessage);
      } catch (pushError) {
        console.error('❌ 推送錯誤訊息也失敗:', pushError);
      }
    }
  }
}