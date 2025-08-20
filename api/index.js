// Vercel 入口點
const app = require('../dist/index.js');

// 確保正確導出 Express 應用程式
module.exports = app.default || app;
