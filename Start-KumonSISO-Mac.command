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

echo "[INFO] Starting Kumon SISO Local Server..."
npm run start:server &

sleep 2

echo "[INFO] Opening Desktop Admin in your default browser..."
open "http://localhost:5174"
open "http://localhost:5173"

echo "Kumon SISO is now running!"
