# Azure 部署指南

## 概述

本指南說明如何將 LINE Bot 從 Vercel 遷移到 Azure，包括程式碼調整和部署配置。

---

## 🔄 Vercel vs Azure Functions 差異對比

| 項目 | Vercel | Azure Functions |
|------|--------|-----------------|
| **架構** | Serverless Functions | Serverless Functions |
| **請求限制** | 30 秒（Hobby）/ 60 秒（Pro） | 預設 5 分鐘（可調整到 10 分鐘）|
| **狀態管理** | 無狀態（每次請求可能不同實例） | 無狀態（每次請求可能不同實例） |
| **檔案系統** | 唯讀（/tmp 可寫） | /tmp 可寫 |
| **環境變數** | Vercel Dashboard | Azure Portal / CLI |
| **部署方式** | Git 推送自動部署 | CLI / Git / CI/CD |
| **免費額度** | Hobby 方案限制 | 每月 100 萬次請求免費 |
| **程式碼相容性** | ✅ 完全相容 | ✅ 幾乎無需修改 |

---

## ⚠️ 需要修改的程式碼部分

### 📌 重要提示

**使用 Azure Functions（唯一推薦）**:
- ✅ **程式碼幾乎不需要修改**（已經是 serverless 架構）
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

### 4. 檔案上傳處理（可選優化）

#### 檔案：`src/handlers/uploadHandler.ts`

**目前程式碼** (使用本地暫存):
```typescript
// Serverless: 使用 /tmp 目錄
const uploadDir = '/tmp/uploads';
```

**Azure 改進選項**:

**選項 1: 使用 /tmp（Functions 和 App Service 都支援）**
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

## � Azure Functions 部署（唯一推薦）

### 為什麼只推薦 Azure Functions？

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

## 📋 部署前檢查清單

### 程式碼準備
- [x] **程式碼已經符合 serverless 架構** - 無需修改
- [ ] 測試本地開發環境正常：`npm run dev`
- [ ] 確認 `dist/` 目錄可以正常建置：`npm run build`

### Azure 資源
- [ ] 創建 Azure 帳號（或使用現有帳號）
- [ ] 安裝 Azure CLI：`brew install azure-cli`
- [ ] 安裝 Azure Functions Core Tools：`brew install azure-functions-core-tools@4`
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

## 💰 成本估算

| 服務 | 方案 | 月費用（USD） | 備註 |
|------|------|--------------|------|
| **Azure Functions** | 消費方案 | **免費 - $5** | 前 100 萬次請求免費 ⭐ 推薦 |
| Azure Cache for Redis | Basic C0 (250MB) | ~$15 | 穩定可靠 |
| **Upstash Redis** | 免費方案 | **$0** | 10,000 命令/天 ⭐ 推薦開發/小型專案 |
| **推薦組合 (Functions + Upstash)** | | **$0-5/月** | 最經濟選擇 💰 |
| **推薦組合 (Functions + Azure Redis)** | | **~$15-20/月** | 穩定生產環境 |

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
