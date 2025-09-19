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
              label: '📷 上傳藥單',
              text: '請直接傳送藥單照片'
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

// 藥局輪播卡片 (支援分頁)
export function createPharmacyCarousel(pharmacies: Pharmacy[], page: number = 1): Message {
  const pageSize = 6;  // 減少每頁顯示數量，避免訊息過大
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPagePharmacies = pharmacies.slice(startIndex, endIndex);
  const totalPages = Math.ceil(pharmacies.length / pageSize);

  const columns = currentPagePharmacies.map(pharmacy => {
    // 清理和限制文字長度，避免編碼問題和內容過長
    const cleanTitle = (pharmacy.name || '').replace(/[^\u0000-\u007F\u4e00-\u9fff]/g, '').substring(0, 40);
    const cleanOrgName = (pharmacy.org_name || '').replace(/[^\u0000-\u007F\u4e00-\u9fff]/g, '').substring(0, 30);
    const cleanAddress = (pharmacy.address || '').replace(/[^\u0000-\u007F\u4e00-\u9fff]/g, '').substring(0, 50);
    const cleanPhone = (pharmacy.phone || '').replace(/[^\u0000-\u007F\u4e00-\u9fff\-\(\)\s]/g, '').substring(0, 20);

    let text = `${cleanOrgName}\n📍 ${cleanAddress}`;
    if (cleanPhone) {
      text += `\n📞 ${cleanPhone}`;
    }

    return {
      title: cleanTitle,
      text: text,
      actions: [
        {
          type: 'postback' as const,
          label: '選擇此藥局',
          data: `action=select_pharmacy&pharmacy_id=${pharmacy.id}`
        },
        {
          type: 'uri' as const,
          label: '🗺️ 查看地圖',
          uri: `https://www.google.com/maps/search/${encodeURIComponent(cleanAddress)}`
        },
        ...(cleanPhone ? [{
          type: 'uri' as const,
          label: '📞 聯絡藥局',
          uri: `tel:${cleanPhone}`
        }] : [])
      ]
    };
  });

  return {
    type: 'template',
    altText: `藥局列表 (第 ${page}/${totalPages} 頁)`,
    template: {
      type: 'carousel',
      columns: columns
    }
  };
}

// 藥局分頁導航按鈕
export function createPharmacyPaginationButtons(pharmacies: Pharmacy[], currentPage: number): Message {
  const pageSize = 6;  // 與 createPharmacyCarousel 保持一致
  const totalPages = Math.ceil(pharmacies.length / pageSize);
  
  if (totalPages <= 1) {
    // 如果只有一頁，不需要分頁按鈕
    return {
      type: 'text',
      text: `📍 共找到 ${pharmacies.length} 家藥局`
    };
  }
  
  const actions: any[] = [];
  
  // 上一頁按鈕
  if (currentPage > 1) {
    actions.push({
      type: 'postback',
      label: '⬅️ 上一頁',
      data: `action=pharmacy_page&page=${currentPage - 1}`
    });
  }
  
  // 頁面資訊
  actions.push({
    type: 'message',
    label: `📄 第 ${currentPage}/${totalPages} 頁`,
    text: `目前第 ${currentPage} 頁，共 ${totalPages} 頁`
  });
  
  // 下一頁按鈕
  if (currentPage < totalPages) {
    actions.push({
      type: 'postback',
      label: '下一頁 ➡️',
      data: `action=pharmacy_page&page=${currentPage + 1}`
    });
  }
  
  return {
    type: 'template',
    altText: '分頁導航',
    template: {
      type: 'buttons',
      title: '🏥 藥局分頁',
      text: `第 ${currentPage}/${totalPages} 頁 (共 ${pharmacies.length} 家藥局)`,
      actions: actions.slice(0, 4) // LINE 限制最多4個按鈕
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

// 訂單詳情卡片 (單一訂單)
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
                text: getOrderStateText(order.state),
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

// 訂單輪播卡片 (多個訂單)
export function createOrderCarousel(orders: Order[]): Message {
  const columns = orders.map(order => ({
    title: `📋 ${order.order_code || '新訂單'}`,
    text: `${getOrderStateText(order.state)}\n🏥 ${order.area_name || '選定藥局'}\n${order.is_delivery ? '🚚 外送' : '🏪 自取'}`,
    actions: [
      {
        type: 'postback' as const,
        label: '查看詳情',
        data: `action=view_order_detail&order_id=${order.id || 0}`
      },
      order.area_phone ? {
        type: 'uri' as const,
        label: '📞 聯絡藥局',
        uri: `tel:${order.area_phone}`
      } : {
        type: 'postback' as const,
        label: '聯絡藥局',
        data: `action=contact_pharmacy&order_id=${order.id || 0}`
      }
    ]
  }));

  return {
    type: 'template',
    altText: '訂單列表',
    template: {
      type: 'carousel',
      columns: columns.slice(0, 10) // LINE 限制最多10個
    }
  };
}