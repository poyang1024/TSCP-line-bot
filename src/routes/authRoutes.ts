import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { jwtMiddleware, requireUser } from '../middleware/jwtMiddleware';
import { loginMember } from '../services/apiService';
import { createUserToken } from '../services/jwtService';

const router = express.Router();

// 登入頁面
router.get('/login', jwtMiddleware, (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const action = req.query.action as string;
  
  if (!userId) {
    return res.status(400).send('缺少 userId 參數');
  }
  
  // 如果已經登入，直接重導向到成功頁面
  if (req.user && req.user.l === userId) {  // lineId -> l
    return res.redirect(`/auth/success?userId=${userId}`);
  }
  
  // 根據 action 顯示不同內容
  let pageTitle = '會員登入';
  let submitAction = '/auth/login';
  
  switch (action) {
    case 'register':
      pageTitle = '註冊新帳號';
      submitAction = '/auth/register';
      break;
    case 'password':
      pageTitle = '修改密碼';
      submitAction = '/auth/change-password';
      break;
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${pageTitle} - 買中藥找藥師</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                max-width: 400px;
                width: 100%;
            }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo h1 { color: #333; font-size: 24px; margin-bottom: 5px; }
            .logo p { color: #666; font-size: 14px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; color: #333; font-weight: 500; }
            input[type="text"], input[type="password"] {
                width: 100%;
                padding: 12px;
                border: 2px solid #eee;
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            input[type="text"]:focus, input[type="password"]:focus {
                outline: none;
                border-color: #667eea;
            }
            .btn {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .btn:hover { transform: translateY(-2px); }
            .message { margin-top: 15px; padding: 10px; border-radius: 5px; text-align: center; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .loading { display: none; text-align: center; margin-top: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <h1>🍃 買中藥找藥師</h1>
                <p>${pageTitle}</p>
            </div>
            
            <form id="authForm" onsubmit="handleSubmit(event)">
                <input type="hidden" name="userId" value="${userId}">
                
                <div class="form-group">
                    <label for="account">帳號</label>
                    <input type="text" id="account" name="account" required 
                           placeholder="請輸入您的帳號">
                </div>
                
                <div class="form-group">
                    <label for="password">密碼</label>
                    <input type="password" id="password" name="password" required 
                           placeholder="請輸入您的密碼">
                </div>
                
                <button type="submit" class="btn">
                    ${action === 'register' ? '註冊帳號' : action === 'password' ? '修改密碼' : '登入'}
                </button>
                
                <div class="loading" id="loading">
                    <p>處理中，請稍候...</p>
                </div>
                
                <div id="message"></div>
            </form>
        </div>
        
        <script>
            async function handleSubmit(event) {
                event.preventDefault();
                
                const form = event.target;
                const formData = new FormData(form);
                const loading = document.getElementById('loading');
                const message = document.getElementById('message');
                const submitBtn = form.querySelector('button[type="submit"]');
                
                // 顯示載入狀態
                loading.style.display = 'block';
                submitBtn.disabled = true;
                message.innerHTML = '';
                
                try {
                    const response = await fetch('${submitAction}', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok && result.success) {
                        message.innerHTML = '<div class="success">' + result.message + '</div>';
                        
                        // 登入成功後重導向
                        if ('${action}' !== 'password') {
                            setTimeout(() => {
                                window.location.href = '/auth/success?userId=${userId}';
                            }, 1500);
                        }
                    } else {
                        message.innerHTML = '<div class="error">' + (result.message || '操作失敗') + '</div>';
                    }
                } catch (error) {
                    message.innerHTML = '<div class="error">網路錯誤，請稍後再試</div>';
                    console.error('Auth error:', error);
                }
                
                // 隱藏載入狀態
                loading.style.display = 'none';
                submitBtn.disabled = false;
            }
        </script>
    </body>
    </html>
  `);
});

// 處理登入
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { userId, account, password } = req.body;
    
    if (!userId || !account || !password) {
      return res.status(400).json({
        success: false,
        message: '請填寫所有必要欄位'
      });
    }
    
    // 呼叫登入 API
    const member = await loginMember(account, password);
    
    if (member) {
      // 建立 JWT token
      const token = createUserToken(userId, member.user_id, member.access_token, member.name);
      
      // 設定 HTTP-only cookie，有效期 7 天
      res.cookie('jwt_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 天
      });
      
      res.json({
        success: true,
        message: `登入成功！歡迎回來，${member.name}`,
        member: {
          name: member.name,
          account: member.account
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: '帳號或密碼錯誤'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: '登入過程發生錯誤，請稍後再試'
    });
  }
});

// 登入成功頁面
router.get('/success', jwtMiddleware, (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  
  if (!userId) {
    return res.status(400).send('缺少 userId 參數');
  }
  
  // 檢查是否已登入
  if (!req.user || req.user.l !== userId) {  // lineId -> l
    return res.redirect(`/login?userId=${userId}`);
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>登入成功 - 買中藥找藥師</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                max-width: 400px;
                width: 100%;
                text-align: center;
            }
            .success-icon { font-size: 60px; margin-bottom: 20px; }
            h1 { color: #28a745; margin-bottom: 10px; }
            p { color: #666; margin-bottom: 20px; line-height: 1.6; }
            .user-info {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                transition: transform 0.2s;
            }
            .btn:hover { transform: translateY(-2px); }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success-icon">🎉</div>
            <h1>登入成功！</h1>
            <p>歡迎回來，${req.user.n}！</p>
            
            <div class="user-info">
                <strong>會員資訊</strong><br>
                姓名：${req.user.n}<br>
                會員ID：${req.user.m}
            </div>
            
            <p>您現在可以回到 LINE 聊天室使用所有會員功能了！</p>
            
            <script>
                // 3 秒後自動關閉頁面
                setTimeout(() => {
                    window.close();
                }, 3000);
                
                // 如果是在 LINE 內建瀏覽器中，嘗試關閉
                if (window.liff) {
                    liff.closeWindow();
                }
            </script>
        </div>
    </body>
    </html>
  `);
});

// 登出
router.post('/logout', jwtMiddleware, requireUser, (req: Request, res: Response) => {
  // 清除 cookie
  res.clearCookie('jwt_token');
  
  res.json({
    success: true,
    message: '已成功登出'
  });
});

// 檢查登入狀態 API
router.get('/status', jwtMiddleware, (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: '缺少 userId 參數'
    });
  }
  
  if (req.user && req.user.l === userId) {  // lineId -> l
    res.json({
      success: true,
      isLoggedIn: true,
      user: {
        lineId: req.user.l,      // lineId -> l
        memberId: req.user.m,    // memberId -> m
        memberName: req.user.n   // memberName -> n
      }
    });
  } else {
    res.json({
      success: true,
      isLoggedIn: false
    });
  }
});

export default router;
