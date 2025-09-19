import { PostbackEvent, Client, FlexMessage } from '@line/bot-sdk'
import { verifyUserToken, refreshUserToken } from '../services/jwtService'
import { getUserState, updateUserTempData, updateUserState } from '../services/userService'
import { updateUserRichMenu, setLoadingState, restoreMenuFromLoading } from '../services/menuManager'
import { createLoginMenu } from './loginHandler'
import { connectUserWebSocket, disconnectUserWebSocket, isUserConnected, getUserMemberId, ensureUserWebSocketConnection } from '../services/websocketService'
import { getOrders } from '../services/apiService'
import { createOrderDetailCard, createOrderCarousel } from '../templates/messageTemplates'
import { removeUserLoginState, getUserLoginState, removeWebSocketConnection } from '../services/redisService'

export async function handleRichMenuPostback(event: PostbackEvent, client: Client): Promise<void> {
  const userId = event.source.userId!
  const data = new URLSearchParams(event.postback.data)
  const action = data.get('action')
  const token = data.get('token')
  
  console.log(`📱 Rich Menu action: ${action} by user: ${userId}`)
  console.log(`📱 Rich Menu postback data: ${event.postback.data}`)
  
  // 對於會員功能，檢查並確保 WebSocket 連線
  const memberActions = ['member_center', 'view_orders', 'create_order', 'order_history', 'pharmacist_consultation']
  if (memberActions.includes(action || '')) {
    console.log(`🔍 檢查用戶 ${userId} 的 WebSocket 連線狀態...`)
    await ensureUserWebSocketConnection(userId)
  }
  
  switch (action) {
    case 'login_required':
      await handleLoginRequired(event, client, data)
      break
      
    case 'pharmacist_consultation':
      await handlePharmacistConsultation(event, client)
      break
      
    case 'herbal_news':
      await handleHerbalNews(event, client)
      break
      
    case 'tutorial':
      await handleTutorial(event, client)
      break
      
    case 'member_center':
      await handleMemberCenter(event, client, userId, token)
      break
      
    case 'view_orders':
      await handleViewOrders(event, client, userId, token)
      break
      
    case 'create_order':
      await handleCreateOrder(event, client, userId, token)
      break
      
    case 'logout':
      await handleLogout(event, client, userId)
      break
      
    case 'change_password_local':
      await handleChangePasswordLocal(event, client, userId)
      break
      
    default:
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 無效的操作，請重新選擇。'
      })
  }
}

// 處理需要登入的功能
async function handleLoginRequired(event: PostbackEvent, client: Client, data: URLSearchParams): Promise<void> {
  const feature = data.get('feature')
  const customMessage = data.get('message')
  
  const featureNames: { [key: string]: string } = {
    'orders': '訂單管理',
    'member': '會員專區'
  }
  
  const featureName = featureNames[feature || ''] || '此功能'
  let message = customMessage || `🔒 ${featureName}需要先登入會員帳號`
  
  // 嘗試解碼 URL 編碼的訊息，如果失敗則使用原始訊息
  try {
    if (customMessage) {
      message = decodeURIComponent(customMessage)
    }
  } catch (error) {
    console.log('⚠️ URL 解碼失敗，使用原始訊息:', error)
    message = customMessage || `🔒 ${featureName}需要先登入會員帳號`
  }
  
  console.log(`🔐 處理登入要求: feature=${feature}, message=${message}`)
  
  await client.replyMessage(event.replyToken, [
    {
      type: 'text',
      text: message
    },
    {
      type: 'text', 
      text: '請選擇登入方式：'
    },
    createLoginMenu(event.source.userId!)
  ])
}

// 處理藥師諮詢（開放功能）
async function handlePharmacistConsultation(event: PostbackEvent, client: Client): Promise<void> {
  await client.replyMessage(event.replyToken, {
    type: 'text',
    text: '👨‍⚕️ 藥師諮詢服務\n\n我們的專業藥師為您提供：\n• 中藥材功效說明\n• 藥膳搭配建議\n• 服用注意事項\n• 中西藥交互作用\n\n請直接輸入您的問題，藥師將盡快為您解答！'
  })
}

// 處理中藥新知（開放功能）
async function handleHerbalNews(event: PostbackEvent, client: Client): Promise<void> {
  await client.replyMessage(event.replyToken, [
    {
      type: 'image',
      originalContentUrl: 'https://lh3.googleusercontent.com/d/1dXI82oQTbxtuOSOM-lx3zachceaTas0B',
      previewImageUrl: 'https://lh3.googleusercontent.com/d/1dXI82oQTbxtuOSOM-lx3zachceaTas0B'
    },
    {
      type: 'image',
      originalContentUrl: 'https://lh3.googleusercontent.com/d/1Aw7NWncbUzCuJ0DgFQ04VRUw8IRYmtXY',
      previewImageUrl: 'https://lh3.googleusercontent.com/d/1Aw7NWncbUzCuJ0DgFQ04VRUw8IRYmtXY'
    },
    {
      type: 'text',
      text: '📚 💊🇹🇼 台灣第一方：加味逍遙散🌿，除了中醫師愛用 👩‍⚕️🧑‍⚕️，藥局也有非處方藥喔✨\n\n咦？藥盒上寫著「征忡不寧」🤔，到底是什麼意思？\n\n讓藥師來告訴你吧👩‍🔬💕'
    }
  ])
}

// 處理了解更多（開放功能）
async function handleTutorial(event: PostbackEvent, client: Client): Promise<void> {
  await client.replyMessage(event.replyToken, {
    type: 'text',
    text: '📖 了解更多\n\n可點擊：https://portaly.cc/tscptw 了解更多'
  })
}

// 處理會員中心
async function handleMemberCenter(event: PostbackEvent, client: Client, userId: string, token?: string | null): Promise<void> {
  // 立即切換到 Loading 狀態的 Rich Menu (視覺回饋)
  await setLoadingState(client, userId)
  
  let userSession = null
  
  // 首先嘗試驗證 JWT token
  if (token) {
    userSession = verifyUserToken(token)
    if (userSession && userSession.lineId !== userId) {
      userSession = null // token 不屬於當前用戶
    }
  }
  
  // 檢查 Redis 中的登入狀態
  const loginState = await getUserLoginState(userId);
  
  if (!loginState) {
    // 沒有有效的登入狀態，切換回訪客模式
    console.log(`⚠️ 用戶 ${userId} 無有效登入狀態，切換回訪客模式`)
    await restoreMenuFromLoading(client, userId, false)
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🔒 您的登入狀態已過期，請重新登入會員帳號\n\n選單已切換為訪客模式，請使用「中藥預約」功能重新登入。'
    })
    return
  }
  
  // 如果沒有有效的 JWT token，但有 Redis 登入狀態，創建臨時 session
  if (!userSession) {
    userSession = {
      lineId: userId,
      memberId: loginState.memberId,
      memberName: loginState.memberName || '會員',
      accessToken: loginState.accessToken,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }
  }

  const memberMenu: FlexMessage = {
    type: 'flex',
    altText: '會員中心',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '👤 會員中心',
            weight: 'bold',
            size: 'xl',
            color: '#34495E'
          }
        ],
        backgroundColor: '#ECF0F1'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `會員：${userSession.memberName}`,
            weight: 'bold',
            size: 'lg',
            margin: 'md'
          },
          {
            type: 'text',
            text: `ID：${userSession.memberId}`,
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: '會員功能：',
            weight: 'bold',
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '📋 我的訂單',
              data: `action=view_orders${token ? `&token=${token}` : ''}`
            }
          },
          {
            type: 'button',
            action: process.env.NODE_ENV === 'production' ? {
              type: 'uri',
              label: '🔐 修改密碼',
              uri: `https://tscp-line-bot.vercel.app/login?userId=${userId}&action=password`
            } : {
              type: 'postback',
              label: '🔐 修改密碼',
              data: 'action=change_password_local'
            },
            style: 'link'
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: '🚪 登出',
              data: 'action=logout'
            }
          }
        ]
      }
    }
  }

  // 恢復正常選單並回覆會員中心資訊
  await restoreMenuFromLoading(client, userId)

  await client.replyMessage(event.replyToken, [
    {
      type: 'text',
      text: `👤 會員中心載入完成`
    },
    memberMenu
  ])
}

// 處理登出
async function handleLogout(event: PostbackEvent, client: Client, userId: string): Promise<void> {
  try {
    // 從 Redis 取得登入狀態以獲取 memberId
    const loginState = await getUserLoginState(userId);
    
    // 清除 Redis 中的登入狀態
    const loginStateRemoved = await removeUserLoginState(userId);
    if (loginStateRemoved) {
      console.log(`✅ 已從 Redis 清除登入狀態 - ${userId}`);
    } else {
      console.warn(`⚠️ 無法從 Redis 清除登入狀態 - ${userId}`);
    }
    
    // 清除 Redis 中的 WebSocket 連線狀態
    const wsRemoved = await removeWebSocketConnection(userId);
    if (wsRemoved) {
      console.log(`✅ 已從 Redis 清除 WebSocket 連線狀態 - ${userId}`);
    }
    
    // 清除暫存資料
    updateUserTempData(userId, undefined);
    
    // 清除記憶體中的用戶狀態
    updateUserState(userId, { 
      currentStep: undefined, 
      tempData: undefined,
      memberId: undefined,
      accessToken: undefined,
      memberName: undefined,
    });
    
    // 斷開 WebSocket 連線
    if (loginState) {
      await disconnectUserWebSocket(loginState.memberId);
    }
    
    // 切換回訪客選單
    await updateUserRichMenu(client, userId, false);
    
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '👋 您已成功登出\n\n選單已切換為訪客模式，感謝您的使用！\n\n如需使用會員功能，請重新登入。'
    });
  } catch (error) {
    console.error('❌ 登出處理失敗:', error);
    
    // 即使發生錯誤也要確保用戶狀態被清除
    await removeUserLoginState(userId);
    await removeWebSocketConnection(userId);
    updateUserTempData(userId, undefined);
    updateUserState(userId, { 
      currentStep: undefined, 
      tempData: undefined,
      memberId: undefined,
      accessToken: undefined,
      memberName: undefined,
    });
    
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '👋 您已登出，選單已切換為訪客模式。'
    });
  }
}

// 處理查看訂單
async function handleViewOrders(event: PostbackEvent, client: Client, userId: string, token?: string | null): Promise<void> {
  console.log(`📋 處理查看訂單請求: userId=${userId}`)

  // 1. 立即切換到 Loading 狀態的 Rich Menu (視覺回饋)
  await setLoadingState(client, userId)
  
  let userSession = null
  
  // 首先嘗試驗證 JWT token
  if (token) {
    userSession = verifyUserToken(token)
    if (userSession && userSession.lineId !== userId) {
      userSession = null // token 不屬於當前用戶
    }
  }
  
  // 如果沒有有效的 JWT token，檢查 Redis 狀態
  if (!userSession) {
    // 先檢查 Redis 中的登入狀態
    const redisLoginState = await getUserLoginState(userId)
    
    if (!redisLoginState) {
      // Redis 中沒有登入狀態，用戶已登出
      console.log(`⚠️ 用戶 ${userId} 狀態不一致：富選單是會員模式但用戶已登出，切換回訪客模式`)
      await restoreMenuFromLoading(client, userId, false)
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🔒 您的登入狀態已過期，請重新登入會員帳號\n\n選單已切換為訪客模式，請使用「中藥預約」功能重新登入。'
      })
      return
    }
    
    // Redis 中有登入狀態，同步到記憶體
    console.log(`🔄 從 Redis 恢復用戶 ${userId} 的登入狀態`)
    updateUserState(userId, {
      accessToken: redisLoginState.accessToken,
      memberId: redisLoginState.memberId
    })
    
    // 創建臨時的 session 物件
    userSession = {
      lineId: userId,
      memberId: redisLoginState.memberId,
      memberName: redisLoginState.memberName || '會員',
      accessToken: redisLoginState.accessToken,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }
  }

  try {
    // 使用用戶狀態中的 accessToken
    const accessToken = userSession.accessToken
    
    if (!accessToken) {
      // 恢復正常選單並回覆錯誤（自動判斷登入狀態）
      await restoreMenuFromLoading(client, userId)
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 無法取得用戶認證資訊，請重新登入。'
      })
      return
    }

    // 查詢訂單
    const orders = await getOrders(accessToken)
    
    console.log(`📋 API 回傳訂單數量: ${orders.length}`)
    if (orders.length > 0) {
      console.log(`📋 第一筆訂單: ${orders[0].order_code}, ID: ${orders[0].id}`)
      console.log(`📋 最後一筆訂單: ${orders[orders.length - 1].order_code}, ID: ${orders[orders.length - 1].id}`)
    }
    
    if (orders.length === 0) {
      // 恢復正常選單並回覆結果
      await restoreMenuFromLoading(client, userId)
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📋 ${userSession.memberName || '會員'}，您目前沒有任何訂單記錄。\n\n如需配藥服務，請先搜尋藥局並上傳藥單。`
      })
      return
    }

    // 顯示最近的10筆訂單 (確保不超過 LINE 的訊息限制)
    // 確保訂單按 ID 降序排列（最新的在前面）
    const sortedOrders = orders.sort((a, b) => b.id - a.id);
    const recentOrders = sortedOrders.slice(0, 10)
    console.log(`📋 輪播顯示訂單: ${recentOrders.map(o => `${o.order_code}(ID:${o.id})`).join(', ')}`)
    
    try {
      // 恢復正常選單
      await restoreMenuFromLoading(client, userId)

      const carouselMessage = createOrderCarousel(recentOrders)

      // 準備回覆訊息陣列
      const replyMessages: any[] = [
        {
          type: 'text',
          text: `✅ 查詢完成！找到 ${orders.length} 筆訂單記錄`
        },
        carouselMessage
      ]

      // 如果有更多訂單，加入提示訊息
      if (orders.length > 10) {
        replyMessages.push({
          type: 'text',
          text: `💡 上面顯示的是最近的 ${recentOrders.length} 筆訂單\n若需查看更多，請聯絡客服。`
        })
      }

      // 一次性發送所有訊息
      await client.replyMessage(event.replyToken, replyMessages)

    } catch (cardCreationError) {
      console.error('建立訂單卡片錯誤:', cardCreationError)
      // 恢復正常選單並發送錯誤訊息
      await restoreMenuFromLoading(client, userId)
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📋 ${userSession.memberName || '會員'}，找到 ${orders.length} 筆訂單，但顯示詳情時發生錯誤。\n\n請稍後再試或聯絡客服。`
      })
      return
    }

  } catch (error) {
    console.error('查詢訂單錯誤:', error)
    // 恢復正常選單並回覆錯誤
    await restoreMenuFromLoading(client, userId)
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `❌ 查詢訂單時發生錯誤，請稍後再試。`
    })
    return
  }
}

// 處理創建訂單/上傳藥單
async function handleCreateOrder(event: PostbackEvent, client: Client, userId: string, token?: string | null): Promise<void> {
  console.log(`📝 處理創建訂單請求: userId=${userId}`)
  
  // 立即發送確認訊息，讓用戶知道系統已收到請求
  await client.replyMessage(event.replyToken, {
    type: 'text',
    text: '📝 正在準備配藥服務，請稍候...'
  })
  
  let userSession = null
  
  // 首先嘗試驗證 JWT token
  if (token) {
    userSession = verifyUserToken(token)
    if (userSession && userSession.lineId !== userId) {
      userSession = null // token 不屬於當前用戶
    }
  }
  
  // 如果沒有有效的 JWT token，檢查 Redis 狀態
  if (!userSession) {
    // 先檢查 Redis 中的登入狀態
    const redisLoginState = await getUserLoginState(userId)
    
    if (!redisLoginState) {
      // Redis 中沒有登入狀態，用戶已登出
      console.log(`⚠️ 用戶 ${userId} 狀態不一致：富選單是會員模式但用戶已登出，切換回訪客模式`)
      await restoreMenuFromLoading(client, userId, false)
      
      const message = {
        type: 'text' as const,
        text: '🔒 您的登入狀態已過期，請重新登入會員帳號\n\n選單已切換為訪客模式，請使用「中藥預約」功能重新登入。'
      }
      
      // 這是 handleCreateOrder 中的錯誤，應該使用 replyMessage 因為有 replyToken
      await client.replyMessage(event.replyToken, message)
      return
    }
    
    // Redis 中有登入狀態，同步到記憶體
    console.log(`🔄 從 Redis 恢復用戶 ${userId} 的登入狀態`)
    updateUserState(userId, {
      accessToken: redisLoginState.accessToken,
      memberId: redisLoginState.memberId
    })
    
    // 創建臨時的 session 物件
    userSession = {
      lineId: userId,
      memberId: redisLoginState.memberId,
      memberName: redisLoginState.memberName || '會員',
      accessToken: redisLoginState.accessToken,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }
  }
  
  // 設定用戶狀態為等待上傳藥單
  updateUserTempData(userId, {
    waitingFor: 'prescription_upload',
    memberInfo: {
      memberId: userSession.memberId,
      memberName: userSession.memberName,
      accessToken: userSession.accessToken
    }
  })
  
  // 提示用戶上傳藥單
  const memberName = userSession.memberName || ''
  const message = {
    type: 'text' as const,
    text: `📱 ${memberName}，您好！\n\n🏥 中藥預約服務流程：\n1️⃣ 上傳藥單圖片\n2️⃣ 選擇配藥藥局\n3️⃣ 確認訂單資訊\n4️⃣ 等待配藥通知\n\n📷 請直接上傳您的藥單圖片開始預約！`
  }
  
  // 這是 handleCreateOrder 的最終回覆，應該使用 replyMessage
  await client.replyMessage(event.replyToken, message)
}

// 處理本地密碼修改 (開發環境)
async function handleChangePasswordLocal(event: PostbackEvent, client: Client, userId: string): Promise<void> {
  // 立即發送確認訊息，讓用戶知道系統已收到請求
  await client.replyMessage(event.replyToken, {
    type: 'text',
    text: '🔐 正在準備密碼修改功能，請稍候...'
  })
  
  const userState = getUserState(userId)
  
  // 檢查用戶是否已登入
  if (!userState.accessToken || !userState.memberId) {
    // 這是 handleChangePasswordLocal 的錯誤回覆，應該使用 replyMessage
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🔒 您的登入狀態已過期，請重新登入會員帳號\n\n請使用下方選單中的「中藥預約」功能重新登入。'
    })
    return
  }
  
  // 設定用戶狀態為等待輸入舊密碼
  updateUserState(userId, {
    currentStep: 'waiting_old_password',
    tempData: { 
      action: 'change_password',
      memberInfo: {
        memberId: userState.memberId,
        accessToken: userState.accessToken,
        memberName: userState.memberName
      }
    }
  })
  
  // 這是 handleChangePasswordLocal 的正常回覆，應該使用 replyMessage
  await client.replyMessage(event.replyToken, {
    type: 'text',
    text: '🔐 修改密碼\n\n請輸入您的舊密碼：'
  })
}
