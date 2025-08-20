#!/bin/bash

echo "🏥 啟動中藥配藥媒合系統 LINE Bot..."

# 檢查是否有 .env 檔案
if [ ! -f .env ]; then
    echo "⚠️  找不到 .env 檔案，請先設定環境變數"
    echo "📝 請複製 .env 範例並填入正確的設定值"
    exit 1
fi

# 詢問啟動方式
echo "請選擇啟動方式："
echo "1) 🐳 Docker 生產模式 (穩定版)"
echo "2) 🔧 Docker 開發模式 (熱重載，推薦開發時使用)"
echo "3) 💻 本機開發 (需要 Node.js)"
read -p "請輸入選項 (1, 2 或 3): " choice

case $choice in
    1)
        echo "🐳 使用 Docker 生產模式啟動..."
        
        # 檢查 Docker 是否安裝
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker 未安裝，請先安裝 Docker"
            exit 1
        fi

        # 檢查 Docker Compose 是否可用
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
            echo "❌ Docker Compose 未安裝，請先安裝 Docker Compose"
            exit 1
        fi

        # 建立上傳目錄
        mkdir -p uploads

        # 停止並清理舊的容器
        echo "🧹 清理舊的容器..."
        docker-compose down 2>/dev/null || docker compose down 2>/dev/null

        # 建立並啟動服務
        echo "🚀 啟動 Docker 生產服務..."
        if command -v docker-compose &> /dev/null; then
            docker-compose up --build -d
        else
            docker compose up --build -d
        fi

        # 等待服務啟動
        echo "⏳ 等待服務啟動..."
        sleep 5

        ;;
    2)
        echo "🔧 使用 Docker 開發模式啟動..."
        
        # 檢查 Docker 是否安裝
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker 未安裝，請先安裝 Docker"
            exit 1
        fi

        # 檢查 Docker Compose 是否可用
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
            echo "❌ Docker Compose 未安裝，請先安裝 Docker Compose"
            exit 1
        fi

        # 建立上傳目錄
        mkdir -p uploads

        # 停止並清理舊的容器
        echo "🧹 清理舊的容器..."
        docker-compose down 2>/dev/null || docker compose down 2>/dev/null
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || docker compose -f docker-compose.dev.yml down 2>/dev/null

        # 建立並啟動開發服務
        echo "🚀 啟動 Docker 開發服務（支援熱重載）..."
        if command -v docker-compose &> /dev/null; then
            docker-compose -f docker-compose.dev.yml up --build -d
        else
            docker compose -f docker-compose.dev.yml up --build -d
        fi

        # 等待服務啟動
        echo "⏳ 等待服務啟動..."
        sleep 15

        # 取得 ngrok 網址
        echo "🔍 取得 ngrok 網址..."
        NGROK_URL=""
        for i in {1..15}; do
            # 方法1：使用 jq 解析 JSON (如果有安裝)
            if command -v jq &> /dev/null; then
                NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[0].public_url // empty' 2>/dev/null)
            fi
            
            # 方法2：從 XML 格式提取
            if [ -z "$NGROK_URL" ]; then
                NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '<PublicURL>[^<]*</PublicURL>' | sed 's/<PublicURL>//g' | sed 's/<\/PublicURL>//g' | head -1)
            fi
            
            # 方法3：從 JSON 格式提取（備用）
            if [ -z "$NGROK_URL" ]; then
                NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*\.ngrok-free\.app' | head -1)
            fi
            
            if [ ! -z "$NGROK_URL" ]; then
                break
            fi
            echo "   嘗試 $i/15..."
            sleep 3
        done

        if [ -z "$NGROK_URL" ]; then
            echo "❌ 無法取得 ngrok 網址，請檢查服務狀態"
            echo "🔍 你可以手動查看："
            echo "   - ngrok 管理介面: http://localhost:4040"
            echo "   - 服務日誌: docker-compose logs"
        else
            echo ""
            echo "✅ 服務啟動成功！"
            echo "📱 Webhook URL: $NGROK_URL/webhook"
            echo "🌐 ngrok 管理介面: http://localhost:4040"
            echo "📊 LINE Bot 健康檢查: http://localhost:3000/health"
            echo ""
            echo "📋 請將以下網址設定到 LINE Developers Console:"
            echo "   $NGROK_URL/webhook"
            echo ""
        fi

        echo "🔧 常用指令："
        echo "   查看日誌: docker-compose logs -f"
        echo "   停止服務: docker-compose down"
        echo "   重啟服務: docker-compose restart"
        echo ""
        echo "按 Ctrl+C 停止服務監控..."

        # 建立清理函數
        cleanup_docker() {
            echo ""
            echo "🛑 停止監控，服務仍在背景運行"
            echo "如需停止服務請執行: docker-compose down"
            exit 0
        }

        # 設定信號處理
        trap cleanup_docker SIGINT SIGTERM

        # 監控服務狀態
        while true; do
            sleep 30
            if ! docker-compose ps 2>/dev/null | grep -q "Up" && ! docker compose ps 2>/dev/null | grep -q "running"; then
                echo "⚠️  檢測到服務異常，請檢查日誌: docker-compose logs"
                break
            fi
        done
        ;;
        
    3)
        echo "💻 使用本機開發..."
        
        # 檢查 Node.js 是否安裝
        if ! command -v node &> /dev/null; then
            echo "❌ Node.js 未安裝，請先安裝 Node.js"
            exit 1
        fi

        # 檢查 ngrok 是否安裝
        if ! command -v ngrok &> /dev/null; then
            echo "⚠️  ngrok 未安裝，正在安裝..."
            if command -v brew &> /dev/null; then
                brew install ngrok
            else
                echo "❌ 請手動安裝 ngrok: https://ngrok.com/download"
                exit 1
            fi
        fi

        # 建立上傳目錄
        mkdir -p uploads

        # 安裝依賴
        echo "📦 安裝依賴套件..."
        npm install

        # 編譯 TypeScript
        echo "🔨 編譯 TypeScript..."
        npm run build

        # 啟動 ngrok（背景執行）
        echo "🌐 啟動 ngrok 隧道..."
        ngrok http 3000 > /dev/null 2>&1 &
        NGROK_PID=$!

        # 等待 ngrok 啟動
        echo "⏳ 等待 ngrok 啟動..."
        sleep 3

        # 取得 ngrok 網址
        echo "🔍 取得 ngrok 網址..."
        
        # 方法1：使用 jq 解析 JSON (如果有安裝)
        if command -v jq &> /dev/null; then
            NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url // empty' 2>/dev/null)
        fi
        
        # 方法2：從 XML 格式提取
        if [ -z "$NGROK_URL" ]; then
            NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '<PublicURL>[^<]*</PublicURL>' | sed 's/<PublicURL>//g' | sed 's/<\/PublicURL>//g' | head -1)
        fi
        
        # 方法3：從 JSON 格式提取（備用）
        if [ -z "$NGROK_URL" ]; then
            NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok-free\.app' | head -1)
        fi

        if [ -z "$NGROK_URL" ]; then
            echo "❌ 無法取得 ngrok 網址，請檢查 ngrok 是否正常運行"
            kill $NGROK_PID 2>/dev/null
            exit 1
        fi

        echo "✅ ngrok 隧道已建立："
        echo "📱 Webhook URL: $NGROK_URL/webhook"
        echo "🌐 ngrok 管理介面: http://localhost:4040"
        echo ""
        echo "📋 請將以下網址設定到 LINE Developers Console:"
        echo "   $NGROK_URL/webhook"
        echo ""

        # 建立清理函數
        cleanup_local() {
            echo ""
            echo "🛑 正在關閉服務..."
            kill $NGROK_PID 2>/dev/null
            exit 0
        }

        # 設定信號處理
        trap cleanup_local SIGINT SIGTERM

        # 啟動服務
        echo "🚀 啟動 LINE Bot 服務（開發模式）..."
        npm run dev &
        BOT_PID=$!

        # 等待服務結束
        wait $BOT_PID
        ;;
        
    *)
        echo "❌ 無效的選項，請輸入 1, 2 或 3"
        exit 1
        ;;
esac