# 🏥 中藥配藥媒合系統 LINE Bot

這是一個整合中藥配藥服務的 LINE Official Account Bot，讓用戶可以透過 LINE 享受便利的中藥配藥服務。

## 🎯 主要功能

- 🔗 **會員帳號綁定** - 透過帳號密碼登入系統
- 🏥 **搜尋附近藥局** - 預設搜尋彰化市的中藥局
- 📷 **藥單上傳** - 拍照上傳藥單給藥局
- 📋 **訂單狀態追蹤** - 即時接收訂單狀態更新
- 📱 **製作進度推播** - 配藥進度即時通知
- 🎉 **完成通知** - 配藥完成與領藥提醒

## 🔄 使用流程

1. **加入 LINE OA** → 用戶加入 LINE Official Account
2. **綁定會員帳號** → 使用現有會員帳號密碼登入
3. **搜尋附近藥局** → 瀏覽可用的中藥局
4. **上傳藥單** → 拍照上傳藥單照片
5. **選擇配藥藥局** → 選擇要配藥的藥局
6. **藥局確認處理** → 等待藥局處理訂單
7. **藥局製作** → 追蹤製作進度
8. **完成通知領藥** → 收到完成通知並前往領藥

## 🛠️ 技術架構

- **前端**: LINE Messaging API + TypeScript
- **後端**: Node.js + Express
- **通訊**: WebSocket 即時推播
- **檔案處理**: Multer 圖片上傳
- **API 整合**: 現有的送藥服務 API

## 📦 安裝與設定

### 1. 安裝依賴

```bash
cd line-bot
npm install
```

### 2. 環境設定

複製 `.env` 檔案並填入正確的設定值：

```bash
# LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here

# 後端 API 設定
API_BASE_URL=https://stage-backend.docter.pro/back-end/user/app
STAFF_API_BASE_URL=https://stage-backend.docter.pro/back-end/app

# WebSocket 設定
WEBSOCKET_URL=https://stage-websocket.docter.pro/member

# 服務設定
PORT=3000
NODE_ENV=development
```

### 3. LINE Bot 設定

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 建立新的 Provider 和 Messaging API Channel
3. 取得 Channel Access Token 和 Channel Secret
4. 設定 Webhook URL: `https://your-domain.com/webhook`
5. 啟用 "Use webhook" 選項

### 4. 編譯與執行

```bash
# 開發模式
npm run dev

# 編譯
npm run build

# 生產模式
npm start
```

## 🔧 API 整合

本 Bot 整合了現有的送藥服務 API：

### 會員 API
- 登入: `POST /login/tscp`
- 查詢藥局: `GET /area`
- 查詢訂單: `GET /delivery/medicine`
- 新增訂單: `POST /delivery/medicine`

### WebSocket 通訊
- 連線: `wss://websocket-url/member`
- 房間: `member.delivery.medicine.{member_id}`
- 頻道: `member.deliveryMedicine.{member_id}`

## 📱 LINE Bot 指令

### 基本指令
- `登入` / `會員登入` - 開始登入流程
- `搜尋藥局` / `附近藥局` - 搜尋可用藥局
- `我的訂單` / `訂單查詢` - 查看訂單記錄
- `主選單` / `選單` - 顯示主功能選單

### 互動功能
- **上傳圖片** - 直接傳送藥單照片
- **選擇藥局** - 點選藥局卡片選擇配藥藥局
- **查看詳情** - 點選按鈕查看訂單詳細資訊

## 🔔 推播通知

Bot 會在以下情況主動推送訊息：

1. **訂單狀態變更** - 收單、補單、拒單、排單、完成
2. **製作進度** - 配藥製作進度更新
3. **完成通知** - 配藥完成與領藥提醒

## 📂 專案結構

```
line-bot/
├── src/
│   ├── handlers/          # 事件處理器
│   │   ├── messageHandler.ts    # 訊息處理
│   │   ├── postbackHandler.ts   # 回調處理
│   │   ├── loginHandler.ts      # 登入處理
│   │   ├── pharmacyHandler.ts   # 藥局搜尋
│   │   ├── orderHandler.ts      # 訂單查詢
│   │   ├── uploadHandler.ts     # 檔案上傳
│   │   └── notificationHandler.ts # 推播通知
│   ├── services/          # 服務層
│   │   ├── apiService.ts         # API 呼叫
│   │   ├── userService.ts        # 用戶狀態管理
│   │   └── websocketService.ts   # WebSocket 連線
│   ├── templates/         # 訊息模板
│   │   └── messageTemplates.ts   # LINE 訊息模板
│   ├── types/            # 型別定義
│   │   └── index.ts
│   ├── routes/           # 路由設定
│   │   └── index.ts
│   └── index.ts          # 主程式入口
├── uploads/              # 上傳檔案目錄
├── .env                  # 環境變數
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 部署

### Railway 部署

1. 連接 GitHub 倉庫到 Railway
2. 設定環境變數
3. Railway 會自動偵測並部署 Node.js 應用

### Vercel 部署

1. 安裝 Vercel CLI: `npm i -g vercel`
2. 執行部署: `vercel`
3. 設定環境變數在 Vercel Dashboard

## 🔒 安全性考量

- 所有 API 呼叫都使用 Bearer Token 認證
- 檔案上傳限制大小和類型
- 用戶狀態暫存在記憶體（生產環境建議使用 Redis）
- WebSocket 連線需要有效的 access_token

## 🐛 除錯

### 常見問題

1. **Webhook 無法接收** - 檢查 LINE Bot 設定和 HTTPS 憑證
2. **API 呼叫失敗** - 確認 API_BASE_URL 和網路連線
3. **WebSocket 連線失敗** - 檢查 WEBSOCKET_URL 和 token 有效性
4. **檔案上傳失敗** - 確認 uploads 目錄權限和檔案大小限制

### 日誌查看

```bash
# 查看即時日誌
npm run dev

# 生產環境日誌
pm2 logs line-bot
```

## 📞 支援

如有問題請聯絡開發團隊或查看 API 文件。

---

🎯 **目標**: 讓傳統中藥配藥服務數位化，提供現代化的用戶體驗！