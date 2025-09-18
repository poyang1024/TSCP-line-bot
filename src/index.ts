import express from 'express';
import { middleware, Client, WebhookEvent, MessageEvent, PostbackEvent } from '@line/bot-sdk';
import crypto from 'crypto';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { handleMessage } from './handlers/messageHandler';
import { handlePostback } from './handlers/postbackHandler';
import { handleFollow } from './handlers/followHandler';
import { initWebSocket } from './services/websocketService';
import { setupRoutes } from './routes';
import { initializeRichMenus } from './services/menuManager';
import authRoutes from './routes/authRoutes';
import { initRedis, checkNewDeployment, clearAllLoginStates, clearAllWebSocketConnections } from './services/redisService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 除錯：檢查環境變數
console.log('🔍 環境變數檢查:');
console.log('LINE_CHANNEL_ACCESS_TOKEN 長度:', process.env.LINE_CHANNEL_ACCESS_TOKEN?.length || 0);
console.log('LINE_CHANNEL_SECRET 長度:', process.env.LINE_CHANNEL_SECRET?.length || 0);
console.log('TOKEN 前10字元:', process.env.LINE_CHANNEL_ACCESS_TOKEN?.substring(0, 10) || 'undefined');
console.log('VERCEL_DEPLOYMENT_ID:', process.env.VERCEL_DEPLOYMENT_ID?.substring(0, 12) || 'undefined');
console.log('VERCEL_GIT_COMMIT_SHA:', process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'undefined');

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

console.log('🔧 LINE Bot 設定:');
console.log('channelAccessToken 長度:', config.channelAccessToken.length);
console.log('channelSecret 長度:', config.channelSecret.length);

const client = new Client(config);

// 全域中間件
app.use('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  (req as any).rawBody = req.body;
  req.body = JSON.parse(req.body);
  next();
});

app.use(express.json());
app.use(cookieParser());

// 靜態文件服務
app.use(express.static('public'));

// 認證路由
app.use('/auth', authRoutes);

// 添加請求日誌中間件
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// ngrok 相關中間件（處理 ngrok-skip-browser-warning）
app.use((req, res, next) => {
  // 如果是 ngrok 的警告頁面請求，跳過
  if (req.get('ngrok-skip-browser-warning')) {
    res.header('ngrok-skip-browser-warning', 'true');
  }
  next();
});

// 自定義簽章驗證中間件
const verifySignature = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log('🔐 進入簽章驗證中間件');
  const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
  const signature = req.get('x-line-signature');
  
  console.log('簽章 header:', signature);
  console.log('環境:', process.env.NODE_ENV);
  
  // 開發環境：如果沒有簽章且是測試請求，直接通過
  if (!signature && process.env.NODE_ENV !== 'production') {
    console.log('⚠️  開發模式：跳過簽章驗證');
    return next();
  }
  
  // 生產環境：必須有簽章
  if (!signature) {
    console.log('❌ 缺少 x-line-signature header');
    return res.status(401).json({ error: 'SignatureValidationFailed: no signature' });
  }
  
  // 獲取原始請求體
  const body = (req as any).rawBody || JSON.stringify(req.body);
  console.log('請求體長度:', body.length);
  
  // 計算簽章
  const expectedSignature = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  
  // 比較簽章
  if (signature !== expectedSignature) {
    console.log('❌ 簽章驗證失敗');
    console.log('預期簽章:', expectedSignature);
    console.log('接收簽章:', signature);
    
    // 開發環境下，暫時跳過簽章驗證以便調試
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️  開發模式：忽略簽章驗證失敗，繼續處理');
      return next();
    }
    
    return res.status(401).json({ error: 'SignatureValidationFailed: invalid signature' });
  }
  
  console.log('✅ 簽章驗證成功');
  next();
};

// 設定路由
setupRoutes(app, client);

// Webhook 路由 - 使用簽章驗證
app.post('/webhook', verifySignature, async (req, res) => {
  console.log('📨 收到 Webhook 請求');
  console.log('請求體:', JSON.stringify(req.body, null, 2));
  
  // 等待服務初始化完成
  if (!servicesInitialized) {
    console.log('⏳ 等待服務初始化完成...');
    let retries = 0;
    const maxRetries = 10;
    
    while (!servicesInitialized && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
    
    if (!servicesInitialized) {
      console.error('❌ 服務初始化超時，無法處理請求');
      return res.status(503).json({ error: 'Service initialization timeout' });
    }
  }
  
  // 檢查事件數組
  if (!req.body.events || !Array.isArray(req.body.events)) {
    console.log('⚠️  無效的事件數據');
    return res.status(200).json({ message: 'No events to process' });
  }
  
  if (req.body.events.length === 0) {
    console.log('ℹ️  空事件數組 (可能是驗證請求)');
    return res.status(200).json({ message: 'Empty events array' });
  }
  
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => {
      console.log('✅ 事件處理完成:', result);
      res.status(200).json(result);
    })
    .catch((err) => {
      console.error('❌ Webhook 錯誤:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
});

// 測試路由 (不需要簽章驗證)
app.get('/webhook', (req, res) => {
  res.status(200).json({ 
    message: 'Webhook endpoint is working', 
    method: 'GET not supported, use POST' 
  });
});

// Catch-all route for debugging
app.all('*', (req, res) => {
  console.log(`🔍 未匹配的路由: ${req.method} ${req.path}`);
  console.log('Query:', req.query);
  console.log('Body:', req.body);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.path,
    availableRoutes: [
      'GET /',
      'GET /health',
      'POST /webhook',
      'GET /webhook',
      'POST /upload'
    ]
  });
});

// 事件處理
async function handleEvent(event: WebhookEvent): Promise<{ success: boolean; eventType: string; action?: string; error?: string }> {
  try {
    if (event.type === 'message') {
      const result = await handleMessage(event as MessageEvent, client);
      return { 
        success: result.success, 
        eventType: 'message', 
        action: result.action,
        error: result.error
      };
    }
    
    if (event.type === 'postback') {
      const result = await handlePostback(event as PostbackEvent, client);
      return { 
        success: result.success, 
        eventType: 'postback', 
        action: result.action,
        error: result.error
      };
    }
    
    if (event.type === 'follow') {
      await handleFollow(event as any, client);
      return { success: true, eventType: 'follow', action: 'user_followed' };
    }
    
    // 其他類型的事件（如 unfollow 等）
    console.log(`📝 未處理的事件類型: ${event.type}`);
    return { success: true, eventType: event.type, action: 'unhandled' };
    
  } catch (error) {
    console.error('❌ 事件處理異常:', error);
    return { 
      success: false, 
      eventType: event.type || 'unknown', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// 服務就緒狀態
let servicesInitialized = false;

// 初始化服務
async function initializeServices() {
  try {
    console.log('🔧 正在初始化服務...');
    
    // 初始化 Redis (等待完成)
    await initRedis();
    
    // 檢查是否為新部署 (使用 Vercel deployment ID 或 build timestamp)
    let currentVersion: string;
    let shouldClearStates = false;
    
    // 檢查是否有強制清除標記
    if (process.env.FORCE_CLEAR_STATES === 'true') {
      console.log('🧹 檢測到強制清除標記，將清除所有登入狀態');
      shouldClearStates = true;
    }
    
    if (process.env.VERCEL_DEPLOYMENT_ID) {
      // 在 Vercel 環境中使用 deployment ID
      currentVersion = process.env.VERCEL_DEPLOYMENT_ID;
      console.log('📋 當前部署版本 (Vercel Deployment ID):', currentVersion.substring(0, 12));
    } else if (process.env.VERCEL_GIT_COMMIT_SHA) {
      // 使用 Git commit SHA
      currentVersion = process.env.VERCEL_GIT_COMMIT_SHA;
      console.log('📋 當前部署版本 (Git SHA):', currentVersion.substring(0, 8));
    } else {
      // 本地開發或其他環境，使用 package.json 版本
      const packageJson = require('../package.json');
      currentVersion = packageJson.version;
      console.log('📋 當前部署版本 (Package version):', currentVersion);
    }
    
    const isNewDeployment = shouldClearStates || await checkNewDeployment(currentVersion);
    
    if (isNewDeployment) {
      console.log('🚀 檢測到新部署，清除所有用戶登入狀態...');
      
      const clearedLogins = await clearAllLoginStates();
      const clearedConnections = await clearAllWebSocketConnections();
      
      console.log(`✅ 已清除 ${clearedLogins} 個登入狀態`);
      console.log(`✅ 已清除 ${clearedConnections} 個 WebSocket 連線`);
      console.log('📢 所有用戶將需要重新登入');
    } else {
      console.log('♻️ 應用重啟，保持現有登入狀態');
    }
    
    // 初始化 WebSocket 連線
    initWebSocket();
    
    // 初始化圖文選單（僅在開發環境）
    if (process.env.NODE_ENV !== 'production') {
      console.log('🎨 Initializing Rich Menus...');
      await initializeRichMenus(client);
    }
    
    servicesInitialized = true;
    console.log('✅ 所有服務初始化完成');
  } catch (error) {
    console.error('❌ 服務初始化失敗:', error);
  }
}

// 初始化服務
initializeServices();

// 顯示所有註冊的路由（僅在開發環境）
if (process.env.NODE_ENV !== 'production') {
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      console.log(`📍 路由: ${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          console.log(`📍 路由: ${Object.keys(handler.route.methods).join(',').toUpperCase()} ${handler.route.path}`);
        }
      });
    }
  });
}

// 本地開發時啟動伺服器，Vercel 環境會自動處理
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 LINE Bot 伺服器啟動於 http://localhost:${PORT}`);
    console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log('✅ 伺服器準備就緒，等待 LINE Platform 連線...');
  });
} else {
  console.log('🚀 LINE Bot 在 Vercel 環境中運行');
}

// 導出 app 供 Vercel 使用
export default app;