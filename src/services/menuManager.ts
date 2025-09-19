import { Client, RichMenu } from '@line/bot-sdk'

// 選單 ID 常數 (需在 .env 中設定)
export const RICH_MENU_IDS = {
  GUEST: process.env.GUEST_RICH_MENU_ID!,
  MEMBER: process.env.MEMBER_RICH_MENU_ID!,
  LOADING: process.env.LOADING_RICH_MENU_ID!, // 新增 loading 狀態選單
}

// 除錯：輸出目前的 Rich Menu ID
console.log('🎨 Rich Menu ID 設定:');
console.log(`GUEST: ${RICH_MENU_IDS.GUEST}`);
console.log(`MEMBER: ${RICH_MENU_IDS.MEMBER}`);
console.log(`LOADING: ${RICH_MENU_IDS.LOADING}`);

// 建立未登入用戶選單
export async function createGuestRichMenu(client: Client): Promise<string> {
  const richMenu: RichMenu = {
    size: {
      width: 2500,
      height: 1686
    },
    selected: true,
    name: '未登入選單',
    chatBarText: '功能選單',
    areas: [
      // 中藥預約 - 需要登入 (上方整排紅框區域)
      {
        bounds: { x: 0, y: 0, width: 2500, height: 843 },
        action: {
          type: 'postback',
          data: 'action=login_required&feature=appointment&message=🔒 中藥預約功能需要先登入會員帳號'
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
  }

  const result = await client.createRichMenu(richMenu)
  console.log('Created guest rich menu:', result)
  return result
}

// 建立已登入用戶選單
export async function createMemberRichMenu(client: Client): Promise<string> {
  const richMenu: RichMenu = {
    size: {
      width: 2500,
      height: 1686
    },
    selected: true,
    name: '會員選單',
    chatBarText: '會員功能',
    areas: [
      // 中藥預約 - 可使用 (上方整排)
      {
        bounds: { x: 0, y: 0, width: 2500, height: 843 },
        action: {
          type: 'postback',
          data: 'action=create_order'
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
      // 會員中心/登出 (下方右)
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: {
          type: 'postback',
          data: 'action=member_center'
        }
      }
    ]
  }

  const result = await client.createRichMenu(richMenu)
  console.log('Created member rich menu:', result)
  return result
}

// 建立 Loading 狀態選單
export async function createLoadingRichMenu(client: Client): Promise<string> {
  const richMenu: RichMenu = {
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
          data: 'action=processing&message=⏳ 系統正在處理中，請稍候...'
        }
      }
    ]
  }

  const result = await client.createRichMenu(richMenu)
  console.log('Created loading rich menu:', result)
  return result
}

// 暫時切換到 Loading 狀態
export async function setLoadingState(client: Client, userId: string): Promise<void> {
  try {
    if (RICH_MENU_IDS.LOADING) {
      await client.unlinkRichMenuFromUser(userId)
      await client.linkRichMenuToUser(userId, RICH_MENU_IDS.LOADING)
      console.log(`⏳ 已切換到 Loading 狀態: ${userId}`)

      // 增加短暫延遲，確保 Loading 狀態有時間顯示給用戶
      await new Promise(resolve => setTimeout(resolve, 150))
    }
  } catch (error) {
    console.error('❌ 切換到 Loading 狀態失敗:', error)
  }
}

// 從 Loading 狀態恢復到正常選單
export async function restoreMenuFromLoading(client: Client, userId: string, isLoggedIn?: boolean): Promise<void> {
  // 如果沒有提供 isLoggedIn 參數，則自動檢查用戶的登入狀態
  const { isUserLoggedIn, ensureUserState } = await import('../services/userService')

  let actualLoginStatus: boolean
  if (isLoggedIn !== undefined) {
    actualLoginStatus = isLoggedIn
  } else {
    // 確保用戶狀態是最新的（包含 Redis 恢復）
    await ensureUserState(userId)
    actualLoginStatus = isUserLoggedIn(userId)
  }

  await updateUserRichMenu(client, userId, actualLoginStatus)
}

// 動態切換選單
export async function updateUserRichMenu(client: Client, userId: string, isLoggedIn: boolean): Promise<void> {
  try {
    console.log(`🎨 Updating rich menu for user ${userId}, isLoggedIn: ${isLoggedIn}`)
    console.log(`🎨 Available menu IDs - GUEST: ${RICH_MENU_IDS.GUEST}, MEMBER: ${RICH_MENU_IDS.MEMBER}`)
    
    // 先解除目前的選單綁定
    try {
      await client.unlinkRichMenuFromUser(userId)
    } catch (error) {
      // 如果沒有綁定選單，忽略錯誤
      console.log('No existing rich menu to unlink')
    }

    if (isLoggedIn && RICH_MENU_IDS.MEMBER) {
      // 已登入：顯示會員選單
      await client.linkRichMenuToUser(userId, RICH_MENU_IDS.MEMBER)
      console.log(`✅ Switched to member menu for user: ${userId}`)
    } else if (RICH_MENU_IDS.GUEST) {
      // 未登入：顯示訪客選單
      await client.linkRichMenuToUser(userId, RICH_MENU_IDS.GUEST)
      console.log(`✅ Switched to guest menu for user: ${userId}`)
      
      // 如果應該是會員但卻切換到訪客選單，記錄警告
      if (isLoggedIn) {
        console.warn(`⚠️ 用戶已登入但切換到訪客選單 - MEMBER_RICH_MENU_ID 可能未設定: ${RICH_MENU_IDS.MEMBER}`)
      }
    } else {
      console.warn('Rich menu IDs not configured properly')
      console.warn(`GUEST_RICH_MENU_ID: ${RICH_MENU_IDS.GUEST}`)
      console.warn(`MEMBER_RICH_MENU_ID: ${RICH_MENU_IDS.MEMBER}`)
    }
  } catch (error) {
    console.error('❌ Failed to update rich menu:', error)
  }
}

// 初始化選單 (首次設定)
export async function initializeRichMenus(client: Client): Promise<void> {
  try {
    // 如果環境變數沒有設定選單 ID，則建立新的
    if (!RICH_MENU_IDS.GUEST) {
      const guestMenuId = await createGuestRichMenu(client)
      console.log('⚠️  Please set GUEST_RICH_MENU_ID in .env:', guestMenuId)
    }

    if (!RICH_MENU_IDS.MEMBER) {
      const memberMenuId = await createMemberRichMenu(client)
      console.log('⚠️  Please set MEMBER_RICH_MENU_ID in .env:', memberMenuId)
    }

    if (!RICH_MENU_IDS.LOADING) {
      const loadingMenuId = await createLoadingRichMenu(client)
      console.log('⚠️  Please set LOADING_RICH_MENU_ID in .env:', loadingMenuId)
    }

    console.log('✅ Rich menus initialized')
  } catch (error) {
    console.error('❌ Failed to initialize rich menus:', error)
  }
}
