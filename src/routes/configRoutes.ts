import { Router } from 'express';

const router = Router();

// 提供前端需要的配置資訊
router.get('/config', (req, res) => {
  try {
    const config = {
      liffId: process.env.LIFF_ID || null,
      // 可以加入其他前端需要的配置
    };
    
    res.json(config);
  } catch (error) {
    console.error('取得配置失敗:', error);
    res.status(500).json({ error: '無法取得配置' });
  }
});

export default router;
