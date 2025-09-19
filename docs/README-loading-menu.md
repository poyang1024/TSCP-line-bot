# Loading Rich Menu 部署指南

## 概述
Loading Rich Menu 是為了提供用戶視覺回饋的特殊選單，在系統處理請求時顯示「處理中...」狀態。

## 前置條件
1. 確認 `.env` 檔案中有正確的 LINE Bot 認證資訊
2. 確認 `public/loading_richmenu.png` 圖片檔案存在

## 部署步驟

### 1. 單獨建立 Loading Rich Menu
```bash
node scripts/setup-loading-menu.js
```

### 2. 或建立所有 Rich Menu（包含 Loading）
```bash
node scripts/setup-rich-menus.js
```

## 環境變數設定
執行完成後，將輸出的 Rich Menu ID 加入 `.env` 檔案：

```env
LOADING_RICH_MENU_ID=your_loading_menu_id_here
```

## 功能說明

### 1. 自動切換機制
- 用戶點擊按鈕 → 立即切換到 Loading Rich Menu
- 處理完成 → 自動恢復到正常 Rich Menu
- 錯誤發生 → 自動恢復到正常 Rich Menu

### 2. 使用場景
- 查看訂單列表
- 查看訂單詳情
- 聯絡藥局
- 會員中心載入
- 其他需要處理時間的操作

### 3. 技術優勢
- ✅ 減少 pushMessage 使用量
- ✅ 避免 replyToken 消耗問題
- ✅ 提供即時視覺回饋
- ✅ 解決 429 API 限制錯誤

## 故障排除

### 圖片不存在
如果看到警告訊息，請確認：
1. `public/loading_richmenu.png` 檔案存在
2. 圖片尺寸為 2500x1686 像素
3. 圖片格式為 PNG

### API 錯誤
如果建立失敗，請檢查：
1. LINE_CHANNEL_ACCESS_TOKEN 是否正確
2. LINE_CHANNEL_SECRET 是否正確
3. 網路連線是否正常

## 維護
- 定期檢查 Rich Menu 是否正常運作
- 如需更新圖片，重新執行部署腳本
- 監控 API 使用量變化