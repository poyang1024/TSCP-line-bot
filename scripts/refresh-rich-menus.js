require('dotenv').config()
const { Client } = require('@line/bot-sdk')

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
})

async function refreshAllUserRichMenus() {
  try {
    console.log('🔄 開始重新整理所有用戶的 Rich Menu...')
    
    // 取得所有 Rich Menu
    const richMenus = await client.getRichMenuList()
    console.log('📋 現有的 Rich Menu:')
    richMenus.forEach((menu, index) => {
      console.log(`${index + 1}. ${menu.name} (${menu.richMenuId})`)
    })
    
    // 找到最新的訪客和會員選單
    const guestMenu = richMenus.find(menu => menu.name === '訪客選單')
    const memberMenu = richMenus.find(menu => menu.name === '會員選單')
    
    if (!guestMenu) {
      console.error('❌ 找不到訪客選單')
      return
    }
    
    console.log(`✅ 將使用訪客選單: ${guestMenu.richMenuId}`)
    if (memberMenu) {
      console.log(`✅ 將使用會員選單: ${memberMenu.richMenuId}`)
    }
    
    // 設定預設選單為訪客選單
    try {
      await client.setDefaultRichMenu(guestMenu.richMenuId)
      console.log('✅ 已設定預設 Rich Menu 為訪客選單')
    } catch (error) {
      console.log('⚠️ 設定預設選單失敗（可能已經是預設）:', error.message)
    }
    
    console.log('✅ Rich Menu 重新整理完成')
    
  } catch (error) {
    console.error('❌ 重新整理失敗:', error)
  }
}

refreshAllUserRichMenus()
