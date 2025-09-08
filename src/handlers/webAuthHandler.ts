import { Request, Response } from 'express';
import { Client } from '@line/bot-sdk';
import { loginMember, registerMember, changePassword, deleteAccount } from '../services/apiService';
import { clearOrderStep } from '../services/userService';
import { createUserToken } from '../services/jwtService';
import { connectUserWebSocket, disconnectUserWebSocket } from '../services/websocketService';
import { updateUserRichMenu } from '../services/menuManager';

// 網頁登入處理
export async function handleWebLogin(req: Request, res: Response, client: Client): Promise<void> {
  try {
    const { account, password, lineUserId } = req.body;
    
    if (!account || !password || !lineUserId) {
      res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
      return;
    }
    
    // 呼叫登入 API
    const member = await loginMember(account, password);
    
    if (member) {
      // 建立 JWT Token
      const token = createUserToken(lineUserId, member.user_id, member.access_token, member.name);
      
      // 清除任何進行中的訂單步驟
      clearOrderStep(lineUserId);
      
      // 嘗試切換到會員選單
      try {
        await updateUserRichMenu(client, lineUserId, true);
        console.log(`✅ Rich Menu 更新成功 - ${lineUserId}`);
      } catch (menuError) {
        console.error(`⚠️ Rich Menu 更新失敗，但不影響登入:`, menuError);
      }
      
      // 建立 WebSocket 連線
      connectUserWebSocket(lineUserId, member.user_id, member.access_token);
      
      // 發送登入成功通知到 LINE
      try {
        const successMessage = {
          type: 'text' as const,
          text: `🎉 登入成功！\n\n歡迎回來，${member.name}！\n\n✅ 已切換到會員模式\n✅ 現在可以使用中藥預約功能\n✅ 請使用下方選單開始服務`
        };
        
        await client.pushMessage(lineUserId, successMessage);
        console.log(`✅ 登入成功訊息已發送到 LINE - ${lineUserId}`);
      } catch (pushError) {
        console.error(`❌ 發送登入成功訊息失敗:`, pushError);
      }
      
      res.json({
        success: true,
        message: '登入成功',
        data: {
          memberName: member.name,
          memberId: member.user_id
        }
      });
      
    } else {
      // 登入失敗，清除任何訂單步驟
      clearOrderStep(lineUserId);
      
      // 確保選單為訪客模式
      try {
        await updateUserRichMenu(client, lineUserId, false);
      } catch (menuError) {
        console.error(`⚠️ 重置 Rich Menu 失敗:`, menuError);
      }
      
      res.status(401).json({
        success: false,
        message: '帳號或密碼錯誤'
      });
    }
  } catch (error) {
    console.error('Web login error:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
}

// 網頁註冊處理
export async function handleWebRegister(req: Request, res: Response, client: Client): Promise<void> {
  try {
    const { phone, identity, name, address = '', lineUserId } = req.body;
    
    if (!phone || !identity || !name || !lineUserId) {
      res.status(400).json({
        success: false,
        message: '請填寫所有必填欄位'
      });
      return;
    }
    
    // 驗證輸入長度
    if (phone.length > 15 || identity.length > 25 || name.length > 50 || address.length > 255) {
      res.status(400).json({
        success: false,
        message: '輸入資料長度超過限制'
      });
      return;
    }
    
    // 呼叫註冊 API
    const result = await registerMember(phone, identity, name, address);
    
    if (result.success) {
      // 發送註冊成功通知到 LINE
      try {
        const successMessage = {
          type: 'text' as const,
          text: `🎉 註冊成功！\n\n歡迎加入，${name}！\n\n📱 帳號：${phone}\n🔐 預設密碼：${phone}\n\n⚠️ 請立即登入並修改密碼以確保安全\n\n✅ 現在可以使用會員登入功能`
        };
        
        await client.pushMessage(lineUserId, successMessage);
        console.log(`✅ 註冊成功訊息已發送到 LINE - ${lineUserId}`);
      } catch (pushError) {
        console.error(`❌ 發送註冊成功訊息失敗:`, pushError);
      }
      
      res.json({
        success: true,
        message: '註冊成功！預設密碼為您的手機號碼，請立即修改密碼',
        data: {
          account: phone,
          name: name
        }
      });
      
    } else {
      res.status(400).json({
        success: false,
        message: result.message || '註冊失敗，請檢查資料是否正確'
      });
    }
    
  } catch (error) {
    console.error('Web register error:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
}

// 網頁變更密碼處理
export async function handleWebChangePassword(req: Request, res: Response, client: Client): Promise<void> {
  try {
    const { old_password, new_password, lineUserId, token } = req.body;
    
    if (!old_password || !new_password || !lineUserId || !token) {
      res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
      return;
    }
    
    // 驗證新密碼長度
    if (new_password.length < 1 || new_password.length > 20) {
      res.status(400).json({
        success: false,
        message: '新密碼長度必須為 1-20 字元'
      });
      return;
    }
    
    // 從 JWT token 中解析 access token
    const { verifyUserToken } = await import('../services/jwtService');
    const userSession = verifyUserToken(token);
    
    if (!userSession || userSession.lineId !== lineUserId) {
      res.status(401).json({
        success: false,
        message: '請先登入'
      });
      return;
    }
    
    // 呼叫變更密碼 API
    const result = await changePassword(userSession.accessToken, old_password, new_password);
    
    if (result.success) {
      // 自動登出：清除訂單步驟
      clearOrderStep(lineUserId);
      
      // 斷開 WebSocket 連線
      disconnectUserWebSocket(lineUserId);
      
      // 切換回訪客選單
      try {
        await updateUserRichMenu(client, lineUserId, false);
        console.log(`✅ Rich Menu 已切換為訪客模式 - ${lineUserId}`);
      } catch (menuError) {
        console.error(`⚠️ Rich Menu 切換失敗:`, menuError);
      }
      
      // 發送變更成功通知到 LINE
      try {
        const successMessage = {
          type: 'text' as const,
          text: `🔐 密碼修改成功！\n\n為了安全考量，系統已自動登出\n\n請使用新密碼重新登入\n\n✅ 現在可以使用新密碼進行登入`
        };
        
        await client.pushMessage(lineUserId, successMessage);
        console.log(`✅ 密碼修改成功訊息已發送到 LINE - ${lineUserId}`);
      } catch (pushError) {
        console.error(`❌ 發送密碼修改成功訊息失敗:`, pushError);
      }
      
      res.json({
        success: true,
        message: '密碼修改成功，系統已自動登出'
      });
      
    } else {
      res.status(400).json({
        success: false,
        message: result.message || '密碼修改失敗，請檢查舊密碼是否正確'
      });
    }
    
  } catch (error) {
    console.error('Web change password error:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
}

// 網頁刪除帳號處理
export async function handleWebDeleteAccount(req: Request, res: Response, client: Client): Promise<void> {
  try {
    const { lineUserId, token } = req.body;
    
    if (!lineUserId || !token) {
      res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
      return;
    }
    
    // 從 JWT token 中解析 access token
    const { verifyUserToken } = await import('../services/jwtService');
    const userSession = verifyUserToken(token);
    
    if (!userSession || userSession.lineId !== lineUserId) {
      res.status(401).json({
        success: false,
        message: '請先登入'
      });
      return;
    }
    
    // 呼叫刪除帳號 API
    const result = await deleteAccount(userSession.accessToken);
    
    if (result.success) {
      // 自動登出：清除訂單步驟
      clearOrderStep(lineUserId);
      
      // 斷開 WebSocket 連線
      disconnectUserWebSocket(lineUserId);
      
      // 切換回訪客選單
      try {
        await updateUserRichMenu(client, lineUserId, false);
        console.log(`✅ Rich Menu 已切換為訪客模式 - ${lineUserId}`);
      } catch (menuError) {
        console.error(`⚠️ Rich Menu 切換失敗:`, menuError);
      }
      
      // 發送刪除成功通知到 LINE
      try {
        const successMessage = {
          type: 'text' as const,
          text: `⚠️ 帳號刪除成功！\n\n您的帳號資料已完全移除\n\n如需重新使用服務，請重新註冊\n\n感謝您使用我們的服務！`
        };
        
        await client.pushMessage(lineUserId, successMessage);
        console.log(`✅ 帳號刪除成功訊息已發送到 LINE - ${lineUserId}`);
      } catch (pushError) {
        console.error(`❌ 發送帳號刪除成功訊息失敗:`, pushError);
      }
      
      res.json({
        success: true,
        message: '帳號刪除成功'
      });
      
    } else {
      res.status(400).json({
        success: false,
        message: result.message || '帳號刪除失敗'
      });
    }
    
  } catch (error) {
    console.error('Web delete account error:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
}
