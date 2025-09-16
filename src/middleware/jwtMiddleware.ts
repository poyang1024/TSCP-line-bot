import { Request, Response, NextFunction } from 'express';
import { verifyUserToken, JWTPayload } from '../services/jwtService';

// 擴展 Request 介面以包含用戶資訊
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      lineUserId?: string;
    }
  }
}

// JWT 中間件
export function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
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
      req.user = decoded;
      req.lineUserId = decoded.l;  // lineId -> l
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
    if (!req.user || req.user.l !== userId) {  // lineId -> l
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: '權限不足' 
      });
    }
    next();
  };
}
