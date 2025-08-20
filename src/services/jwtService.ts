import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
const JWT_EXPIRES_IN = '30m' // 30分鐘過期

export interface UserSession {
  lineId: string
  memberId: number
  accessToken: string
  memberName: string
  exp?: number
}

export interface JWTPayload extends UserSession {
  iat: number
  exp: number
}

// 建立 JWT Token
export function createUserToken(lineId: string, memberId: number, accessToken: string, memberName: string): string {
  const payload: UserSession = {
    lineId,
    memberId,
    accessToken,
    memberName
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
  
  // 建立新的 Token
  return createUserToken(
    decoded.lineId,
    decoded.memberId,
    decoded.accessToken,
    decoded.memberName
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
