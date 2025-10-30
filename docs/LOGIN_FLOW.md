# 簡化版登入流程說明

## 功能特色

✅ **帳號密碼登入** - 支援傳統帳號密碼登入方式  
✅ **優化用戶體驗** - 使用 emoji 和清楚的引導文字
✅ **JWT + Redis** - 混合式狀態管理，適合 Serverless 環境

## 登入流程

### 1. 觸發登入
用戶輸入 `登入` 或 `會員登入` 時，系統會提示輸入帳號

### 2. 登入方式
- 🔑 **帳號密碼登入** - 唯一支援的登入方式

### 3. 登入步驟

#### 帳號密碼登入
1. 用戶輸入「登入」
2. 系統提示：「🔑 請輸入您的帳號：」
3. 用戶輸入帳號
4. 系統提示：「🔐 請輸入您的密碼：」
5. 用戶輸入密碼
6. 系統驗證成功後：
   - 產生 JWT Token
   - 儲存登入狀態到 Redis (7 天過期)
   - 切換到會員 Rich Menu
   - 顯示登入成功訊息

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

### UserState 型別
```typescript
interface UserState {
  userId: string;
  memberId?: number;
  accessToken?: string;
  currentStep?: string;
  loginMethod?: 'account';  // 僅支援帳號密碼
  tempData?: any;
}
```

### Redis 登入狀態儲存
```typescript
// 儲存格式
{
  "memberId": 123,
  "accessToken": "token_string",
  "memberName": "用戶名稱",
  "loginTime": 1694678400000
}

// 過期時間：7 天 (與 JWT 一致)
```

## 錯誤處理

- ✅ 登入失敗處理（顯示錯誤訊息並重試）
- ✅ 系統錯誤處理
- ✅ 無效輸入處理
- ✅ JWT Token 過期自動清除
- ✅ Redis 連線失敗容錯處理
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
