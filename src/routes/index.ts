import express from 'express';
import { Client } from '@line/bot-sdk';
import multer from 'multer';
import path from 'path';
import { 
  handleWebLogin, 
  handleWebRegister, 
  handleWebChangePassword, 
  handleWebDeleteAccount 
} from '../handlers/webAuthHandler';

// 設定檔案上傳
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '2097152') // 2MB
  },
  fileFilter: (req, file, cb) => {
    // 只允許圖片檔案
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳圖片檔案'));
    }
  }
});

export function setupRoutes(app: express.Application, client: Client): void {
  // 健康檢查
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'medicine-delivery-line-bot'
    });
  });
  
  // 根路徑
  app.get('/', (req, res) => {
    res.json({
      message: '🏥 中藥配藥媒合系統 LINE Bot',
      version: '1.0.0',
      endpoints: {
        webhook: '/webhook',
        health: '/health',
        login: '/login'
      }
    });
  });
  
  // 網頁登入頁面
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/login.html'));
  });
  
  // 網頁登入 API
  app.post('/api/web-login', (req, res) => {
    handleWebLogin(req, res, client);
  });
  
  // 註冊 API  
  app.post('/api/register', (req, res) => {
    handleWebRegister(req, res, client);
  });
  
  // 變更密碼 API
  app.patch('/api/change-password', (req, res) => {
    handleWebChangePassword(req, res, client);
  });
  
  // 刪除帳號 API
  app.delete('/api/delete-account', (req, res) => {
    handleWebDeleteAccount(req, res, client);
  });
  
  // 檔案上傳 API（如果需要網頁版上傳）
  app.post('/upload', upload.single('prescription'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '沒有上傳檔案' });
    }
    
    res.json({
      message: '檔案上傳成功',
      filename: req.file.filename,
      path: req.file.path
    });
  });
  
  // 靜態檔案服務（用於提供上傳的圖片）
  app.use('/uploads', express.static(process.env.UPLOAD_DIR || 'uploads'));
  
  // 錯誤處理中間件
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '檔案大小超過限制' });
      }
    }
    
    console.error('伺服器錯誤:', error);
    res.status(500).json({ error: '伺服器內部錯誤' });
  });
}