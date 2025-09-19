const { Client } = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// 建立 Loading 狀態圖文選單
async function createLoadingRichMenu() {
  console.log('🎨 建立 Loading 狀態圖文選單...');

  const richMenu = {
    size: {
      width: 2500,
      height: 1686
    },
    selected: true,
    name: 'Loading 選單',
    chatBarText: '處理中...',
    areas: [
      // 整個區域都不可點擊，顯示處理中狀態
      {
        bounds: { x: 0, y: 0, width: 2500, height: 1686 },
        action: {
          type: 'postback',
          data: `action=processing&message=${encodeURIComponent('⏳ 系統正在處理中，請稍候...')}`
        }
      }
    ]
  };

  try {
    // 建立圖文選單
    const richMenuId = await client.createRichMenu(richMenu);
    console.log('✅ Loading 圖文選單建立成功，ID:', richMenuId);

    // 上傳圖片
    const imagePath = path.join(__dirname, '../public/loading_richmenu.png');
    console.log('🔍 尋找圖片檔案:', imagePath);

    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      await client.setRichMenuImage(richMenuId, imageBuffer, 'image/png');
      console.log('✅ Loading 圖文選單圖片上傳成功');
    } else {
      console.warn('⚠️  Loading 圖文選單圖片檔案不存在:', imagePath);
      console.warn('⚠️  請確保檔案 public/loading_richmenu.png 存在');

      // 列出 public 目錄內容以幫助除錯
      const publicDir = path.join(__dirname, '../public');
      if (fs.existsSync(publicDir)) {
        const files = fs.readdirSync(publicDir);
        console.log('📁 public 目錄現有檔案:', files);
      } else {
        console.warn('⚠️  public 目錄不存在');
      }
    }

    return richMenuId;
  } catch (error) {
    console.error('❌ 建立 Loading 圖文選單失敗:', error);
    throw error;
  }
}

// 列出現有的圖文選單
async function listExistingRichMenus() {
  try {
    const richMenus = await client.getRichMenuList();
    console.log('\n📋 現有的圖文選單:');
    richMenus.forEach((menu, index) => {
      console.log(`${index + 1}. ID: ${menu.richMenuId}`);
      console.log(`   名稱: ${menu.name}`);
      console.log(`   聊天欄文字: ${menu.chatBarText}`);
      console.log(`   大小: ${menu.size.width}x${menu.size.height}`);
      console.log('');
    });
    return richMenus;
  } catch (error) {
    console.error('❌ 取得圖文選單列表失敗:', error);
    return [];
  }
}

// 主要執行函數
async function main() {
  console.log('🚀 開始建立 Loading Rich Menu...\n');

  // 檢查環境變數
  if (!config.channelAccessToken || !config.channelSecret) {
    console.error('❌ 請確認 .env 檔案中的 LINE_CHANNEL_ACCESS_TOKEN 和 LINE_CHANNEL_SECRET');
    process.exit(1);
  }

  try {
    // 列出現有的圖文選單
    console.log('📋 檢查現有的圖文選單...');
    await listExistingRichMenus();

    // 建立 Loading Rich Menu
    const loadingMenuId = await createLoadingRichMenu();

    // 輸出結果
    console.log('\n🎉 Loading Rich Menu 建立完成！');
    console.log('\n📝 請將以下內容加入你的 .env 檔案:');
    console.log('=' .repeat(50));
    console.log(`LOADING_RICH_MENU_ID=${loadingMenuId}`);
    console.log('=' .repeat(50));

    console.log('\n✅ 完成！現在你可以在應用程式中使用 Loading Rich Menu。');

  } catch (error) {
    console.error('❌ 建立 Loading Rich Menu 時發生錯誤:', error);
    process.exit(1);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  main();
}

module.exports = {
  createLoadingRichMenu
};