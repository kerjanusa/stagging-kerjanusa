#!/usr/bin/env bash

set -euo pipefail

# Warna output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 KerjaNusa Backend Setup${NC}\n"

# Check PHP
if ! command -v php &> /dev/null; then
    echo -e "${RED}❌ PHP tidak terinstall${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PHP terinstall${NC}"

# Check Composer
if ! command -v composer &> /dev/null; then
    echo -e "${RED}❌ Composer tidak terinstall${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Composer terinstall${NC}\n"

# Setup .env
echo -e "${YELLOW}⚙️  Setting up .env${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ .env dibuat${NC}"
else
    echo -e "${YELLOW}ℹ️  .env sudah ada${NC}"
fi

# Install dependencies
echo -e "\n${YELLOW}📦 Installing Composer dependencies...${NC}"
composer install --no-interaction --prefer-dist

# Generate key
echo -e "\n${YELLOW}🔑 Generating app key${NC}"
php artisan key:generate

# Run server
echo -e "\n${GREEN}✅ Setup selesai!${NC}"
echo -e "${GREEN}🌐 Menjalankan server di http://localhost:8000${NC}\n"
php artisan serve --host=0.0.0.0 --port=8000
