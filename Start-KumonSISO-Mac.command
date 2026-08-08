#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "==================================================="
echo "  Kumon SISO - Starting Application Services..."
echo "==================================================="

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please download and install Node.js from https://nodejs.org/"
    read -p "Press enter to exit..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[INFO] First-time setup detected. Installing packages..."
    npm install
fi

if [ ! -d "packages/shared/dist" ]; then
    echo "[INFO] Building application packages..."
    npm run build
fi

echo "[INFO] Starting Kumon SISO Local Server on port 3000..."
HOST=127.0.0.1 npm run start:server &

echo "[INFO] Starting Check-In PWA on port 5173..."
npm run dev:pwa &

echo "[INFO] Starting Desktop Admin on port 5174..."
npm run dev:admin &

echo "[INFO] Waiting for services to start..."
READY=0
for i in $(seq 1 30); do
    READY=0
    curl -sf http://127.0.0.1:3000/api/health > /dev/null 2>&1 && READY=$((READY + 1))
    curl -sf http://127.0.0.1:5173/ > /dev/null 2>&1 && READY=$((READY + 1))
    curl -sf http://127.0.0.1:5174/ > /dev/null 2>&1 && READY=$((READY + 1))
    if [ "$READY" -eq 3 ]; then
        echo "[INFO] All services are ready!"
        break
    fi
    sleep 1
done

echo "[INFO] Opening Desktop Admin in your default browser..."
open "http://localhost:5174"
open "http://localhost:5173"

echo "Kumon SISO is now running!"
