# 圖文選單設定指南

這個資料夾包含了設定 LINE Bot 圖文選單的腳本工具。

## 檔案說明

- `setup-rich-menus.js` - 基本的圖文選單建立腳本
- `manage-rich-menus.js` - 互動式圖文選單管理工具

## 使用方法

### 1. 快速建立圖文選單

```bash
npm run setup-menus
```

這個命令會：
- 建立訪客圖文選單
- 建立會員圖文選單
- 上傳對應的圖片 (from `public/` 資料夾)
- 顯示需要加入 `.env` 檔案的 ID

### 2. 互動式管理

```bash
npm run manage-menus
```

這個工具提供：
- 列出現有圖文選單
- 建立新的圖文選單
- 刪除指定圖文選單
- 建立完整選單組合
- 自動更新 `.env` 檔案

## 圖片檔案

請確保在 `public/` 資料夾中有以下圖片：
- `guest_richmenu.jpg` - 訪客選單圖片 (2500x1686)
- `member_richmenu.jpg` - 會員選單圖片 (2500x1686)

## 圖文選單配置

### 訪客選單區域
```
[    中藥預約（需登入）    ]  <- 上方整排，點擊提示登入
[藥師諮詢][中藥新知][了解更多]  <- 下方三格，開放功能
```

### 會員選單區域
```
[    中藥預約（可使用）    ]  <- 上方整排，直接進入預約
[藥師諮詢][中藥新知][會員中心]  <- 下方三格，包含會員功能
```

## 環境變數

建立完成後，需要在 `.env` 檔案中設定：

```env
GUEST_RICH_MENU_ID=richmenu-xxxxxxxx
MEMBER_RICH_MENU_ID=richmenu-yyyyyyyy
```

## 注意事項

1. **一次性操作**：圖文選單建立後，ID 不會改變，除非重新建立
2. **圖片尺寸**：必須是 2500x1686 像素
3. **檔案格式**：支援 JPG 和 PNG
4. **選單數量限制**：LINE 每個 Bot 最多可以有 1000 個圖文選單
5. **備份 ID**：建議將獲得的 ID 記錄在安全的地方

## 疑難排解

### 常見錯誤

1. **403 Forbidden**
   - 檢查 LINE Channel Access Token 是否正確
   - 確認 Bot 有建立圖文選單的權限

2. **400 Bad Request**
   - 檢查圖片檔案是否存在
   - 確認圖片尺寸是否為 2500x1686

3. **檔案不存在**
   - 確認 `public/` 資料夾中有對應的圖片檔案
   - 檢查檔案名稱是否正確

### 重新建立選單

如果需要重新建立選單：

1. 使用 `npm run manage-menus` 刪除舊選單
2. 重新執行 `npm run setup-menus`
3. 更新 `.env` 檔案中的新 ID

## 更多資訊

- [LINE Messaging API 文件](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [圖文選單設計指南](https://developers.line.biz/en/docs/messaging-api/rich-menu-design-guide/)
