import { Request, Response, NextFunction } from 'express';
import { verifyUserToken, JWTPayload } from '../services/jwtService';
import { getUserLoginState, extendUserLoginSession } from '../services/redisService';

// 擴展 Request 介面以包含用戶資訊
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & {
        memberId?: number;
        accessToken?: string;
        memberName?: string;
      };
      lineUserId?: string;
    }
  }
}

// JWT 中間件
export async function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // 從 cookie 中取得 JWT token
    const token = req.cookies?.jwt_token;
    
    if (!token) {
      req.user = undefined;
      return next();
    }
    
    // 驗證 JWT token
    const decoded = verifyUserToken(token);
    
    if (decoded) {
      // 驗證 Redis 中的登入狀態
      const loginState = await getUserLoginState(decoded.lineId);
      
      if (loginState) {
        // 用戶已登入，設置用戶資訊
        req.user = {
          ...decoded,
          memberId: loginState.memberId,
          accessToken: loginState.accessToken,
          memberName: loginState.memberName
        };
        req.lineUserId = decoded.lineId;
        
        // 延長登入 session
        await extendUserLoginSession(decoded.lineId);
        console.log(`✅ JWT 驗證成功並延長 session - ${decoded.lineId}`);
      } else {
        // JWT 有效但 Redis 中沒有登入狀態，可能是登入過期
        console.warn(`⚠️ JWT 有效但登入狀態已過期 - ${decoded.lineId}`);
        req.user = undefined;
        
        // 清除無效的 JWT cookie
        res.clearCookie('jwt_token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        });
      }
    } else {
      req.user = undefined;
    }
    
    next();
  } catch (error) {
    console.error('JWT middleware error:', error);
    req.user = undefined;
    next();
  }
}

// 需要登入的路由保護
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: '請先登入' 
    });
  }
  next();
}

// 檢查是否為特定用戶
export function requireUser(userId: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.lineId !== userId) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: '權限不足' 
      });
    }
    next();
  };
}
