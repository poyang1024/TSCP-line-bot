const { createGuestRichMenu, createMemberRichMenu, listExistingRichMenus, deleteRichMenu } = require('./setup-rich-menus');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function interactiveSetup() {
  console.log('🎨 LINE Bot 圖文選單管理工具\n');
  
  while (true) {
    console.log('請選擇操作：');
    console.log('1. 列出現有圖文選單');
    console.log('2. 建立新的圖文選單');
    console.log('3. 刪除指定圖文選單');
    console.log('4. 建立完整的選單組合（訪客+會員）');
    console.log('5. 退出');
    
    const choice = await question('\n請輸入選項 (1-5): ');
    
    switch (choice) {
      case '1':
        await listExistingRichMenus();
        break;
        
      case '2':
        console.log('\n選擇要建立的選單類型：');
        console.log('1. 訪客選單');
        console.log('2. 會員選單');
        
        const menuType = await question('請輸入選項 (1-2): ');
        
        try {
          if (menuType === '1') {
            const id = await createGuestRichMenu();
            console.log(`\n✅ 訪客選單建立成功！ID: ${id}`);
          } else if (menuType === '2') {
            const id = await createMemberRichMenu();
            console.log(`\n✅ 會員選單建立成功！ID: ${id}`);
          } else {
            console.log('❌ 無效的選項');
          }
        } catch (error) {
          console.error('❌ 建立失敗:', error.message);
        }
        break;
        
      case '3':
        const menus = await listExistingRichMenus();
        if (menus.length === 0) {
          console.log('沒有可刪除的圖文選單');
          break;
        }
        
        const deleteId = await question('\n請輸入要刪除的圖文選單 ID: ');
        if (deleteId) {
          const confirm = await question(`確定要刪除 ${deleteId} 嗎？ (y/N): `);
          if (confirm.toLowerCase() === 'y') {
            await deleteRichMenu(deleteId);
          } else {
            console.log('已取消刪除');
          }
        }
        break;
        
      case '4':
        console.log('\n🎨 建立完整的選單組合...');
        try {
          const guestId = await createGuestRichMenu();
          const memberId = await createMemberRichMenu();
          
          console.log('\n🎉 完整選單組合建立成功！');
          console.log('\n📝 請將以下內容加入 .env 檔案:');
          console.log('=' .repeat(50));
          console.log(`GUEST_RICH_MENU_ID=${guestId}`);
          console.log(`MEMBER_RICH_MENU_ID=${memberId}`);
          console.log('=' .repeat(50));
          
          const saveToFile = await question('\n是否要自動寫入 .env 檔案？ (y/N): ');
          if (saveToFile.toLowerCase() === 'y') {
            const fs = require('fs');
            const path = require('path');
            
            const envPath = path.join(__dirname, '../.env');
            let envContent = '';
            
            // 讀取現有的 .env 檔案
            if (fs.existsSync(envPath)) {
              envContent = fs.readFileSync(envPath, 'utf8');
            }
            
            // 更新或添加圖文選單 ID
            const updateEnvVar = (content, key, value) => {
              const regex = new RegExp(`^${key}=.*$`, 'm');
              if (regex.test(content)) {
                return content.replace(regex, `${key}=${value}`);
              } else {
                return content + `\n${key}=${value}`;
              }
            };
            
            envContent = updateEnvVar(envContent, 'GUEST_RICH_MENU_ID', guestId);
            envContent = updateEnvVar(envContent, 'MEMBER_RICH_MENU_ID', memberId);
            
            fs.writeFileSync(envPath, envContent);
            console.log('✅ .env 檔案已更新');
          }
        } catch (error) {
          console.error('❌ 建立失敗:', error.message);
        }
        break;
        
      case '5':
        console.log('👋 再見！');
        rl.close();
        return;
        
      default:
        console.log('❌ 無效的選項');
    }
    
    console.log('\n' + '-'.repeat(50) + '\n');
  }
}

if (require.main === module) {
  interactiveSetup().catch(console.error);
}
