# 簡化版登入流程說明

## 功能特色

✅ **Flex Message 選單式登入** - 提供視覺化的登入選項選單  
✅ **帳號密碼登入** - 支援傳統帳號密碼登入方式  
✅ **保留 LINE 官方登入** - 為後續整合 LINE Login 預留接口  
✅ **優化用戶體驗** - 使用 emoji 和清楚的引導文字  

## 登入流程

### 1. 觸發登入
用戶輸入 `登入` 或 `會員登入` 時，系統會顯示登入選單

### 2. 登入選單選項
-  **帳號密碼登入** - 使用傳統帳號 + 密碼
- 📲 **LINE 官方登入** - 預留功能（目前連結到 line.me）

### 3. 登入步驟

#### 帳號密碼登入
1. 用戶點選「🔑 帳號密碼登入」
2. 系統提示：「🔑 請輸入您的帳號：」
3. 用戶輸入帳號
4. 系統提示：「🔐 請輸入您的密碼：」
5. 用戶輸入密碼，完成登入

## 技術實作

### 文件結構
```
src/
├── handlers/
│   ├── loginHandler.ts      # 登入邏輯處理
│   ├── messageHandler.ts    # 訊息路由
│   └── postbackHandler.ts   # Postback 事件處理
├── types/
│   └── index.ts            # 型別定義（新增 loginMethod）
└── services/
    └── userService.ts      # 用戶狀態管理
```

### 主要功能

#### `createLoginMenu(userId: string)`
- 產生 Flex Message 登入選單
- 包含四種登入方式的按鈕
- 使用 Postback 事件處理用戶選擇

#### `handleLoginPostback(event: PostbackEvent, client: Client)`
- 處理登入選單的按鈕點擊事件
- 只處理帳號密碼登入的選擇
- 引導用戶進入帳號輸入流程

#### `handleLogin(event: MessageEvent, client: Client)`
- 處理用戶的文字輸入
- 根據 `currentStep` 判斷當前登入階段（帳號 → 密碼）
- 簡化的登入流程

#### `performLogin()` 
- 統一的登入執行邏輯
- 呼叫後端 API 進行身份驗證
- 處理登入成功/失敗的回應

### UserState 型別更新
```typescript
interface UserState {
  userId: string;
  memberId?: number;
  accessToken?: string;
  currentStep?: string;
  loginMethod?: 'account' | 'line';  // 簡化
  tempData?: any;
}
```

### 預留功能

#### LINE Login 整合
```typescript
function generateLineLoginUrl(userId: string, state?: string): string {
  // OAuth 2.0 登入 URL 產生
  // 需要設定 LINE_CHANNEL_ID 和 LINE_LOGIN_REDIRECT_URI
}
```

## 錯誤處理

- ✅ 登入失敗處理（重新顯示登入選單）
- ✅ 系統錯誤處理
- ✅ 無效輸入處理

## 後續擴展

1. **LINE Login 整合**
   - 設定 LINE Login Channel
   - 實作 OAuth 回調處理
   - 整合 LINE 用戶資料

2. **生物辨識登入**
   - 指紋/Face ID 整合
   - 安全性增強

3. **QR Code 登入**
   - 產生一次性 QR Code
   - 掃描登入功能

4. **多因子認證**
   - SMS 驗證碼
   - Email 確認
   - TOTP 應用程式

## 使用說明

用戶只需要：
1. 在 LINE Bot 中輸入「登入」
2. 選擇喜好的登入方式
3. 按照提示輸入資訊即可

系統會自動引導用戶完成整個登入流程，無需複雜的指令記憶。
