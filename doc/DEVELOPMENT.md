# 開發與部署指南

## 本地開發

### 方式 1: 使用 Docker + ngrok（推薦）

這種方式提供完整的容器化環境，包含 ngrok 隧道服務，讓您可以輕鬆測試 LINE Webhook。

#### 前置需求
1. 安裝 Docker 和 Docker Compose
2. 獲取 ngrok authtoken：https://dashboard.ngrok.com/get-started/your-authtoken

#### 設定環境變數
創建 `.env` 文件：
```bash
# LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=你的_LINE_ACCESS_TOKEN
LINE_CHANNEL_SECRET=你的_LINE_SECRET

# ngrok 設定
NGROK_AUTHTOKEN=你的_NGROK_TOKEN

# API 設定
API_BASE_URL=https://stage-backend.docter.pro/back-end/user/app
STAFF_API_BASE_URL=https://stage-backend.docter.pro/back-end/app
WEBSOCKET_URL=https://stage-websocket.docter.pro

# 環境設定
NODE_ENV=development
PORT=3000
```

#### 啟動開發環境
```bash
# 使用 Docker Compose 啟動
npm run dev:docker

# 或直接使用 docker-compose
docker-compose -f docker-compose.dev.yml up --build
```

#### 獲取 ngrok URL
1. 開啟瀏覽器：http://localhost:4040
2. 查看 ngrok 提供的 HTTPS URL（例如：https://abc123.ngrok.io）
3. 將 Webhook URL 設定為：`https://abc123.ngrok.io/webhook`

#### 停止開發環境
```bash
npm run dev:docker:down

# 或
docker-compose -f docker-compose.dev.yml down
```

### 方式 2: 直接運行 Node.js

如果您不想使用 Docker：

```bash
# 安裝依賴
npm install

# 開發模式（支援熱重載）
npm run dev

# 或監控檔案變化
npm run dev:watch
```

注意：這種方式需要自己安裝和設定 ngrok。

## 部署到 Vercel

### 前置需求
1. 安裝 Vercel CLI：`npm install -g vercel`
2. 登入 Vercel：`vercel login`

### 部署步驟

#### 1. 建置專案
```bash
npm run build
```

#### 2. 部署
```bash
vercel --prod
```

#### 3. 設定環境變數
在 Vercel Dashboard 中設定：
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `API_BASE_URL`
- `STAFF_API_BASE_URL`
- `WEBSOCKET_URL`
- `NODE_ENV=production`

#### 4. 更新 LINE Webhook URL
將 LINE Developers Console 中的 Webhook URL 更新為：
```
https://your-app-name.vercel.app/webhook
```

### 驗證部署

部署完成後，測試以下端點：

- 健康檢查：`https://your-app-name.vercel.app/health`
- 根路徑：`https://your-app-name.vercel.app/`
- Webhook：`https://your-app-name.vercel.app/webhook`（POST）

## 開發流程

### 本地開發 → 測試 → 部署

1. **本地開發**
   ```bash
   npm run dev:docker  # 啟動 Docker + ngrok
   ```

2. **測試功能**
   - 使用 ngrok URL 測試 LINE Bot 功能
   - 檢查 ngrok 控制台：http://localhost:4040

3. **準備部署**
   ```bash
   npm run build      # 建置 TypeScript
   ```

4. **部署**
   ```bash
   vercel --prod      # 部署到 Vercel
   ```

5. **更新 Webhook**
   - 將 LINE Webhook URL 從 ngrok URL 改為 Vercel URL

## 常見問題

### Q: ngrok 隧道經常斷線？
A: 免費版 ngrok 有時間限制，可以考慮升級或重新啟動容器。

### Q: Vercel 部署失敗？
A: 檢查：
- `vercel-build` 腳本是否正確
- TypeScript 編譯是否成功
- 環境變數是否正確設定

### Q: Webhook 驗證失敗？
A: 確認：
- LINE_CHANNEL_SECRET 是否正確
- 請求簽章是否正確傳遞
- Vercel 函數是否正常運行

## 專案結構

```
line-bot/
├── src/
│   ├── handlers/           # 事件處理器
│   ├── services/          # 服務層
│   ├── templates/         # 訊息模板
│   ├── types/            # TypeScript 類型
│   └── index.ts          # 主應用程式
├── docker-compose.dev.yml # Docker 開發環境
├── Dockerfile.dev        # 開發用 Dockerfile
├── vercel.json           # Vercel 配置
├── package.json          # Node.js 專案配置
└── tsconfig.json         # TypeScript 配置
```
