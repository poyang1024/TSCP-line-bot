# Azure 部署指南

## 概述

本指南說明如何將 LINE Bot 從 Vercel 遷移到 Azure，包括程式碼調整和部署配置。

---

## 🔄 平台差異對比

### Vercel vs Azure Functions vs Azure App Service

| 項目 | Vercel | Azure Functions | Azure App Service |
|------|--------|-----------------|-------------------|
| **架構** | Serverless | Serverless | Always-on (持久實例) |
| **請求限制** | 30 秒（Hobby）/ 60 秒（Pro） | 預設 5 分鐘（可調整到 10 分鐘）| 230 秒（可調整） |
| **狀態管理** | 無狀態 | 無狀態 | 可有狀態 |
| **冷啟動** | 有（免費方案） | 有（消費方案） | **無** ⭐ |
| **檔案系統** | 唯讀（/tmp 可寫） | /tmp 可寫 | 可寫（持久化可選） |
| **靜態文件** | `express.static` 直接支援 | 需要額外配置 | **`express.static` 原生支援** ⭐ |
| **環境變數** | Vercel Dashboard | Azure Portal / CLI | Azure Portal / CLI |
| **部署方式** | Git 推送自動部署 | CLI / Git / CI/CD | **Git 推送自動部署** ⭐ |
| **程式碼修改** | 無需修改 | 幾乎無需修改 | **極少修改（一行）** ⭐ |
| **月費用** | 免費（有限制） | 免費（100萬次請求） | ~$13 (B1) |
| **適合場景** | 當前使用中 | 純 API serverless | **Express 全棧應用** ⭐ |

### 💡 選擇建議

**目前架構分析：**
```typescript
// 你的應用是 Express 全棧（不是純 API）
app.use(express.static('public'));  // 靜態文件（login.html）
app.post('/webhook', ...);           // API 端點
app.use('/auth', authRoutes);        // 認證路由
```

**推薦方案：**

1. **如果預算有限** → 繼續使用 **Vercel**（免費，運作良好）

2. **如果要遷移 Azure 且重視簡單性** → 使用 **Azure App Service**
   - ✅ 零修改（只需一行判斷邏輯）
   - ✅ 靜態文件原生支援
   - ✅ 無冷啟動，效能更穩定
   - ✅ 適合 Express 全棧架構
   - 💰 成本：~$13/月

3. **如果要 Azure 且追求免費** → 使用 **Azure Functions**
   - ✅ 免費額度充足
   - ⚠️ 需要額外處理靜態文件（Static Web Apps 或直接返回）
   - ⚠️ 架構稍微複雜
   - 💰 成本：免費～$5/月

---

## 📋 部署方案比較

### 方案 A：Azure App Service（適合 Express 全棧）

**優點：**
- ✅ 完美契合現有 Express 架構
- ✅ 靜態文件（login.html）自動處理
- ✅ 無冷啟動
- ✅ 程式碼幾乎零修改
- ✅ 部署最簡單（Git push）

**缺點：**
- 💰 需要付費（B1: ~$13/月）

**適合：想要最簡單遷移，效能穩定，不在意小額成本**

---

### 方案 B：Azure Functions（Serverless）

**優點：**
- 💰 免費額度充足（每月 100 萬次請求）
- ✅ 自動擴展
- ✅ 與 Vercel 概念相同

**缺點：**
- ⚠️ 靜態文件需要額外處理
- ⚠️ 有冷啟動（免費方案）
- ⚠️ 需要配置 Static Web Apps 或修改靜態文件處理方式

**適合：預算有限，可接受稍微複雜的配置**

---

## ⚠️ 程式碼修改指南

### 📌 修改程度對比

| 部署方案 | 程式碼修改 | 說明 |
|---------|-----------|------|
| **Azure App Service** | 極少（1 行） | 只需修改啟動邏輯判斷 |
| **Azure Functions** | 少（幾行） | 需要處理靜態文件 |
| **Vercel（目前）** | 無 | 已經在使用中 |

---

## 🚀 方案 A：Azure App Service 部署

### 程式碼修改（僅需一處）

#### 修改 `src/index.ts` 最後部分

**目前程式碼：**
```typescript
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

export default app;
```

**修改為（同時支援 Vercel 和 Azure App Service）：**
```typescript
// 判斷是否為 Vercel 環境
const isVercel = process.env.VERCEL === '1';

// Vercel: 不啟動伺服器（由平台處理）
// Azure App Service / 本地: 啟動伺服器
if (!isVercel) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 LINE Bot 伺服器啟動於 port ${PORT}`);
    console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log('✅ 伺服器準備就緒');
  });

  // 優雅關閉處理
  process.on('SIGTERM', () => {
    console.log('⚠️ 收到 SIGTERM 信號，準備關閉...');
    server.close(() => {
      console.log('✅ HTTP 伺服器已關閉');
      process.exit(0);
    });
  });
} else {
  console.log('🚀 LINE Bot 在 Vercel 環境中運行');
}

// 導出 app 供 Vercel 使用
export default app;
```

### 部署步驟

#### 1. 安裝 Azure CLI
```bash
brew install azure-cli
az login
```

#### 2. 創建資源
```bash
# 創建資源群組
az group create --name tscp-linebot-rg --location eastasia

# 創建 App Service 計劃（B1 基本方案）
az appservice plan create \
  --name tscp-linebot-plan \
  --resource-group tscp-linebot-rg \
  --sku B1 \
  --is-linux

# 創建 Web App
az webapp create \
  --resource-group tscp-linebot-rg \
  --plan tscp-linebot-plan \
  --name tscp-linebot \
  --runtime "NODE:18-lts"
```

#### 3. 設定環境變數
```bash
az webapp config appsettings set \
  --resource-group tscp-linebot-rg \
  --name tscp-linebot \
  --settings \
    LINE_CHANNEL_ACCESS_TOKEN="your_token" \
    LINE_CHANNEL_SECRET="your_secret" \
    REDIS_URL="your_redis_url" \
    API_BASE_URL="your_api_url" \
    STAFF_API_BASE_URL="your_staff_api_url" \
    WEBSOCKET_URL="your_websocket_url" \
    JWT_SECRET="your_jwt_secret" \
    NODE_ENV="production"
```

#### 4. 從 GitHub 部署（自動部署）
```bash
az webapp deployment source config \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --repo-url https://github.com/poyang1024/TSCP-line-bot \
  --branch main \
  --manual-integration
```

#### 5. 驗證部署
```bash
# 查看即時日誌
az webapp log tail --name tscp-linebot --resource-group tscp-linebot-rg

# 檢查狀態
az webapp show --name tscp-linebot --resource-group tscp-linebot-rg --query state
```

#### 6. 訪問測試
```
https://tscp-linebot.azurewebsites.net/login    ← login.html (自動處理)
https://tscp-linebot.azurewebsites.net/webhook  ← LINE webhook
https://tscp-linebot.azurewebsites.net/health   ← 健康檢查
```

#### 7. 更新 LINE Webhook URL
```
https://tscp-linebot.azurewebsites.net/webhook
```

**完成！所有功能（靜態文件 + API）都正常運作** ✅

---

## 🔧 方案 B：Azure Functions 部署（Serverless）

### 程式碼修改

#### 修改說明

Azure Functions 的程式碼修改較少，主要是配置部分。

**保留現有程式碼：**
- ✅ 保留 `vercel.json` 不影響（Azure Functions 不使用它）
- ✅ 保留 `api/index.js` 可作為參考
- ✅ 只需要調整環境變數和部署配置

---

### 1. 程式碼調整（最小改動）

#### 檔案：`vercel.json`
```json
// ✅ 保留不動，Azure Functions 會忽略此檔案
```

#### 檔案：`api/index.js`
```javascript
// ✅ 保留不動，或改名為 Azure Functions 入口點

// Azure Functions 入口點（如果需要）
const app = require('../dist/index.js');

module.exports = async function (context, req) {
  context.log('HTTP trigger function processed a request.');
  
  // Express app 已經處理好所有邏輯
  // 直接使用現有的 app
  return app.default || app;
};
```

**實際上目前的架構已經可以直接部署到 Azure Functions！**

---

### 2. 檢查目前的程式碼架構

#### 檔案：`src/index.ts`（第 318-342 行）

**目前程式碼** - **已經完美適配 Serverless**:
```typescript
// 本地開發時啟動伺服器，Vercel 環境會自動處理
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 LINE Bot 伺服器啟動於 http://localhost:${PORT}`);
    console.log(`� Webhook URL: http://localhost:${PORT}/webhook`);
    console.log('✅ 伺服器準備就緒，等待 LINE Platform 連線...');
  });
} else {
  console.log('🚀 LINE Bot 在 Vercel 環境中運行');
}

// 導出 app 供 Vercel/Azure Functions 使用
export default app;
```

**✅ 這段程式碼的優點：**
- ✅ **本地開發時**：啟動 HTTP 伺服器（`app.listen()`）
- ✅ **生產環境（Vercel/Azure Functions）**：由平台自動處理請求
- ✅ **完全不需要修改**，同時支援兩種環境
- ✅ 通過 `export default app` 導出給 serverless 平台使用

---

### 3. 環境變數處理（可選優化）

如果你希望在 Azure 環境中也能看到部署資訊，可以調整環境變數檢查：

#### 檔案：`src/index.ts`（第 24-26 行）

**目前程式碼**:
```typescript
console.log('VERCEL_DEPLOYMENT_ID:', process.env.VERCEL_DEPLOYMENT_ID?.substring(0, 12) || 'undefined');
console.log('VERCEL_GIT_COMMIT_SHA:', process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'undefined');
```

**改進為跨平台支援**（可選）:
```typescript
// 統一處理多平台部署資訊
const deploymentId = process.env.VERCEL_DEPLOYMENT_ID      // Vercel
  || process.env.WEBSITE_HOSTNAME                           // Azure Functions
  || process.env.DEPLOYMENT_ID                              // 自定義
  || 'local';

const gitCommit = process.env.VERCEL_GIT_COMMIT_SHA        // Vercel
  || process.env.BUILD_SOURCEVERSION                        // Azure DevOps
  || 'unknown';

console.log('🚀 部署平台:', 
  process.env.VERCEL ? 'Vercel' :
  process.env.WEBSITE_HOSTNAME ? 'Azure Functions' :
  'Local'
);
console.log('📦 Deployment ID:', deploymentId.substring(0, 12));
console.log('🔖 Git Commit:', gitCommit.substring(0, 8));
```

**但這不是必須的**，目前的程式碼在 Azure 上一樣可以正常運作。

---

### 靜態文件處理（Azure Functions 專用）

#### 問題：Azure Functions 不直接支援 `express.static`

目前程式碼中使用 `express.static('public')` 來服務 `login.html`，這在 Azure Functions 上需要特別處理。

**注意：Azure App Service 無此問題，原生支援 `express.static`**

#### 選項 1: 函數中直接返回 HTML（簡單）

**修改 `src/routes/index.ts`：**

```typescript
import fs from 'fs';
import path from 'path';

// 啟動時讀取 HTML 內容（只讀一次）
const loginHtml = fs.readFileSync(
  path.join(__dirname, '../../public/login.html'), 
  'utf-8'
);

// 網頁登入頁面
app.get('/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(loginHtml);
});
```

**優點：**
- ✅ 簡單直接
- ✅ 不需要額外服務

**缺點：**
- ⚠️ 每次請求都消耗 Function 執行時間
- ⚠️ 如果 HTML 中有外部 CSS/JS/圖片，需要 inline 或用 CDN

---

#### 選項 2: 使用 Azure Static Web Apps（免費 + CDN）

**為什麼推薦：**
- ✅ 免費（每月 100GB 頻寬）
- ✅ 自動 CDN 加速
- ✅ 與 Functions 無縫整合
- ✅ 支援自定義域名

**部署步驟：**

1. **創建 Static Web App**
```bash
az staticwebapp create \
  --name tscp-linebot-static \
  --resource-group tscp-linebot-rg \
  --source https://github.com/your-repo \
  --location eastasia \
  --branch main \
  --app-location "public" \
  --api-location "api"
```

2. **配置檔案：`staticwebapp.config.json`**
```json
{
  "routes": [
    {
      "route": "/login",
      "rewrite": "/login.html"
    },
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/login.html"
  }
}
```

3. **訪問方式：**
- 靜態頁面：`https://tscp-linebot-static.azurestaticapps.net/login`
- API：`https://tscp-linebot-static.azurestaticapps.net/api/webhook`

**優點：靜態文件和 API 在同一個域名下，無需 CORS 設定**

---

#### 方案 2: 在 Functions 中直接返回 HTML（簡單）

**修改 `src/routes/index.ts`：**

```typescript
import fs from 'fs';
import path from 'path';

// 讀取 HTML 文件內容（啟動時讀取一次）
const loginHtml = fs.readFileSync(
  path.join(__dirname, '../../public/login.html'), 
  'utf-8'
);

// 網頁登入頁面
app.get('/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(loginHtml);
});
```

**優點：**
- ✅ 不需要額外服務
- ✅ 簡單直接

**缺點：**
- ⚠️ 靜態資源（CSS、JS、圖片）需要用 CDN 或 inline
- ⚠️ 每次請求都會經過 Function

---

#### 方案 3: Azure Blob Storage + CDN

**適合：大量靜態文件**

```bash
# 創建儲存帳戶
az storage account create \
  --name tscpstatic \
  --resource-group tscp-linebot-rg \
  --sku Standard_LRS

# 啟用靜態網站
az storage blob service-properties update \
  --account-name tscpstatic \
  --static-website \
  --index-document login.html

# 上傳文件
az storage blob upload-batch \
  --account-name tscpstatic \
  --source public \
  --destination '$web'
```

**訪問：** `https://tscpstatic.z7.web.core.windows.net/login.html`

---

#### 推薦方案比較

| 方案 | 成本 | 複雜度 | 效能 | 推薦度 |
|------|------|--------|------|--------|
| Static Web Apps | 免費 | 中 | 最佳（CDN） | ⭐⭐⭐⭐⭐ |
| Functions 直接返回 | 免費 | 低 | 一般 | ⭐⭐⭐ |
| Blob + CDN | ~$1/月 | 高 | 很好 | ⭐⭐⭐⭐ |

**建議：使用 Azure Static Web Apps**

---

### 5. 檔案上傳處理（可選優化）

#### 檔案：`src/handlers/uploadHandler.ts`

**目前程式碼** (使用本地暫存):
```typescript
// Serverless: 使用 /tmp 目錄
const uploadDir = '/tmp/uploads';
```

**Azure 改進選項**:

**選項 1: 使用 /tmp（Functions 支援）**
```typescript
// 保持現狀，適用所有環境
const uploadDir = '/tmp/uploads';
```

**選項 2: Azure Blob Storage（推薦生產環境）**
```typescript
// 需要安裝: npm install @azure/storage-blob
import { BlobServiceClient } from '@azure/storage-blob';

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (AZURE_STORAGE_CONNECTION_STRING) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient('uploads');
  
  // 上傳到 Azure Blob Storage
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  await blockBlobClient.uploadData(buffer);
} else {
  // Fallback 到本地 /tmp
  const uploadDir = '/tmp/uploads';
}
```

**建議**: 
- 開發/測試：使用 /tmp
- 生產環境：使用 Azure Blob Storage（持久化、可擴展）

---

## 🚀 Azure Functions 部署（唯一推薦）

### 為什麼只推薦 Azure Functions？

1. ✅ **程式碼已經是 serverless 架構** - 完美契合，無需修改
2. ✅ **與 Vercel 概念相同** - 遷移最簡單
3. ✅ **免費額度充足** - 每月 100 萬次請求免費
4. ✅ **自動縮放** - 不用擔心流量問題
5. ✅ **成本最低** - 按使用量計費

### 部署步驟

#### 1. 安裝 Azure Functions Core Tools
```bash
brew tap azure/functions
brew install azure-functions-core-tools@4

# 驗證安裝
func --version
```

#### 2. 安裝 Azure CLI
```bash
brew install azure-cli
az login
```

#### 3. 創建 Azure 資源
```bash
# 創建資源群組
az group create --name tscp-linebot-rg --location eastasia

# 創建儲存帳戶（Functions 需要）
az storage account create \
  --name tscpstorage \
  --resource-group tscp-linebot-rg \
  --location eastasia \
  --sku Standard_LRS

# 創建 Functions App
az functionapp create \
  --resource-group tscp-linebot-rg \
  --consumption-plan-location eastasia \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name tscp-linebot \
  --storage-account tscpstorage \
  --os-type Linux
```

#### 4. 設定環境變數
```bash
az functionapp config appsettings set \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --settings \
    LINE_CHANNEL_ACCESS_TOKEN="your_token" \
    LINE_CHANNEL_SECRET="your_secret" \
    REDIS_URL="your_redis_url" \
    API_BASE_URL="your_api_url" \
    STAFF_API_BASE_URL="your_staff_api_url" \
    WEBSOCKET_URL="your_websocket_url" \
    JWT_SECRET="your_jwt_secret" \
    NODE_ENV="production"
```

#### 5. 準備專案結構

**注意：如果使用 Azure Static Web Apps，可以跳過這步，直接看下面的 Static Web Apps 部署**

在專案根目錄創建 `host.json`:
```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "http": {
    "routePrefix": ""
  }
}
```

在專案根目錄創建 `webhook/function.json`:
```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"],
      "route": "webhook"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ],
  "scriptFile": "../dist/index.js"
}
```

修改 `package.json` 添加部署腳本:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "func start",
    "deploy": "npm run build && func azure functionapp publish tscp-linebot"
  }
}
```

#### 6. 本地測試（可選）
```bash
# 啟動本地 Functions 模擬器
npm run build
npm start

# 測試 webhook
curl -X POST http://localhost:7071/api/webhook
```

#### 7. 部署到 Azure
```bash
# 建置並部署
npm run deploy

# 或分步執行
npm run build
func azure functionapp publish tscp-linebot --build remote
```

#### 8. 取得 Webhook URL
部署後的 URL 格式：
```
https://tscp-linebot.azurewebsites.net/webhook
```

#### 9. 更新 LINE Webhook URL
1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇你的 Channel
3. 在 Messaging API 設定中，更新 Webhook URL 為：
   ```
   https://tscp-linebot.azurewebsites.net/webhook
   ```
4. 點擊「Verify」驗證連線
5. 啟用「Use webhook」

---

## 🌐 處理靜態文件（login.html）

### 問題說明
目前 `login.html` 通過 `express.static('public')` 提供服務，在 Azure Functions 上需要特別處理。

### 推薦方案：Azure Static Web Apps + Functions

這是最佳解決方案，可以免費托管靜態文件並與 Functions 整合。

#### 1. 創建 Static Web App
```bash
az staticwebapp create \
  --name tscp-linebot-web \
  --resource-group tscp-linebot-rg \
  --location eastasia \
  --sku Free
```

#### 2. 在專案根目錄創建 `staticwebapp.config.json`
```json
{
  "routes": [
    {
      "route": "/login",
      "rewrite": "/login.html"
    }
  ],
  "navigationFallback": {
    "rewrite": "/login.html",
    "exclude": ["/api/*"]
  }
}
```

#### 3. 連結 GitHub（自動部署）
在 Azure Portal:
1. 前往 Static Web App → Deployment
2. 選擇 GitHub
3. 授權並選擇 repository
4. 設定：
   - Branch: `main`
   - App location: `public`
   - API location: 留空（使用獨立的 Functions App）

#### 4. 更新 LINE Bot 使用 Static Web App URL
```typescript
// src/handlers/richMenuHandler.ts
// 將登入 URL 改為 Static Web App
uri: `https://tscp-linebot-web.azurestaticapps.net/login?userId=${userId}`
```

#### 5. 最終架構
```
https://tscp-linebot-web.azurestaticapps.net/login  ← 靜態頁面
https://tscp-linebot.azurewebsites.net/webhook      ← Functions API
```

**優點：**
- ✅ 完全免費（靜態托管 + Functions 免費額度）
- ✅ CDN 加速
- ✅ 自動 HTTPS
- ✅ GitHub 自動部署

### 替代方案：Functions 直接返回 HTML（簡單但不推薦）

如果不想用 Static Web Apps，可以修改程式碼：

```typescript
// src/routes/index.ts
import fs from 'fs';
import path from 'path';

// 啟動時讀取 HTML 內容
const loginHtml = fs.readFileSync(
  path.join(__dirname, '../../public/login.html'), 
  'utf-8'
);

app.get('/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(loginHtml);
});
```

**缺點：**
- 每次請求都消耗 Function 執行時間
- 無 CDN 加速
- 如果 HTML 中有 CSS/JS/圖片，需要 inline 或用外部 CDN

---

## 📋 部署檢查清單

### Azure App Service 部署

#### 程式碼準備
- [ ] 修改 `src/index.ts` 添加 Vercel 環境判斷（1 行修改）
- [ ] 測試本地開發環境：`npm run dev`
- [ ] 確認建置成功：`npm run build`

#### Azure 資源
- [ ] 安裝 Azure CLI：`brew install azure-cli`
- [ ] 登入 Azure：`az login`
- [ ] 創建資源群組
- [ ] 創建 App Service Plan (B1)
- [ ] 創建 Web App
- [ ] 設定 Redis（推薦 Upstash 免費方案）

#### 環境變數
- [ ] `LINE_CHANNEL_ACCESS_TOKEN`
- [ ] `LINE_CHANNEL_SECRET`
- [ ] `REDIS_URL`
- [ ] `API_BASE_URL`
- [ ] `STAFF_API_BASE_URL`
- [ ] `WEBSOCKET_URL`
- [ ] `JWT_SECRET`
- [ ] `NODE_ENV=production`

#### 部署與驗證
- [ ] 從 GitHub 設定自動部署
- [ ] 訪問測試：`https://tscp-linebot.azurewebsites.net/health`
- [ ] 檢查靜態文件：`https://tscp-linebot.azurewebsites.net/login`
- [ ] 更新 LINE Webhook URL
- [ ] 發送測試訊息驗證

---

### Azure Functions 部署

#### 程式碼準備
- [ ] **程式碼幾乎不需修改**（已經是 serverless 架構）
- [ ] 決定靜態文件處理方式（直接返回 or Static Web Apps）
- [ ] 測試本地開發環境：`npm run dev`
- [ ] 確認建置成功：`npm run build`

#### Azure 資源
- [ ] 安裝 Azure CLI：`brew install azure-cli`
- [ ] 安裝 Azure Functions Core Tools：`brew install azure-functions-core-tools@4`
- [ ] 登入 Azure：`az login`
- [ ] 創建資源群組
- [ ] 創建儲存帳戶
- [ ] 創建 Functions App
- [ ] （可選）創建 Static Web App 用於靜態文件

#### 必要文件
- [ ] 創建 `host.json`
- [ ] 創建 `webhook/function.json`
- [ ] 更新 `package.json` 添加部署腳本

#### 環境變數
- [ ] `LINE_CHANNEL_ACCESS_TOKEN`
- [ ] `LINE_CHANNEL_SECRET`
- [ ] `REDIS_URL`
- [ ] `API_BASE_URL`
- [ ] `STAFF_API_BASE_URL`
- [ ] `WEBSOCKET_URL`
- [ ] `JWT_SECRET`
- [ ] `NODE_ENV=production`

#### 部署與驗證
- [ ] 本地測試：`func start`
- [ ] 部署：`func azure functionapp publish tscp-linebot`
- [ ] 訪問測試 webhook
- [ ] 處理靜態文件（如使用 Static Web Apps）
- [ ] 更新 LINE Webhook URL
- [ ] 發送測試訊息驗證

---

## 💰 成本估算

| 服務 | 方案 | 月費用（USD） | 備註 |
|------|------|--------------|------|
| **Azure App Service (B1)** | Basic | **~$13** | 無冷啟動，適合全棧應用 ⭐ |
| **Azure Functions** | 消費方案 | **免費 - $5** | 前 100 萬次請求免費 |
| Azure Static Web Apps | Free | **$0** | 配合 Functions 使用 |
| Azure Cache for Redis | Basic C0 | ~$15 | 穩定可靠 |
| **Upstash Redis** | 免費方案 | **$0** | 10,000 命令/天 ⭐ |
| | | | |
| **推薦組合 1** | App Service + Upstash | **~$13/月** | 最簡單 ⭐⭐⭐⭐⭐ |
| **推薦組合 2** | Functions + Static Web Apps + Upstash | **$0-5/月** | 最經濟 ⭐⭐⭐⭐ |
| **Vercel (目前)** | Hobby 方案 | **$0** | 免費運作良好 ⭐⭐⭐⭐⭐ |

---
- [ ] 登入 Azure：`az login`
- [ ] 創建資源群組
- [ ] 創建 Functions App
- [ ] 設定 Redis（推薦 Upstash 免費方案）

### 必要文件
- [ ] 創建 `host.json`
- [ ] 創建 `webhook/function.json`
- [ ] 更新 `package.json` 添加部署腳本

### 環境變數（在 Azure Portal 或 CLI 設定）
- [ ] `LINE_CHANNEL_ACCESS_TOKEN`
- [ ] `LINE_CHANNEL_SECRET`
- [ ] `REDIS_URL`
- [ ] `API_BASE_URL`
- [ ] `STAFF_API_BASE_URL`
- [ ] `WEBSOCKET_URL`
- [ ] `JWT_SECRET`
- [ ] `NODE_ENV=production`

### LINE 設定
- [ ] 更新 Webhook URL 為 Azure Functions URL
- [ ] 驗證 Webhook 連線（LINE Console 中點擊 Verify）
- [ ] 啟用 Webhook
- [ ] 發送測試訊息驗證功能

---

## 🔒 安全性建議

1. **使用 Azure Key Vault 儲存機密**
```bash
az keyvault create \
  --name tscp-keyvault \
  --resource-group tscp-linebot-rg

az keyvault secret set \
  --vault-name tscp-keyvault \
  --name line-channel-token \
  --value "your_token"
```

2. **啟用 Managed Identity**
```bash
az webapp identity assign \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg
```

3. **設定網路安全規則**
- 限制 Webhook 只接受 LINE 平台的 IP
- 使用 Azure Firewall 或 NSG

---

## 🚀 持續部署 (CI/CD)

### 使用 GitHub Actions

創建 `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
    
    - name: Login to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
    
    - name: Deploy to Azure Web App
      uses: azure/webapps-deploy@v2
      with:
        app-name: 'tscp-linebot'
        package: .
```

---

## 📊 監控與日誌

### Azure Application Insights

```bash
# 啟用 Application Insights
az monitor app-insights component create \
  --app tscp-linebot-insights \
  --location eastasia \
  --resource-group tscp-linebot-rg

# 取得 Instrumentation Key
az monitor app-insights component show \
  --app tscp-linebot-insights \
  --resource-group tscp-linebot-rg \
  --query instrumentationKey
```

在程式碼中添加:
```typescript
import * as appInsights from 'applicationinsights';

if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
  appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .start();
}
```

---

## 🎯 最終建議

### 選擇流程圖

```
需要遷移到 Azure？
│
├─ 是 → 預算考量？
│       │
│       ├─ 願意付費 (~$13/月) → ✅ Azure App Service
│       │                        • 零修改（1行判斷）
│       │                        • 部署最簡單
│       │                        • 效能最穩定
│       │
│       └─ 追求免費 → ✅ Azure Functions + Static Web Apps
│                      • 需要處理靜態文件
│                      • 配置稍複雜
│                      • 免費額度充足
│
└─ 否 → ✅ 繼續使用 Vercel
         • 免費
         • 運作良好
         • 零修改
```

### 具體建議

1. **如果 Vercel 運作正常** → **繼續使用 Vercel**
   - 免費且簡單
   - 效能足夠
   - 無需遷移成本

2. **如果要遷移 Azure 且重視簡單性** → **Azure App Service**
   - 只需改一行程式碼
   - 部署最簡單
   - 適合 Express 全棧架構
   - 成本合理（$13/月）

3. **如果要 Azure 且預算有限** → **Azure Functions**
   - 免費額度充足
   - 需要額外處理靜態文件
   - 適合純 API 或願意接受複雜度

---

---

## 🌐 域名設定

### Azure 免費預設域名

**好消息：Azure App Service 和 Functions 都提供免費的預設域名！**

#### Azure App Service 預設域名

創建 App Service 後，會自動獲得免費域名：
```
https://[你的應用名稱].azurewebsites.net
```

**範例：**
```
https://tscp-linebot.azurewebsites.net
```

**特點：**
- ✅ **完全免費**
- ✅ **自動 HTTPS**（Azure 提供的 SSL 證書）
- ✅ **立即可用**（創建後馬上能使用）
- ✅ **無需購買域名**
- ✅ **適合開發、測試、生產環境**

**直接使用預設域名的好處：**
1. 省去購買域名的費用（~$10-15/年）
2. 無需設定 DNS
3. 無需管理 SSL 證書
4. LINE Bot 完全可以使用此域名

**LINE Webhook URL 範例：**
```
https://tscp-linebot.azurewebsites.net/webhook
```

**登入頁面 URL 範例：**
```
https://tscp-linebot.azurewebsites.net/login
```

---

#### Azure Functions 預設域名

同樣，Functions App 也有免費域名：
```
https://[你的函數名稱].azurewebsites.net
```

**範例：**
```
https://tscp-linebot.azurewebsites.net/api/webhook
```

---

#### Azure Static Web Apps 預設域名

Static Web Apps 提供不同的免費域名：
```
https://[應用名稱]-[隨機字串].azurestaticapps.net
```

**範例：**
```
https://tscp-linebot-web-abc123.azurestaticapps.net
```

---

### 🆚 免費域名 vs 自訂域名比較

| 項目 | Azure 免費域名 | 自訂域名 |
|------|---------------|----------|
| **費用** | ✅ 免費 | 💰 ~$10-15/年 |
| **HTTPS** | ✅ 自動提供 | ✅ Azure 免費提供 |
| **設定難度** | ✅ 零設定（自動） | ⚠️ 需要 DNS 設定 |
| **專業性** | ⚠️ 較不專業 | ✅ 更專業 |
| **品牌形象** | ⚠️ 顯示 `.azurewebsites.net` | ✅ 自己的品牌域名 |
| **LINE Bot 使用** | ✅ 完全可用 | ✅ 完全可用 |
| **範例** | `tscp-linebot.azurewebsites.net` | `api.yourdomain.com` |

---

### 💡 建議

#### 對於 LINE Bot 專案：

**使用免費域名即可！**
- ✅ LINE Bot 用戶不會看到域名（都在 LINE app 內操作）
- ✅ 只有 Webhook 和登入頁面會用到域名
- ✅ Azure 免費域名完全夠用
- ✅ 省下買域名的費用

**只有以下情況才需要自訂域名：**
- 需要品牌形象（例如公司官方 API）
- 需要短且易記的網址
- 有多個服務需要統一域名
- 對外公開的 API 服務

---

### 自訂域名設定（可選）

如果你仍然想使用自訂域名，以下是完整設定指南。

#### 1. 購買域名
可以從以下提供商購買域名：
- Namecheap
- GoDaddy
- Cloudflare
- Google Domains
- 或任何域名註冊商

#### 2. 在 Azure 中添加自訂域名

**使用 Azure CLI：**
```bash
# 添加自訂域名
az webapp config hostname add \
  --webapp-name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --hostname yourdomain.com

# 或使用子域名
az webapp config hostname add \
  --webapp-name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --hostname api.yourdomain.com
```

**或在 Azure Portal 中：**
1. 前往 App Service → 自訂域名
2. 點擊「新增自訂域名」
3. 輸入你的域名（例如：`api.yourdomain.com`）
4. 點擊「驗證」

#### 3. 設定 DNS 記錄

在你的域名提供商（如 Cloudflare、Namecheap）設定 DNS：

**選項 A：使用 CNAME（推薦用於子域名）**
```
類型: CNAME
名稱: api (或其他子域名)
值: tscp-linebot.azurewebsites.net
TTL: 自動或 3600
```

**選項 B：使用 A 記錄（用於根域名）**
```
類型: A
名稱: @ (或留空)
值: [Azure App Service IP]
TTL: 3600

類型: TXT
名稱: asuid
值: [Azure 驗證碼]
```

**取得 Azure IP 地址：**
```bash
az webapp show \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --query outboundIpAddresses
```

#### 4. 啟用 HTTPS（SSL/TLS）

**免費 SSL 證書（推薦）：**
```bash
# 啟用 Azure 管理的免費 SSL 證書
az webapp config ssl bind \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

**或在 Azure Portal：**
1. App Service → TLS/SSL 設定
2. 自訂域名綁定
3. 選擇「新增綁定」
4. 選擇域名和「Azure 管理的證書（免費）」
5. 點擊「新增綁定」

#### 5. 強制 HTTPS

```bash
# 強制所有流量使用 HTTPS
az webapp update \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --set httpsOnly=true
```

#### 6. 更新 LINE Webhook URL

更新為你的自訂域名：
```
https://api.yourdomain.com/webhook
```

#### 7. 驗證設定

```bash
# 測試域名解析
nslookup api.yourdomain.com

# 測試 HTTPS 連線
curl -I https://api.yourdomain.com/health

# 測試 Webhook
curl -X POST https://api.yourdomain.com/webhook
```

---

### Azure Functions 自訂域名

#### 1. 添加自訂域名

```bash
# 添加自訂域名到 Functions App
az functionapp config hostname add \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --hostname api.yourdomain.com
```

#### 2. 設定 DNS（同 App Service）

在域名提供商設定 CNAME：
```
類型: CNAME
名稱: api
值: tscp-linebot.azurewebsites.net
```

#### 3. 啟用 SSL

```bash
# Functions App 自動提供免費 SSL
az functionapp config ssl bind \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

---

### Azure Static Web Apps 自訂域名

如果使用 Static Web Apps 托管靜態文件：

#### 1. 添加自訂域名

```bash
# 添加自訂域名到 Static Web App
az staticwebapp hostname set \
  --name tscp-linebot-web \
  --resource-group tscp-linebot-rg \
  --hostname www.yourdomain.com
```

#### 2. 設定 DNS

```
類型: CNAME
名稱: www
值: [Static Web App 提供的域名]
TTL: 3600
```

#### 3. SSL 自動處理

Static Web Apps 自動提供免費 SSL 證書，無需額外設定。

---

### 使用 Cloudflare（推薦）

#### 優點：
- ✅ 免費 SSL 證書
- ✅ 全球 CDN 加速
- ✅ DDoS 防護
- ✅ 靈活的 DNS 管理
- ✅ 分析和監控

#### 設定步驟：

1. **將域名 DNS 指向 Cloudflare**
   - 註冊 Cloudflare 帳號
   - 添加你的域名
   - 更新域名註冊商的 Nameservers

2. **在 Cloudflare 設定 DNS**
   ```
   類型: CNAME
   名稱: api
   目標: tscp-linebot.azurewebsites.net
   Proxy 狀態: 已代理
   ```

3. **Cloudflare SSL 設定**
   - SSL/TLS 模式：選擇「完整」或「完整（嚴格）」
   - Edge Certificates：自動啟用免費 SSL

4. **頁面規則（可選）**
   ```
   規則: *api.yourdomain.com/*
   設定: 
     - SSL: 完整
     - 快取等級: 繞過（API 不快取）
     - 自動最小化: 關閉
   ```

5. **更新 Azure CORS（如果需要）**
   ```bash
   az webapp cors add \
     --name tscp-linebot \
     --resource-group tscp-linebot-rg \
     --allowed-origins "https://yourdomain.com"
   ```

---

### 域名配置檢查清單

#### DNS 設定
- [ ] 購買域名
- [ ] 設定 DNS 記錄（CNAME 或 A）
- [ ] 驗證 DNS 解析：`nslookup api.yourdomain.com`
- [ ] 等待 DNS 傳播（可能需要 5 分鐘到 48 小時）

#### Azure 設定
- [ ] 在 Azure 添加自訂域名
- [ ] 驗證域名所有權
- [ ] 啟用 Azure 管理的 SSL 證書
- [ ] 啟用 HTTPS 強制重定向
- [ ] 測試 HTTPS 連線

#### LINE Bot 設定
- [ ] 更新 Webhook URL 為自訂域名
- [ ] 驗證 Webhook 連線
- [ ] 發送測試訊息
- [ ] 檢查所有功能正常

#### 可選優化
- [ ] 設定 Cloudflare CDN
- [ ] 設定 DNS CAA 記錄
- [ ] 設定 HSTS
- [ ] 監控 SSL 證書過期時間

---

### 常見域名問題排除

#### 問題 1: DNS 未解析
```bash
# 檢查 DNS
nslookup api.yourdomain.com

# 檢查多個 DNS 伺服器
nslookup api.yourdomain.com 8.8.8.8
nslookup api.yourdomain.com 1.1.1.1
```

**解決：**
- 確認 DNS 記錄設定正確
- 等待 DNS 傳播（最多 48 小時）
- 清除本地 DNS 快取：`sudo dscacheutil -flushcache`

#### 問題 2: SSL 證書錯誤
**解決：**
```bash
# 檢查 SSL 證書
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com

# 重新綁定證書
az webapp config ssl bind \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg \
  --certificate-thumbprint auto \
  --ssl-type SNI
```

#### 問題 3: Azure 域名驗證失敗
**解決：**
- 確認 DNS TXT 記錄正確
- 等待 DNS 傳播
- 檢查域名沒有被其他 Azure 資源使用

#### 問題 4: Cloudflare 與 Azure SSL 衝突
**解決：**
- Cloudflare SSL 模式設為「完整」或「完整（嚴格）」
- 確保 Azure 已啟用 SSL
- 不要使用「彈性」模式

---

## ⚡ 效能優化

1. **使用 Azure CDN** 快取靜態資源
2. **啟用 Auto-scaling** 處理流量高峰
3. **使用 Azure Front Door** 實現全球負載平衡
4. **優化 Redis 連線池**

---

## 🆘 故障排除

### 問題 1: 應用程式無法啟動
```bash
# 查看即時日誌
az webapp log tail --name tscp-linebot --resource-group tscp-linebot-rg

# 檢查環境變數
az webapp config appsettings list \
  --name tscp-linebot \
  --resource-group tscp-linebot-rg
```

### 問題 2: Webhook 驗證失敗
- 確認 LINE_CHANNEL_SECRET 正確
- 檢查 Azure 網址是否為 HTTPS
- 驗證簽章計算邏輯

### 問題 3: Redis 連線失敗
```bash
# 測試 Redis 連線
redis-cli -h your-redis.redis.cache.windows.net -p 6380 -a your-password --tls
```

---

## 📚 延伸閱讀

- [Azure App Service 文檔](https://docs.microsoft.com/azure/app-service/)
- [Azure Container Apps 文檔](https://docs.microsoft.com/azure/container-apps/)
- [Azure Cache for Redis](https://docs.microsoft.com/azure/azure-cache-for-redis/)
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)

---

## ✅ 部署完成後

1. 更新 LINE Developers Console 的 Webhook URL
2. 發送測試訊息驗證功能
3. 監控 Azure Portal 的效能指標
4. 設定警示規則（CPU、記憶體、錯誤率）
