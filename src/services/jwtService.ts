import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d' // 7天過期

// 緊湊版的 JWT payload 結構（減少欄位名稱長度以符合 LINE Rich Menu 300字符限制）
export interface CompactUserSession {
  l: string    // lineId
  m: number    // memberId
  t: string    // accessToken
  n: string    // memberName
  exp?: number
}

export interface JWTPayload extends CompactUserSession {
  iat: number
  exp: number
}

// 相容性介面（舊版格式）
export interface UserSession {
  lineId: string
  memberId: number
  accessToken: string
  memberName: string
  exp?: number
}

// 建立 JWT Token（使用緊湊格式）
export function createUserToken(lineId: string, memberId: number, accessToken: string, memberName: string): string {
  const payload: CompactUserSession = {
    l: lineId,       // lineId -> l
    m: memberId,     // memberId -> m
    t: accessToken,  // accessToken -> t
    n: memberName    // memberName -> n
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// 驗證 JWT Token
export function verifyUserToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    
    // 檢查是否過期
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token expired')
      return null
    }
    
    return decoded
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

// 刷新 Token (延長有效期)
export function refreshUserToken(oldToken: string): string | null {
  const decoded = verifyUserToken(oldToken)
  
  if (!decoded) {
    return null
  }
  
  // 建立新的 Token（使用緊湊格式欄位）
  return createUserToken(
    decoded.l,  // lineId -> l
    decoded.m,  // memberId -> m
    decoded.t,  // accessToken -> t
    decoded.n   // memberName -> n
  )
}

// 解析 Token 但不驗證 (用於取得基本資訊)
export function decodeUserToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload
  } catch (error) {
    console.error('JWT decode failed:', error)
    return null
  }
}
