# ✅ Setup Verification Checklist

## Current Status: Device Blocking NOT Active ❌

Your app can't enforce limits because Supabase isn't initialized.

---

## What You Need to Do (In Order)

### ☐ STEP 1: Get Service Role Key from Supabase (2 min)

**Location**: Supabase Dashboard → Settings → API → "Service Role Secret"

```
Supabase Dashboard
    ↓
Click your project
    ↓
⚙️ Settings (left menu)
    ↓
API (in settings)
    ↓
Look for: "Service Role Secret"
    ↓
Click "Copy" button
    ↓
Save somewhere temporarily
```

**What it looks like:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsI...
(very long JWT token, 1000+ characters)
```

- [ ] Copied Service Role Secret

---

### ☐ STEP 2: Add Key to server/.env (1 min)

**File to edit**: `server/.env`

**Original:**
```env
GEMINI_API_KEY_1=AIzaSyCGlIykI9kF1uIWdCIboO7GqW16eujGlKE
GEMINI_API_KEY_2=AIzaSyBkOG75_ZXgXubdX3s08Ug5wN1XjZCIDoA
GEMINI_API_KEY_3=AIzaSyAKCnqdKNYbLlvkiBJcvBkNxsJPXR6wYE8

# Supabase Configuration for Per-User Usage Tracking & Device Fingerprinting
VITE_SUPABASE_URL=https://wdnoyjghtzbsdwmdmsca.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
```

**Edit the last line:**

Replace: `YOUR_SERVICE_ROLE_KEY_HERE`

With: (paste your actual key from Step 1)

**Result should look like:**
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- [ ] Key pasted into server/.env
- [ ] File saved (Ctrl+S)

---

### ☐ STEP 3: Restart Server (1 min)

```bash
# Stop current server: Ctrl+C

cd server
npm run dev
```

**Watch console output. You should see:**
```
🚀 Server running on http://localhost:3301
📊 Using 3 API key(s) for Gemini
✅ Supabase initialized for server-side operations  ← THIS LINE!
```

If you see:
```
⚠️ Supabase keys missing - device tracking will be disabled
```

→ The key wasn't added correctly. Go back to Step 2 and re-check.

- [ ] Server restarted and shows "✅ Supabase initialized"

---

### ☐ STEP 4: Run Migration SQL (2 min)

**Method**: Supabase SQL Editor (recommended)

```
Supabase Dashboard
    ↓
SQL Editor (in left menu)
    ↓
Click "New Query" button
    ↓
Open and copy: migrations/add_usage_tracking.sql
    ↓
Paste the whole thing
    ↓
Click "Run" button
    ↓
Should see: "Query executed successfully"
```

**What gets created:**
- `device_fingerprints` table
- `user_daily_usage` table
- `spam_logs` table

**Verify in SQL Editor:**
```sql
SELECT COUNT(*) FROM device_fingerprints;  -- Should work
SELECT COUNT(*) FROM user_daily_usage;     -- Should work
SELECT COUNT(*) FROM spam_logs;            -- Should work
```

- [ ] Migration SQL executed
- [ ] Tables created and accessible

---

### ☐ STEP 5: Test Device Blocking (3 min)

**Browser**: http://localhost:3006

**Test Scenario**: Create 4 accounts from same browser

| # | Email | Password | Expected | Result |
|---|-------|----------|----------|--------|
| 1 | test1@test.com | Test@123456 | ✅ Works | [ ] |
| 2 | test2@test.com | Test@123456 | ✅ Works | [ ] |
| 3 | test3@test.com | Test@123456 | ✅ Works | [ ] |
| 4 | test4@test.com | Test@123456 | 🚫 Blocked | [ ] |

**How to test:**
1. Click "Sign In to Generate"
2. Enter email and password
3. Click "Create Account"
4. Check server console for device tracking logs
5. Repeat for account 2 and 3
6. Account 4 should fail with error

**Expected error for account 4:**
```
🚫 DEVICE BLOCKED: Maximum account limit reached from this device (3/3)
```

- [ ] Account 1: Created ✅
- [ ] Account 2: Created ✅
- [ ] Account 3: Created ✅
- [ ] Account 4: Blocked 🚫

---

### ☐ STEP 6: Test Daily Limits (2 min)

**Browser**: http://localhost:3006

**Test with Account 1:**

1. Sign in with account 1 (from Step 5)
2. Click "Generate Blueprint"
3. Generate 3 blueprints total
4. Try 4th blueprint

**Expected on 4th attempt:**
```
Daily energy limit reached (3/3). Upgrade to Pro for 10 daily units.
```

- [ ] Generated blueprint #1 ✅
- [ ] Generated blueprint #2 ✅
- [ ] Generated blueprint #3 ✅
- [ ] Blueprint #4 blocked 🚫

---

## Success Indicators

### Server Console Should Show:

```
✅ Supabase initialized for server-side operations
```

### When you signup:
```
✅ Device OK - allowing signup (1/3 accounts)
✅ New device registered (1/3 accounts)
⚠️ MULTI-ACCOUNT ALERT: New user on device with 2 total accounts
❌ BLOCKING signup - Device has 3 accounts (limit: 3 max)
```

### When you generate blueprint:
```
✅ Usage incremented for user
```

---

## If Any Step Is NOT Working

### Issue: "Supabase not initialized"

**Fix**: Re-do Step 2
- Check key is pasted (not placeholder)
- Check it's very long (1000+ chars)
- Check file is saved
- Restart server

### Issue: "Tables don't exist" error

**Fix**: Re-do Step 4
- Run full migration SQL
- Check tables with `SELECT COUNT(*)`
- Verify in SQL Editor directly

### Issue: Account #4 still works

**Fix**: Check in order
1. Is Supabase initialized? (check server logs)
2. Are tables created? (check Supabase SQL Editor)
3. Is service key correct? (verify in server/.env)

### Issue: Daily limits not enforced

**Fix**:
1. Restart server after .env change
2. Sign out and back in
3. User daily_usage table needs to exist

---

## Verification Commands

### Check Server Status
```bash
curl http://localhost:3301/api/status
```

Should return:
```json
{
  "configuration": {
    "supabaseInitialized": true
  },
  "features": {
    "deviceSpamDetection": true,
    "dailyUsageTracking": true
  }
}
```

### Check Devices in Database
Go to **Supabase SQL Editor** and run:
```sql
SELECT * FROM device_fingerprints ORDER BY created_at DESC;
```

Should show your test devices with account counts.

### Check Daily Usage
```sql
SELECT * FROM user_daily_usage WHERE usage_date = CURRENT_DATE;
```

Should show usage tracking for today.

---

## Timeline

- **STEP 1**: 2 minutes
- **STEP 2**: 1 minute
- **STEP 3**: 1 minute
- **STEP 4**: 2 minutes
- **STEP 5**: 3 minutes
- **STEP 6**: 2 minutes

**TOTAL: ~11 minutes**

---

## After Completing This Checklist

✅ Device blocking works - prevents account spam
✅ Daily limits enforced - 3 for free, 10 for pro
✅ Vault limits per-user - free 5, pro unlimited
✅ Audit logs working - spam_logs table populated
✅ Server tracking active - all events logged

Your app is now protected from spam! 🎉

---

## What Each Step Does

| Step | Does | Part of |
|------|------|---------|
| 1-2 | Configures Supabase server key | Authorization |
| 3 | Connects server to Supabase | Connection |
| 4 | Creates database tables | Storage |
| 5 | Verifies device blocking works | Testing |
| 6 | Verifies daily limits work | Testing |

All steps MUST be completed for full functionality!

---

## Support

If stuck on any step:
1. Check CRITICAL_SETUP.md for details
2. Check TROUBLESHOOTING_LIMITS.md for solutions
3. Check server console for error messages
4. Run `curl http://localhost:3301/api/status`

Don't skip steps! They build on each other.
