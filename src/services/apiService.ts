import axios from 'axios';
import { Member, Pharmacy, Order } from '../types';

const API_BASE_URL = process.env.API_BASE_URL || '';

// 建立 axios 實例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// LINE 直接登入
export async function loginWithLine(lineUserId: string): Promise<Member | null> {
  try {
    // 根據環境選擇 URL
    const lineLoginUrl = process.env.LINE_LOGIN_API_URL;

    if (!lineLoginUrl) {
      console.error('LINE 登入 URL 未設定');
      return null;
    }

    const response = await axios.get(lineLoginUrl, {
      params: {
        line_user_id: lineUserId
      },
      timeout: 10000
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error('LINE 直接登入失敗:', error);
    return null;
  }
}

// 會員登入
export async function loginMember(account: string, password: string): Promise<Member | null> {
  try {
    const response = await api.post('/login/tscp', {
      account,
      password
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error('登入失敗:', error);
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
    const params: any = {};
    if (state !== undefined) {
      params.state = state;
    }
    params.state = 0;
    const response = await api.get('/delivery/medicine', {
      params,
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
export async function createOrder(token: string, orderData: any): Promise<Order | null> {
  try {
    console.log('📤 送出建立訂單請求...');
    
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
    const response = await api.post('/register/phone', {
      phone,
      identity,
      name,
      address: address || ''
    });
    
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