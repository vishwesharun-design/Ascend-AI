#!/bin/bash
# Setup verification script for Ascend AI limits

echo "========================================="
echo "Ascend AI - Limits Setup Verification"
echo "========================================="
echo ""

# Check 1: Server .env file
echo "📋 Checking server/.env..."
if [ ! -f "server/.env" ]; then
    echo "❌ server/.env not found"
else
    if grep -q "SUPABASE_SERVICE_ROLE_KEY=" server/.env; then
        if grep -q "YOUR_SERVICE_ROLE_KEY_HERE" server/.env; then
            echo "⚠️ SUPABASE_SERVICE_ROLE_KEY is still a placeholder"
            echo "   👉 Replace 'YOUR_SERVICE_ROLE_KEY_HERE' with actual key from Supabase Settings → API"
        else
            echo "✅ SUPABASE_SERVICE_ROLE_KEY is configured"
        fi
    else
        echo "❌ SUPABASE_SERVICE_ROLE_KEY missing from server/.env"
    fi

    if grep -q "VITE_SUPABASE_URL=" server/.env; then
        echo "✅ VITE_SUPABASE_URL is configured"
    else
        echo "❌ VITE_SUPABASE_URL missing from server/.env"
    fi
fi

echo ""
echo "📦 Checking migration file..."
if [ -f "migrations/add_usage_tracking.sql" ]; then
    echo "✅ Migration file exists: migrations/add_usage_tracking.sql"
    echo "   👉 Run this in Supabase SQL Editor to create tables"
else
    echo "❌ Migration file not found"
fi

echo ""
echo "🔧 Installation Status:"
echo "   1. ✅ Copy actual SUPABASE_SERVICE_ROLE_KEY to server/.env"
echo "   2. ✅ Run migration in Supabase SQL Editor"
echo "   3. ✅ Restart backend: cd server && npm run dev"
echo "   4. ✅ Test signup with device blocking"

echo ""
echo "📊 Testing:"
echo "   1. Open http://localhost:3006"
echo "   2. Click 'Sign In to Generate'"
echo "   3. Try creating account #1 (should work ✅)"
echo "   4. Try creating account #2 (should work ✅)" 
echo "   5. Try creating account #3 (should work ✅)"
echo "   6. Try creating account #4 (should show error 🚫)"

echo ""
echo "🔍 Debugging:"
echo "   - Check browser console (F12) for device fingerprint logs"
echo "   - Check server console for spam detection logs"
echo "   - If blocked still doesn't work, verification below:"
echo ""
echo "   a) Is Supabase initialized?"
echo "      → Check server logs for '✅ Supabase initialized' message"
echo ""
echo "   b) Do device_fingerprints tables exist?"
echo "      → Go to Supabase Dashboard → SQL Editor"
echo "      → Run: SELECT COUNT(*) FROM device_fingerprints;"
echo ""
echo "   c) Are devices being registered?"
echo "      → Run: SELECT * FROM device_fingerprints LIMIT 5;"
echo ""
echo "========================================="
