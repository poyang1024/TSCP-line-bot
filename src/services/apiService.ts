import axios from 'axios';
import { Member, Pharmacy, Order } from '../types';

const API_BASE_URL = process.env.API_BASE_URL || '';

// 建立 axios 實例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 增加到30秒
});

// LINE 直接登入
export async function loginWithLine(lineUserId: string): Promise<Member | null> {
  try {
    console.log('🔗 開始 LINE 直接登入...');
    console.log('📋 LINE User ID:', lineUserId);
    
    // 根據環境選擇 URL
    const lineLoginUrl = process.env.LINE_LOGIN_API_URL;
    console.log('🌐 使用 API URL:', lineLoginUrl);
    console.log('🏷️ 當前環境:', process.env.NODE_ENV);

    if (!lineLoginUrl) {
      console.error('❌ LINE 登入 URL 未設定');
      console.error('❌ 請檢查 .env 文件中的 LINE_LOGIN_API_URL 設定');
      return null;
    }

    const requestUrl = `${lineLoginUrl}?line_user_id=${lineUserId}`;
    console.log('📤 發送請求到:', requestUrl);

    const response = await axios.get(lineLoginUrl, {
      params: {
        line_user_id: lineUserId
      },
      timeout: 30000 // 增加到30秒
    });
    
    console.log('📥 API 回應狀態:', response.status);
    console.log('📥 API 回應 headers:', response.headers);
    console.log('📥 API 回應完整資料:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ LINE 登入成功');
      console.log('👤 會員資料:', JSON.stringify(response.data.data, null, 2));
      
      // 確保回應資料包含所需的 info 欄位
      const memberData = response.data.data;
      if (!memberData.info) {
        memberData.info = {
          phone: null,
          address: null
        };
      }
      
      return memberData;
    } else {
      console.error('❌ API 回傳 success: false');
      console.error('❌ 錯誤訊息:', response.data.message || '無錯誤訊息');
      console.error('❌ 完整回應:', JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('❌ LINE 直接登入發生錯誤:');
    
    if (axios.isAxiosError(error)) {
      console.error('📊 錯誤類型: Axios 錯誤');
      console.error('📊 HTTP 狀態:', error.response?.status);
      console.error('📊 狀態文字:', error.response?.statusText);
      console.error('📊 錯誤回應 headers:', error.response?.headers);
      console.error('📊 錯誤回應資料:', error.response?.data);
      console.error('📊 請求配置:', {
        url: error.config?.url,
        method: error.config?.method,
        params: error.config?.params,
        timeout: error.config?.timeout
      });
      
      if (error.code) {
        console.error('📊 錯誤代碼:', error.code);
      }
      
      if (error.message) {
        console.error('📊 錯誤訊息:', error.message);
      }
    } else {
      console.error('📊 錯誤類型: 一般錯誤');
      console.error('📊 錯誤物件:', error);
    }
    
    return null;
  }
}

// 會員登入
export async function loginMember(account: string, password: string, lineUserId: string): Promise<Member | null> {
  try {
    console.log('🔗 開始會員登入...');
    console.log('📋 帳號:', account);
    console.log('📋 LINE ID:', lineUserId);

    const requestData = {
      account,
      password,
      line_oa: lineUserId
    };

    const response = await api.post('/login/tscp', requestData);
    
    console.log('📥 API 回應狀態:', response.status);
    console.log('📥 API 回應資料:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ 會員登入成功');
      console.log('👤 會員資料:', JSON.stringify(response.data.data, null, 2));
      
      // 確保回應資料包含所需的 info 欄位
      const memberData = response.data.data;
      if (!memberData.info) {
        memberData.info = {
          phone: null,
          address: null
        };
      }
      
      return memberData;
    } else {
      console.error('❌ API 回傳 success: false');
      console.error('❌ 錯誤訊息:', response.data.message || '無錯誤訊息');
      return null;
    }
  } catch (error) {
    console.error('❌ 會員登入發生錯誤:');
    
    if (axios.isAxiosError(error)) {
      console.error('📊 錯誤類型: Axios 錯誤');
      console.error('📊 HTTP 狀態:', error.response?.status);
      console.error('📊 狀態文字:', error.response?.statusText);
      console.error('📊 錯誤回應資料:', error.response?.data);
      console.error('📊 請求配置:', {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data,
        timeout: error.config?.timeout
      });
      
      if (error.code) {
        console.error('📊 錯誤代碼:', error.code);
      }
      
      if (error.message) {
        console.error('📊 錯誤訊息:', error.message);
      }
    } else {
      console.error('📊 錯誤類型: 一般錯誤');
      console.error('📊 錯誤物件:', error);
    }
    
    return null;
  }
}

// 搜尋藥局
export async function searchPharmacies(token: string, keyword?: string): Promise<Pharmacy[]> {
  try {
    const params: any = { 'types[]': 2 };
    if (keyword) {
      params.keyword = keyword;
    }
    
    const response = await api.get('/area', { 
      params,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error('搜尋藥局失敗:', error);
    return [];
  }
}

// 查詢訂單
export async function getOrders(token: string, state?: number): Promise<Order[]> {
  try {
    const params: any = {
      order: 'created_at',
      order_by: 'DESC'
    };
    
    if (state !== undefined) {
      params.state = state;
    }
    
    const response = await api.get('/delivery/medicine', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: params
    });
    
    if (response.data.success) {
      return response.data.data.list || response.data.data || response.data;
    }
    return [];
  } catch (error) {
    console.error('查詢訂單失敗:', error);
    return [];
  }
}

// 取得訂單詳情
export async function getOrderDetail(token: string, orderId: number): Promise<Order | null> {
  try {
    const response = await api.get(`/delivery/medicine/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error('取得訂單詳情失敗:', error);
    return null;
  }
}

// 新增訂單
export async function createOrder(token: string, orderData: any, lineUserId: string): Promise<Order | null> {
  try {
    console.log('📤 送出建立訂單請求...');
    console.log('📋 LINE ID:', lineUserId);

    // 加入 LINE ID 到 formData 中
    orderData.append('line_oa', lineUserId);

    const response = await api.post('/delivery/medicine', orderData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    
    console.log('📥 API 回應狀態:', response.status);
    console.log('📥 API 回應資料:', response.data);
    
    if (response.data.success) {
      console.log('✅ 訂單建立成功');
      // 如果 API 沒有回傳詳細資料，回傳一個基本的訂單物件
      return response.data.data || {
        order_code: '系統產生中',
        area_name: '已選定藥局',
        state: 0,
        is_delivery: false
      };
    } else {
      console.error('❌ API 回傳失敗:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ 新增訂單失敗:', error);
    if (axios.isAxiosError(error)) {
      console.error('❌ HTTP 狀態:', error.response?.status);
      console.error('❌ 錯誤回應:', error.response?.data);
      console.error('❌ 請求配置:', error.config);
    }
    return null;
  }
}

// 會員註冊
export async function registerMember(phone: string, identity: string, name: string, address?: string): Promise<{ success: boolean; message?: string }> {
  try {
    // 建立請求資料，只包含有值的欄位
    const requestData: any = {
      phone,
      name
    };
    
    // 只有當選填欄位有值時才加入請求資料
    if (identity && identity.trim() !== '') {
      requestData.identity = identity;
    }
    
    if (address && address.trim() !== '') {
      requestData.address = address;
    }
    
    const response = await api.post('/register/phone', requestData);
    
    if (response.data.success) {
      return { success: true };
    }
    return { 
      success: false, 
      message: response.data.message || '註冊失敗' 
    };
  } catch (error) {
    console.error('註冊失敗:', error);
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || '註冊失敗，請稍後再試';
      return { success: false, message: errorMessage };
    }
    return { success: false, message: '註冊失敗，請稍後再試' };
  }
}

// 變更密碼
export async function changePassword(token: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await api.patch('/personal/password', {
      old_password: oldPassword,
      new_password: newPassword
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success) {
      return { success: true };
    }
    return { 
      success: false, 
      message: response.data.message || '密碼變更失敗' 
    };
  } catch (error) {
    console.error('變更密碼失敗:', error);
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || '密碼變更失敗，請稍後再試';
      return { success: false, message: errorMessage };
    }
    return { success: false, message: '密碼變更失敗，請稍後再試' };
  }
}

// 刪除帳號
export async function deleteAccount(token: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await api.delete('/personal/password', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data.success) {
      return { success: true };
    }
    return { 
      success: false, 
      message: response.data.message || '帳號刪除失敗' 
    };
  } catch (error) {
    console.error('刪除帳號失敗:', error);
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || '帳號刪除失敗，請稍後再試';
      return { success: false, message: errorMessage };
    }
    return { success: false, message: '帳號刪除失敗，請稍後再試' };
  }
}

// ==================== 通知相關 API ====================

export interface Notification {
  id: number;
  subject: string;
  content: string;
  created_at: number;
  is_read: boolean;
  sender: {
    type: number;
    id: number;
    name: string;
  } | null;
  record: {
    type: number;
    id: number;
    order_code: string | null;
  } | null;
}

/**
 * 查詢通知
 */
export async function getNotifications(
  accessToken: string,
  startDate: number,
  endDate: number,
  isRead?: boolean
): Promise<Notification[]> {
  try {
    console.log('📬 查詢通知列表...');
    console.log('📅 時間範圍:', new Date(startDate * 1000).toISOString(), '到', new Date(endDate * 1000).toISOString());
    
    const params: any = {
      start_date: startDate,
      end_date: endDate
    };
    
    if (isRead !== undefined) {
      params.is_read = isRead ? '1' : '0';
    }
    
    const response = await api.get('/notification', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params
    });
    
    if (response.data.success) {
      console.log('✅ 通知查詢成功，共', response.data.data?.length || 0, '筆');
      return response.data.data || [];
    } else {
      console.error('❌ 通知查詢失敗:', response.data.message || response.data.error || '未知錯誤');
      console.error('📄 完整回應:', JSON.stringify(response.data, null, 2));
      return [];
    }
  } catch (error) {
    console.error('❌ 查詢通知時發生錯誤:', error);
    
    // 如果是 Axios 錯誤，提供更詳細的資訊
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      console.error('📄 錯誤回應狀態:', axiosError.response?.status);
      console.error('📄 錯誤回應資料:', JSON.stringify(axiosError.response?.data, null, 2));
    }
    
    return [];
  }
}

/**
 * 標記通知為已讀
 */
export async function markNotificationAsRead(
  accessToken: string,
  notificationId: number
): Promise<boolean> {
  try {
    console.log('✅ 標記通知為已讀:', notificationId);
    
    const response = await api.patch(`/notification/${notificationId}`, {
      is_read: '1'
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (response.data.success) {
      console.log('✅ 通知已標記為已讀');
      return true;
    } else {
      console.error('❌ 標記通知已讀失敗:', response.data.message || response.data.error || '未知錯誤');
      console.error('📄 完整回應:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ 標記通知已讀時發生錯誤:', error);
    
    // 如果是 Axios 錯誤，提供更詳細的資訊
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      console.error('📄 錯誤回應狀態:', axiosError.response?.status);
      console.error('📄 錯誤回應資料:', JSON.stringify(axiosError.response?.data, null, 2));
    }
    
    return false;
  }
}