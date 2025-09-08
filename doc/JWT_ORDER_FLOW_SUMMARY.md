# JWT 登入狀態管理和訂單流程防呆機制

## 實現的功能

### 1. JWT 登入狀態管理
- **完全移除記憶體中的登入狀態儲存**
- 登入狀態完全由 JWT Token 管理，適合 Vercel 無伺服器環境
- 新增短期 JWT 快取機制 (5分鐘)，避免同一流程中重複解析 JWT
- 保持向後相容性，現有程式碼無需大幅修改

### 2. 訂單流程 3 分鐘超時機制
- 訂單步驟開始後，系統會記錄開始時間
- 3 分鐘後自動清除所有訂單步驟和相關暫存資料
- 包含以下步驟：
  - `prescription_uploaded` - 藥單上傳完成
  - `pharmacy_selected` - 藥局選擇完成
  - `processing_image` - 圖片處理中

### 3. 訂單流程防呆機制
- **步驟進行中阻止其他服務操作**
- 用戶在訂單流程中無法使用其他功能 (除了取消操作)
- 允許的取消命令：`取消`、`重新開始`、`主選單`、`選單`、`登出`
- 系統會提示用戶完成當前步驟或取消流程

## 技術實現細節

### 新增的類型定義
```typescript
// 訂單步驟枚舉
export enum OrderStep {
  NONE = '',
  PRESCRIPTION_UPLOADED = 'prescription_uploaded',
  PHARMACY_SELECTED = 'pharmacy_selected',
  ORDER_CONFIRMED = 'order_confirmed',
  PROCESSING_IMAGE = 'processing_image'
}

// 訂單步驟超時設定（3分鐘）
export const ORDER_STEP_TIMEOUT = 3 * 60 * 1000;
```

### 關鍵函數

#### 用戶服務 (userService.ts)
- `setOrderStep(userId, step)` - 設定訂單步驟並開始計時
- `getOrderStep(userId)` - 取得當前步驟 (自動檢查超時)
- `clearOrderStep(userId)` - 清除訂單步驟和相關資料
- `isUserInOrderProcess(userId)` - 檢查是否在訂單流程中
- `cacheUserJwtToken(userId, token)` - 快取 JWT token
- `getUserState(userId)` - 改良版，會從快取的 JWT 中獲取登入狀態

#### 訊息處理 (messageHandler.ts)
- 新增訂單流程檢查，阻止非相關操作
- 允許特定取消命令來終止流程

#### 上傳處理 (uploadHandler.ts)
- 使用新的 `OrderStep.PRESCRIPTION_UPLOADED`
- 開始訂單流程計時

#### Postback 處理 (postbackHandler.ts)
- 新增訂單流程中的操作限制
- 區分訂單相關操作和系統操作

## 記憶體使用優化

### 之前的問題
- 登入狀態永久存在記憶體中
- 不適合 Vercel 等無伺服器環境
- 伺服器重啟後登入狀態遺失

### 現在的解決方案
- **登入狀態**：完全由 JWT 管理，不存記憶體
- **訂單暫存資料**：僅在訂單流程中存在，3分鐘自動清除
- **JWT 快取**：短期快取 (5分鐘)，提升效能但不依賴
- **適合生產環境**：Vercel 部署完全相容

## 用戶體驗改善

### 防呆機制
1. **流程中阻止其他操作**：避免用戶在下藥單過程中誤觸其他功能
2. **清晰的提示訊息**：告知用戶當前狀態和可用操作
3. **彈性的取消機制**：隨時可以取消當前流程

### 超時保護
1. **自動清理機制**：3分鐘後自動重設，避免卡住
2. **狀態一致性**：確保系統狀態的正確性
3. **資源管理**：避免記憶體洩漏

## 向後相容性

- 現有的 `getUserState()` 函數介面不變
- 現有的處理流程程式碼無需修改
- 平滑升級，不影響現有功能

## 部署注意事項

### Vercel 環境
- JWT_SECRET 環境變數必須設定
- 確保檔案上傳目錄設定正確 (`/tmp` for Vercel)
- WebSocket 連線在無伺服器環境中的限制需要考慮

### 安全性
- JWT Token 過期時間：7天
- 短期快取過期時間：5分鐘
- 訂單流程超時：3分鐘
- 敏感資料不會永久存在記憶體中
