import { MessageEvent, PostbackEvent, Client, TextMessage, FlexMessage } from '@line/bot-sdk';
import { getUserState, updateUserState, updateUserTempData } from '../services/userService';
import { loginMember, changePassword, loginWithLine } from '../services/apiService';
import { connectUserWebSocket, disconnectUserWebSocket } from '../services/websocketService';
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
                type: 'postback',
                label: 'LINE 直接登入 (即將開放)',
                data: `action=line_direct_login&userId=${userId}`
              },
              style: 'primary',
              color: '#00C851',
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
                label: 'LINE 直接登入 (即將開放)',
                data: `action=line_direct_login&userId=${userId}`
              },
              style: 'primary',
              color: '#00C851',
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
    case 'line_direct_login':
      console.log('🚀 開始處理 LINE 直接登入');
      console.log('👤 User ID:', userId);
      
      // LINE 直接登入功能即將開放
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🔗 LINE 直接登入功能即將開放！\n\n目前請使用「會員登入」或「帳號密碼登入」來使用服務。\n\n感謝您的耐心等候。'
      });
      // 原本預計實作的 LINE 直接登入流程如下（暫時註解）
      // text: '🔗 正在使用 LINE 帳號登入，請稍候...'
      
      // try {
      //   console.log('📞 呼叫 loginWithLine API...');
      //   const member = await loginWithLine(userId);
      //   console.log('📋 API 回傳結果:', member ? '有資料' : '無資料');
        
      //   if (member) {
      //     console.log('✅ 會員登入成功');
      //     console.log('👤 會員 ID:', member.user_id);
      //     console.log('👤 會員名稱:', member.name);
      //     console.log('👤 會員帳號:', member.account);
      //     console.log('🔑 Access Token 長度:', member.access_token?.length || 0);
      //     console.log('📞 會員電話:', member.info?.phone || '未提供');
      //     console.log('📍 會員地址:', member.info?.address || '未提供');
          
      //     // 登入成功，建立 JWT Token
      //     const token = createUserToken(userId, member.user_id, member.access_token, member.name);
      //     console.log('🎫 JWT Token 已建立，長度:', token.length);
          
      //     // 更新用戶狀態為已登入，包含個人資訊
      //     updateUserState(userId, {
      //       currentStep: 'menu',
      //       memberId: member.user_id,
      //       memberName: member.name,
      //       accessToken: member.access_token,
      //       tempData: {
      //         memberInfo: {
      //           memberId: member.user_id,
      //           memberName: member.name,
      //           accessToken: member.access_token
      //         },
      //         // 保存會員的個人資訊
      //         memberPersonalInfo: {
      //           phone: member.info?.phone,
      //           address: member.info?.address
      //         }
      //       }
      //     });
      //     console.log('💾 用戶狀態已更新（包含個人資訊）');
          
      //     // 連接 WebSocket
      //     try {
      //       connectUserWebSocket(userId, member.user_id, token);
      //       console.log('🔌 WebSocket 連接成功');
      //     } catch (wsError) {
      //       console.error('🔌 WebSocket 連接失敗:', wsError);
      //     }
          
      //     // 更新到會員圖文選單
      //     try {
      //       await updateUserRichMenu(client, userId, true);
      //       console.log('📋 圖文選單更新成功');
      //     } catch (menuError) {
      //       console.error('📋 圖文選單更新失敗:', menuError);
      //     }
          
      //     const welcomeMessage = {
      //       type: 'text' as const,
      //       text: `🎉 歡迎回來，${member.name}！\n\n您已成功透過 LINE 登入系統。\n\n請點選下方選單使用服務功能。`
      //     };
          
      //     await client.pushMessage(userId, welcomeMessage);
      //     console.log('💬 歡迎訊息已發送');
      //   } else {
      //     console.log('❌ 會員登入失敗 - API 回傳 null');
      //     await client.pushMessage(userId, {
      //       type: 'text',
      //       text: '❌ LINE 登入失敗\n\n可能原因：\n• 您的 LINE 帳號尚未綁定會員資料\n• 網路連線問題\n• 後端 API 無回應\n\n請嘗試使用帳號密碼登入。'
      //     });
      //   }
      // } catch (error) {
      //   console.error('❌ LINE 直接登入過程發生例外錯誤:');
      //   console.error('❌ 錯誤類型:', error?.constructor?.name);
      //   console.error('❌ 錯誤訊息:', error?.message);
      //   console.error('❌ 錯誤堆疊:', error?.stack);
        
      //   await client.pushMessage(userId, {
      //     type: 'text',
      //     text: `❌ 登入過程發生錯誤，請稍後再試或使用帳號密碼登入。\n\n📝 技術資訊：${error?.message || '未知錯誤'}`
      //   });
      // }
      break;

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
      console.log('✅ 帳號密碼登入成功');
      console.log('👤 會員 ID:', member.user_id);
      console.log('👤 會員名稱:', member.name);
      console.log('👤 會員帳號:', member.account);
      console.log('🔑 Access Token 長度:', member.access_token?.length || 0);
      console.log('📞 會員電話:', member.info?.phone || '未提供');
      console.log('📍 會員地址:', member.info?.address || '未提供');
      
      // 建立 JWT Token
      const token = createUserToken(userId, member.user_id, member.access_token, member.name);
      
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

// 處理修改密碼流程 (開發環境)
export async function handlePasswordChange(event: MessageEvent, client: Client): Promise<void> {
  const userId = event.source.userId!;
  const userState = getUserState(userId);
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