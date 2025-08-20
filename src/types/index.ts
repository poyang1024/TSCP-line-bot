// 用戶狀態
export interface UserState {
  userId: string;
  memberId?: number;
  memberName?: string;
  accessToken?: string;
  currentStep?: string;
  loginMethod?: 'account' | 'line';
  tempData?: any;
}

// 會員資料
export interface Member {
  user_id: number;
  name: string;
  account: string;
  access_token: string;
}

// 藥局資料
export interface Pharmacy {
  id: number;
  org_name: string;
  name: string;
  address: string;
}

// 訂單資料
export interface Order {
  id: number;
  order_code: string;
  confirmation_code?: string;
  state: number;
  area_name: string;
  is_delivery: boolean;
  member_name: string;
  hospital?: string;
  department?: string;
  phone?: string;
  address?: string;
  start_date?: number;
  end_date?: number;
  plan_date?: number;
  remark?: string;
  files: string[];
}

// 訂單狀態
export enum OrderState {
  RECEIVED = 0,    // 收單
  SUPPLEMENT = 1,  // 補單
  REJECTED = 2,    // 拒單
  SCHEDULED = 3,   // 排單
  CANCELLED = 4,   // 棄單
  COMPLETED = 5    // 完成
}

// WebSocket 訊息
export interface WebSocketMessage {
  id: number;
  order_code: string;
  member_id: number;
  state: number;
}