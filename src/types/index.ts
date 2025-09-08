// 用戶暫存資料 (僅用於訂單流程)
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
  selectedPharmacyId?: string;      // 選中的藥局 ID
  isDelivery?: boolean;
  processingStartTime?: number;     // 開始處理時間
  orderStepStartTime?: number;      // 訂單步驟開始時間
  [key: string]: any;              // 保持彈性
}

// 用戶狀態 (主要為向後相容，登入狀態現在由 JWT 管理)
export interface UserState {
  userId: string;
  memberId?: number;
  memberName?: string;
  accessToken?: string;
  currentStep?: string;
  loginMethod?: 'account' | 'line';
  tempData?: UserTempData;
}

// 訂單步驟枚舉
export enum OrderStep {
  NONE = '',
  PRESCRIPTION_UPLOADED = 'prescription_uploaded',
  PHARMACY_SELECTED = 'pharmacy_selected',
  ORDER_CONFIRMED = 'order_confirmed',
  PROCESSING_IMAGE = 'processing_image'
}

// 訂單步驟超時設定（3分鐘）
export const ORDER_STEP_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds

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