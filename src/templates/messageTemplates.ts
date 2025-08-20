import { Message, FlexMessage } from '@line/bot-sdk';
import { Pharmacy, Order, OrderState } from '../types';

// 主選單
export function createMainMenu(): Message {
  return {
    type: 'flex',
    altText: '主選單',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🏥 中藥配藥服務',
            weight: 'bold',
            size: 'xl',
            color: '#ffffff',
            align: 'center'
          }
        ],
        backgroundColor: '#007bff',
        paddingAll: 'md'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '請選擇您要使用的功能：',
            size: 'md',
            color: '#666666',
            align: 'center',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '🔍 搜尋藥局',
              text: '搜尋藥局'
            },
            style: 'primary',
            margin: 'lg'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📋 我的訂單',
              text: '我的訂單'
            },
            style: 'secondary',
            margin: 'sm'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📷 上傳處方籤',
              text: '請直接傳送處方籤照片'
            },
            style: 'secondary',
            margin: 'sm'
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '🔓 會員登出',
              text: '登出'
            },
            style: 'link',
            margin: 'md'
          }
        ],
        spacing: 'sm',
        paddingAll: 'lg'
      }
    }
  };
}

// 登入提示
export function createLoginPrompt(): Message {
  return {
    type: 'template',
    altText: '請先登入',
    template: {
      type: 'buttons',
      title: '🔐 需要登入',
      text: '請先登入會員帳號才能使用服務',
      actions: [
        {
          type: 'message',
          label: '🔑 會員登入',
          text: '會員登入'
        }
      ]
    }
  };
}

// 藥局輪播卡片
export function createPharmacyCarousel(pharmacies: Pharmacy[]): Message {
  const columns = pharmacies.map(pharmacy => ({
    title: pharmacy.name,
    text: `${pharmacy.org_name}\n📍 ${pharmacy.address}`,
    actions: [
      {
        type: 'postback' as const,
        label: '選擇此藥局',
        data: `action=select_pharmacy&pharmacy_id=${pharmacy.id}`
      },
      {
        type: 'uri' as const,
        label: '查看地圖',
        uri: `https://www.google.com/maps/search/${encodeURIComponent(pharmacy.address)}`
      }
    ]
  }));

  return {
    type: 'template',
    altText: '藥局列表',
    template: {
      type: 'carousel',
      columns: columns.slice(0, 10) // LINE 限制最多10個
    }
  };
}

// 訂單狀態文字
export function getOrderStateText(state: number): string {
  switch (state) {
    case OrderState.RECEIVED: return '📥 已收單';
    case OrderState.SUPPLEMENT: return '📝 需補單';
    case OrderState.REJECTED: return '❌ 已拒單';
    case OrderState.SCHEDULED: return '⏰ 已排單';
    case OrderState.CANCELLED: return '🚫 已取消';
    case OrderState.COMPLETED: return '✅ 已完成';
    default: return '❓ 未知狀態';
  }
}

// 訂單詳情卡片
export function createOrderDetailCard(order: Order): FlexMessage {
  return {
    type: 'flex',
    altText: `訂單 ${order.order_code || '新訂單'}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 訂單詳情',
            weight: 'bold',
            size: 'lg',
            color: '#1DB446'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: '訂單編號',
                size: 'sm',
                color: '#666666',
                flex: 3
              },
              {
                type: 'text',
                text: order.order_code || '系統產生中',
                size: 'sm',
                flex: 5,
                wrap: true
              }
            ]
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'baseline',
            margin: 'md',
            contents: [
              {
                type: 'text',
                text: '狀態',
                size: 'sm',
                color: '#666666',
                flex: 3
              },
              {
                type: 'text',
                text: getOrderStateText(order.state || 0),
                size: 'sm',
                flex: 5
              }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            margin: 'md',
            contents: [
              {
                type: 'text',
                text: '藥局',
                size: 'sm',
                color: '#666666',
                flex: 3
              },
              {
                type: 'text',
                text: order.area_name || '選定藥局',
                size: 'sm',
                flex: 5,
                wrap: true
              }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            margin: 'md',
            contents: [
              {
                type: 'text',
                text: '取藥方式',
                size: 'sm',
                color: '#666666',
                flex: 3
              },
              {
                type: 'text',
                text: order.is_delivery ? '🚚 外送' : '🏪 自取',
                size: 'sm',
                flex: 5
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '查看完整詳情',
              data: `action=view_order_detail&order_id=${order.id || 0}`
            },
            style: 'primary'
          }
        ]
      }
    }
  };
}