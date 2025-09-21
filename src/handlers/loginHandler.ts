import { MessageEvent, PostbackEvent, Client, TextMessage, FlexMessage } from '@line/bot-sdk';
import { getUserState, ensureUserState, updateUserState } from '../services/userService';
import { loginMember, changePassword } from '../services/apiService';
import { connectUserWebSocket, disconnectUserWebSocket } from '../services/websocketService';
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
                label: '會員登入',
                uri: `${baseUrl}/login?userId=${userId}&action=login`
              },
              style: 'secondary',
              margin: 'md'
            },
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '註冊新帳號',
                uri: `${baseUrl}/login?userId=${userId}&action=register`
              },
              style: 'link',
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
              style: 'secondary',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'lg'
            },

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
              text: '開發環境：訊息登入模式',
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


// 處理登入選單的 Postback 事件
export async function handleLoginPostback(event: PostbackEvent, client: Client): Promise<void> {
  const userId = event.source.userId!;
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  // 首先確保用戶狀態是最新的
  await ensureUserState(userId);
  const currentState = getUserState(userId);
  
  if (currentState.memberId && currentState.accessToken) {
    console.log('用戶已登入，跳過登入流程');
    
    // 更新圖文選單
    try {
      await updateUserRichMenu(client, userId, true);
    } catch (menuError) {
      console.error('更新圖文選單失敗:', menuError);
    }
    
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `🎉 歡迎回來，${currentState.memberName}！\n\n您已成功登入，現在可以使用所有會員功能。`
    });
    return;
  }

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
  
  // 確保用戶狀態是最新的
  await ensureUserState(userId);
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
    await performLogin(userId, account, text, event, client);
  }
}

// 執行登入邏輯
async function performLogin(
  userId: string,
  identifier: string | undefined,
  password: string,
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
    // 呼叫登入 API，傳送 LINE ID 給後台
    const member = await loginMember(identifier, password, userId);
    
    if (member) {
      console.log('✅ 帳號密碼登入成功');
      console.log('👤 會員 ID:', member.user_id);
      console.log('👤 會員名稱:', member.name);
      console.log('👤 會員帳號:', member.account);
      console.log('🔑 Access Token 長度:', member.access_token?.length || 0);
      console.log('📞 會員電話:', member.info?.phone || '未提供');
      console.log('📍 會員地址:', member.info?.address || '未提供');
      
      // 建立 JWT Token
      createUserToken(userId, member.user_id, member.access_token, member.name);
      
      // 清除用戶狀態和暫存資料，並保存會員資訊（包含個人資訊）
      updateUserState(userId, { 
        currentStep: undefined, 
        tempData: {
          // 保存會員的個人資訊
          memberPersonalInfo: {
            phone: member.info?.phone,
            address: member.info?.address
          }
        },
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
      await connectUserWebSocket(userId, member.user_id, member.access_token);
      
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

// 處理修改密碼流程 (開發環境)
export async function handlePasswordChange(event: MessageEvent, client: Client): Promise<void> {
  const userId = event.source.userId!;
  const userState = getUserState(userId); // 使用同步版本
  const message = event.message as TextMessage;
  const text = message.text.trim();
  
  if (userState.currentStep === 'waiting_old_password') {
    // 儲存舊密碼，要求新密碼
    updateUserState(userId, {
      currentStep: 'waiting_new_password',
      tempData: { 
        ...userState.tempData,
        old_password: text 
      }
    });
    
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🔐 請輸入您的新密碼：\n\n⚠️ 密碼長度須為 1-20 字元'
    });
    
  } else if (userState.currentStep === 'waiting_new_password') {
    // 驗證新密碼長度
    if (text.length < 1 || text.length > 20) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 新密碼長度必須為 1-20 字元，請重新輸入：'
      });
      return;
    }
    
    // 儲存新密碼，要求確認密碼
    updateUserState(userId, {
      currentStep: 'waiting_confirm_password',
      tempData: { 
        ...userState.tempData,
        new_password: text 
      }
    });
    
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🔐 請再次輸入新密碼以確認：'
    });
    
  } else if (userState.currentStep === 'waiting_confirm_password') {
    const oldPassword = userState.tempData?.old_password;
    const newPassword = userState.tempData?.new_password;
    const memberInfo = userState.tempData?.memberInfo;
    
    // 驗證密碼確認
    if (text !== newPassword) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 兩次輸入的新密碼不一致，請重新輸入確認密碼：'
      });
      return;
    }
    
    if (!oldPassword || !newPassword || !memberInfo?.accessToken) {
      updateUserState(userId, { currentStep: undefined, tempData: undefined });
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 修改密碼流程發生錯誤，請重新開始。'
      });
      return;
    }
    
    // 執行密碼修改
    await performPasswordChange(userId, memberInfo.accessToken, oldPassword, newPassword, event, client);
  }
}

// 執行密碼修改邏輯
async function performPasswordChange(
  userId: string,
  accessToken: string,
  oldPassword: string,
  newPassword: string,
  event: MessageEvent,
  client: Client
): Promise<void> {
  try {
    // 呼叫變更密碼 API
    const result = await changePassword(accessToken, oldPassword, newPassword);
    
    if (result.success) {
      // 取得用戶狀態中的 memberId
      const userState = getUserState(userId);
      const memberId = userState.memberId;
      
      // 自動登出：清除用戶狀態
      updateUserState(userId, {
        currentStep: undefined,
        tempData: undefined,
        memberId: undefined,
        accessToken: undefined,
        memberName: undefined
      });
      
      // 斷開 WebSocket 連線
      if (memberId) {
        disconnectUserWebSocket(memberId);
      }
      
      // 切換回訪客選單
      try {
        await updateUserRichMenu(client, userId, false);
        console.log(`✅ Rich Menu 已切換為訪客模式 - ${userId}`);
      } catch (menuError) {
        console.error(`⚠️ Rich Menu 切換失敗:`, menuError);
      }
      
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🎉 密碼修改成功！\n\n為了安全考量，系統已自動登出\n\n✅ 請使用新密碼重新登入\n✅ 選單已切換為訪客模式'
      });
      
    } else {
      // 密碼修改失敗，清除流程
      updateUserState(userId, { currentStep: undefined, tempData: undefined });
      
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `❌ 密碼修改失敗：${result.message || '請檢查舊密碼是否正確'}\n\n如需重新修改，請使用會員中心功能。`
      });
    }
  } catch (error) {
    console.error('修改密碼錯誤:', error);
    
    // 重置用戶狀態
    updateUserState(userId, { currentStep: undefined, tempData: undefined });
    
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '❌ 系統錯誤，請稍後再試。\n\n如果問題持續發生，請聯絡客服。'
    });
  }
}