FROM node:18-alpine

# 安裝 curl 用於健康檢查
RUN apk add --no-cache curl

WORKDIR /app

# 複製 package files
COPY package*.json ./

# 安裝所有依賴（包含 devDependencies 用於編譯）
RUN npm ci

# 複製源碼
COPY . .

# 建立上傳目錄
RUN mkdir -p uploads

# 編譯 TypeScript
RUN npm run build

# 移除 devDependencies 以減少映像大小
RUN npm prune --production

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["npm", "start"]