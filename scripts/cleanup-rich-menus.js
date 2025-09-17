require('dotenv').config()
const { Client } = require('@line/bot-sdk')

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
})

async function cleanupOldRichMenus() {
  try {
    const richMenus = await client.getRichMenuList()
    
    // 找到最新的選單（假設是第一個）
    const latestGuest = richMenus.find(menu => menu.name === '訪客選單')
    const latestMember = richMenus.find(menu => menu.name === '會員選單')
    
    console.log('🧹 清理舊的 Rich Menu...')
    console.log(`保留訪客選單: ${latestGuest.richMenuId}`)
    console.log(`保留會員選單: ${latestMember.richMenuId}`)
    
    // 刪除其他重複的選單
    for (const menu of richMenus) {
      if (menu.richMenuId !== latestGuest.richMenuId && 
          menu.richMenuId !== latestMember.richMenuId) {
        try {
          await client.deleteRichMenu(menu.richMenuId)
          console.log(`✅ 已刪除舊選單: ${menu.name} (${menu.richMenuId})`)
        } catch (error) {
          console.log(`⚠️ 無法刪除選單 ${menu.richMenuId}: ${error.message}`)
        }
      }
    }
    
    console.log('✅ 清理完成')
    
  } catch (error) {
    console.error('❌ 清理失敗:', error)
  }
}

cleanupOldRichMenus()
