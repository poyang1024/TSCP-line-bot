// 用戶暫存資料
export interface UserTempData {
  waitingFor?: string;
  memberInfo?: {
    memberId: number;
    memberName: string;
    accessToken: string;
  };
  memberPersonalInfo?: {
    phone: string | null;
    address: string | null;
  };
  prescriptionFile?: string;        // 檔案路徑（可能是臨時路徑）
  prescriptionFileName?: string;    // 檔案名稱
  prescriptionBuffer?: string;      // base64 編碼的檔案內容（已棄用）
  messageId?: string;               // LINE 訊息 ID，用於即時下載
  selectedPharmacy?: {
    id: number;
    name: string;
  };
  isDelivery?: boolean;
  [key: string]: any;              // 保持彈性
}

// 用戶狀態
export interface UserState {
  userId: string;
  memberId?: number;
  memberName?: string;
  accessToken?: string;
  currentStep?: string;
  loginMethod?: 'account' | 'line';
  tempData?: UserTempData;
}

// 會員資料
export interface Member {
  user_id: number;
  name: string;
  account: string;
  access_token: string;
  info: {
    phone: string | null;
    address: string | null;
  };
}

// 藥局資料
export interface Pharmacy {
  id: number;
  org_name: string;
  name: string;
  address: string;
  phone?: string;
}

// 訂單歷史記錄
export interface OrderHistory {
  state: number;
  created_at: number;  // UNIX timestamp
  reason?: string | null;  // 狀態變更原因
}

// 藥局區域資料 (新增)
export interface OrderArea {
  name: string;          // 藥局名稱
  phone: string | null;  // 藥局電話
  address: string;       // 藥局地址
}

// 訂單資料
export interface Order {
  id: number;
  order_code: string;
  confirmation_code?: string;
  state: number;
  area: OrderArea;       // 新的藥局資訊結構
  area_name: string;     // 保留舊欄位以確保向後相容
  area_phone?: string;   // 保留舊欄位以確保向後相容
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
  history?: OrderHistory[];  // 訂單歷史記錄
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