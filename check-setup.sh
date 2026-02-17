#!/bin/bash
# Quick diagnostic script for Ascend AI limits setup

echo "=================================================="
echo "⚙️  ASCEND AI - LIMITS SETUP DIAGNOSTIC"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check 1: Service Role Key
echo -e "${BLUE}[1/5] Checking Supabase Service Role Key...${NC}"
if [ -f "server/.env" ]; then
    if grep -q "SUPABASE_SERVICE_ROLE_KEY=" server/.env; then
        KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY=" server/.env | cut -d'=' -f2)
        if [[ "$KEY" == "YOUR_SERVICE_ROLE_KEY_HERE" ]]; then
            echo -e "${RED}❌ MISSING: Service role key is still placeholder${NC}"
            echo "   Action: Get real key from Supabase Settings → API"
            ISSUES=$((ISSUES+1))
        elif [[ -z "$KEY" ]]; then
            echo -e "${RED}❌ EMPTY: No service role key value${NC}"
            ISSUES=$((ISSUES+1))
        else
            echo -e "${GREEN}✅ CONFIGURED: Service role key is set${NC}"
        fi
    else
        echo -e "${RED}❌ MISSING: SUPABASE_SERVICE_ROLE_KEY not in .env${NC}"
        ISSUES=$((ISSUES+1))
    fi
else
    echo -e "${YELLOW}⚠️  server/.env not found${NC}"
fi

# Check 2: Supabase URL
echo ""
echo -e "${BLUE}[2/5] Checking Supabase URL...${NC}"
if [ -f "server/.env" ]; then
    if grep -q "VITE_SUPABASE_URL=" server/.env; then
        URL=$(grep "VITE_SUPABASE_URL=" server/.env | cut -d'=' -f2)
        if [[ -z "$URL" ]]; then
            echo -e "${RED}❌ EMPTY: No Supabase URL${NC}"
            ISSUES=$((ISSUES+1))
        else
            echo -e "${GREEN}✅ CONFIGURED: $URL${NC}"
        fi
    else
        echo -e "${RED}❌ MISSING: VITE_SUPABASE_URL not in .env${NC}"
        ISSUES=$((ISSUES+1))
    fi
fi

# Check 3: API Keys
echo ""
echo -e "${BLUE}[3/5] Checking Gemini API Keys...${NC}"
if [ -f "server/.env" ]; then
    KEY_COUNT=0
    if grep -q "GEMINI_API_KEY_1=" server/.env && ! grep -q "GEMINI_API_KEY_1=$" server/.env; then
        KEY_COUNT=$((KEY_COUNT+1))
    fi
    if grep -q "GEMINI_API_KEY_2=" server/.env && ! grep -q "GEMINI_API_KEY_2=$" server/.env; then
        KEY_COUNT=$((KEY_COUNT+1))
    fi
    if grep -q "GEMINI_API_KEY_3=" server/.env && ! grep -q "GEMINI_API_KEY_3=$" server/.env; then
        KEY_COUNT=$((KEY_COUNT+1))
    fi
    
    if [ $KEY_COUNT -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No API keys configured (fallback mode)${NC}"
    else
        echo -e "${GREEN}✅ $KEY_COUNT Gemini API keys configured${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Cannot check API keys${NC}"
fi

# Check 4: Migration file
echo ""
echo -e "${BLUE}[4/5] Checking migration files...${NC}"
if [ -f "migrations/add_usage_tracking.sql" ]; then
    echo -e "${GREEN}✅ Migration file exists${NC}"
else
    echo -e "${RED}❌ Migration file missing${NC}"
    ISSUES=$((ISSUES+1))
fi

# Check 5: Package.json dependencies
echo ""
echo -e "${BLUE}[5/5] Checking dependencies...${NC}"
if [ -f "server/package.json" ]; then
    if grep -q "@supabase/supabase-js" server/package.json; then
        echo -e "${GREEN}✅ Supabase package installed${NC}"
    else
        echo -e "${RED}❌ Supabase package missing${NC}"
        echo "   Action: Run 'cd server && npm install'"
        ISSUES=$((ISSUES+1))
    fi
else
    echo -e "${YELLOW}⚠️  No server/package.json found${NC}"
fi

# Summary
echo ""
echo "=================================================="
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Restart server: cd server && npm run dev"
    echo "2. Run migration in Supabase SQL Editor"
    echo "3. Test signup with device blocking"
else
    echo -e "${RED}❌ ISSUES FOUND: $ISSUES${NC}"
    echo ""
    echo "CRITICAL: Device blocking will NOT work without fixing above issues."
    echo ""
    echo "Top priority: Add real SUPABASE_SERVICE_ROLE_KEY to server/.env"
fi

echo "=================================================="
echo ""
echo "For detailed help, see TROUBLESHOOTING_LIMITS.md"
