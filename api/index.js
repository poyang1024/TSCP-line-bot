// Vercel 入口點
const app = require('../dist/index.js');
module.exports = app.default || app;
