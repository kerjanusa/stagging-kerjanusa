#!/usr/bin/env bash

set -euo pipefail

# Warna output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 KerjaNusa Frontend Setup${NC}\n"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js tidak terinstall${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js terinstall${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ NPM tidak terinstall${NC}"
    exit 1
fi
echo -e "${GREEN}✅ NPM terinstall${NC}\n"

# Install dependencies
echo -e "${YELLOW}📦 Installing NPM dependencies...${NC}"
npm install

# Run dev server
echo -e "\n${GREEN}✅ Setup selesai!${NC}"
echo -e "${GREEN}🌐 Menjalankan Vite di port default (biasanya http://localhost:5173)${NC}\n"
npm run dev
