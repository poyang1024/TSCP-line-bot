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

// 建立訪客圖文選單
async function createGuestRichMenu() {
  console.log('🎨 建立訪客圖文選單...');
  
  const richMenu = {
    size: {
      width: 2500,
      height: 1686
    },
    selected: true,
    name: '訪客選單',
    chatBarText: '功能選單',
    areas: [
      // 訂單管理 - 需要登入 (上方整排)
      {
        bounds: { x: 0, y: 0, width: 2500, height: 843 },
        action: {
          type: 'postback',
          data: `action=login_required&feature=orders&message=${encodeURIComponent('🔒 訂單功能需要先登入會員帳號')}`
        }
      },
      // 藥師諮詢 (下方左)
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=pharmacist_consultation'
        }
      },
      // 中藥新知 (下方中)
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: {
          type: 'postback',
          data: 'action=herbal_news'
        }
      },
      // 了解更多 (下方右)
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=tutorial'
        }
      }
    ]
  };

  try {
    // 建立圖文選單
    const richMenuId = await client.createRichMenu(richMenu);
    console.log('✅ 訪客圖文選單建立成功，ID:', richMenuId);

    // 上傳圖片
    const imagePath = path.join(__dirname, '../public/guest_richmenu.png');
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      await client.setRichMenuImage(richMenuId, imageBuffer, 'image/jpeg');
      console.log('✅ 訪客圖文選單圖片上傳成功');
    } else {
      console.warn('⚠️  訪客圖文選單圖片檔案不存在:', imagePath);
    }

    return richMenuId;
  } catch (error) {
    console.error('❌ 建立訪客圖文選單失敗:', error);
    throw error;
  }
}

// 建立會員圖文選單
async function createMemberRichMenu() {
  console.log('🎨 建立會員圖文選單...');
  
  const richMenu = {
    size: {
      width: 2500,
      height: 1686
    },
    selected: true,
    name: '會員選單',
    chatBarText: '會員功能',
    areas: [
      // 中藥預約/新增訂單 (上排左)
      {
        bounds: { x: 0, y: 0, width: 833, height: 562 },
        action: {
          type: 'postback',
          data: 'action=create_order'
        }
      },
      // 我的訂單 (上排右)
      {
        bounds: { x: 1667, y: 0, width: 833, height: 562 },
        action: {
          type: 'postback',
          data: 'action=view_orders'
        }
      },
      // 會員中心 (上排中間)
      {
        bounds: { x: 834, y: 0, width: 834, height: 562 },
        action: {
          type: 'postback',
          data: 'action=member_center'
        }
      },

      // 藥師諮詢 (下方左)
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=pharmacist_consultation'
        }
      },
      // 中藥新知 (下方中)
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: {
          type: 'postback',
          data: 'action=herbal_news'
        }
      },
      // 了解更多 (下方右)
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=tutorial'
        }
      }
    ]
  };

  try {
    // 建立圖文選單
    const richMenuId = await client.createRichMenu(richMenu);
    console.log('✅ 會員圖文選單建立成功，ID:', richMenuId);

    // 上傳圖片
    const imagePath = path.join(__dirname, '../public/member_richmenu.png');
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      await client.setRichMenuImage(richMenuId, imageBuffer, 'image/jpeg');
      console.log('✅ 會員圖文選單圖片上傳成功');
    } else {
      console.warn('⚠️  會員圖文選單圖片檔案不存在:', imagePath);
    }

    return richMenuId;
  } catch (error) {
    console.error('❌ 建立會員圖文選單失敗:', error);
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
      console.log(`   區域數量: ${menu.areas.length}`);
      console.log('');
    });
    return richMenus;
  } catch (error) {
    console.error('❌ 取得圖文選單列表失敗:', error);
    return [];
  }
}

// 刪除指定的圖文選單
async function deleteRichMenu(richMenuId) {
  try {
    await client.deleteRichMenu(richMenuId);
    console.log(`✅ 刪除圖文選單成功: ${richMenuId}`);
  } catch (error) {
    console.error(`❌ 刪除圖文選單失敗: ${richMenuId}`, error);
  }
}

// 主要執行函數
async function main() {
  console.log('🚀 開始設定圖文選單...\n');

  // 檢查環境變數
  if (!config.channelAccessToken || !config.channelSecret) {
    console.error('❌ 請確認 .env 檔案中的 LINE_CHANNEL_ACCESS_TOKEN 和 LINE_CHANNEL_SECRET');
    process.exit(1);
  }

  try {
    // 列出現有的圖文選單
    console.log('📋 檢查現有的圖文選單...');
    const existingMenus = await listExistingRichMenus();

    // 詢問是否要刪除現有的選單
    if (existingMenus.length > 0) {
      console.log('⚠️  發現現有的圖文選單。');
      console.log('如果你想要重新建立，請手動刪除舊的選單或修改此腳本。');
      console.log('或者直接使用現有的 ID 設定到 .env 檔案中。\n');
    }

    // 建立新的圖文選單
    console.log('🎨 建立新的圖文選單...\n');
    
    const guestMenuId = await createGuestRichMenu();
    const memberMenuId = await createMemberRichMenu();

    // 輸出結果
    console.log('\n🎉 圖文選單建立完成！');
    console.log('\n📝 請將以下內容加入你的 .env 檔案:');
    console.log('=' .repeat(50));
    console.log(`GUEST_RICH_MENU_ID=${guestMenuId}`);
    console.log(`MEMBER_RICH_MENU_ID=${memberMenuId}`);
    console.log('=' .repeat(50));
    
    console.log('\n✅ 完成！現在你可以重新啟動應用程式來使用新的圖文選單。');

  } catch (error) {
    console.error('❌ 設定圖文選單時發生錯誤:', error);
    process.exit(1);
  }
}

// 如果直接執行此檔案
if (require.main === module) {
  main();
}

module.exports = {
  createGuestRichMenu,
  createMemberRichMenu,
  listExistingRichMenus,
  deleteRichMenu
};
