# Troubleshooting: Per-User Limits & Device Blocking Not Working

## 🔴 Problem: "I can still create unlimited accounts and use without limits"

This means **device blocking and usage limits are not active yet**. Here's how to fix it:

---

## ✅ Quick Diagnosis

Run these commands in your server console to check status:

### Check 1: Is Supabase Connected?
Look at your server startup logs. You should see:
```
✅ Supabase initialized for server-side operations
```

If you see:
```
⚠️ Supabase keys missing - device tracking will be disabled
```
→ **Go to Step 1 below**

### Check 2: Are Device Tables Created?
In **Supabase Dashboard → SQL Editor**, run:
```sql
SELECT COUNT(*) FROM device_fingerprints;
```

If you get error: `relation "device_fingerprints" does not exist`
→ **Go to Step 2 below**

### Check 3: Are Devices Being Tracked?
Run in **Supabase SQL Editor**:
```sql
SELECT * FROM device_fingerprints ORDER BY created_at DESC LIMIT 5;
```

If empty → Devices not being registered (likely because service key is missing)

---

## 🔧 Step 1: Add Your Service Role Key (MOST IMPORTANT!)

### Problem
`server/.env` still has placeholder:
```env
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
```

### Solution
1. Go to: **Supabase Dashboard → Settings → API** (in left sidebar)
2. Look for **"Service Role Secret"** (NOT the anon key!)
3. Copy the entire JWT token
4. Edit `server/.env` and replace the whole line:

**Before:**
```env
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
```

**After:**
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

5. **Save the file**

⚠️ **Important**: Keep this key secret! Never commit to git.

### Verify
Restart server:
```bash
cd server
npm run dev
```

Look for:
```
✅ Supabase initialized for server-side operations
```

**If you still see the warning**, double-check:
- Did you copy the entire long token?
- Is there trailing whitespace in the .env file?
- Did you save the file?

---

## ✅ Step 2: Run the Migration

The tables don't exist yet because the migration hasn't been executed.

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to **Supabase Dashboard → SQL Editor**
2. Click **"New Query"** button
3. Copy entire contents from `migrations/add_usage_tracking.sql`
4. Paste into the SQL editor
5. Click **"Run"** button

You should see:
```
Query executed successfully
```

### Option B: Using psql (if you have it installed)

```bash
psql "your_supabase_connection_string" -f migrations/add_usage_tracking.sql
```

### Verify Tables Were Created

In **SQL Editor**, run:
```sql
\dt
```

You should see these new tables:
- `device_fingerprints`
- `user_daily_usage`
- `spam_logs`

---

## 🚀 Step 3: Restart Everything

### Restart Server
```bash
cd server
npm run dev
```

Watch console for:
```
✅ Supabase initialized for server-side operations
📊 Using 3 API key(s) for Gemini
```

### Restart Frontend
```bash
npm run dev
```

---

## 🧪 Step 4: Test Device Blocking

### Test Signup Blocking

**Scenario**: Create 3 accounts on same device

1. Open http://localhost:3006
2. Click "Sign In to Generate" 
3. **Account #1**:
   - Email: `test1@example.com`
   - Password: `Test@123456`
   - Click "Create Account"
   - Check server console - should show:
     ```
     ✅ New device registered (1/3 accounts)
     ```
   - ✅ Should succeed

4. **Account #2** (same browser):
   - Email: `test2@example.com`
   - Password: `Test@123456`
   - Click "Create Account"
   - Check server console - should show:
     ```
     ✅ Device OK - allowing signup (1/3 accounts)
     ⚠️ MULTI-ACCOUNT ALERT: New user on device with 2 total accounts
     ```
   - ✅ Should succeed

5. **Account #3** (same browser):
   - Email: `test3@example.com`
   - Password: `Test@123456`
   - Click "Create Account"
   - Check server console - should show:
     ```
     ✅ Device OK - allowing signup (2/3 accounts)
     ⚠️ MULTI-ACCOUNT ALERT: New user on device with 3 total accounts
     ❌ AUTO-BLOCKED: Device exceeded 3 account limit (3 found)
     ```
   - ✅ Should succeed but now blocked

6. **Account #4** (same browser):
   - Email: `test4@example.com`
   - Password: `Test@123456`
   - Click "Create Account"
   - Check browser - should show error:
     ```
     🚫 DEVICE BLOCKED: Maximum account limit reached from this device (3/3)
     ```
   - Server console shows:
     ```
     ❌ BLOCKING signup - Device has 3 accounts (limit: 3 max)
     ```
   - 🚫 Should FAIL

### If Account #4 Still Succeeds
The device blocking isn't working. Check:

1. ✅ Is Supabase service role key set? (Step 1)
2. ✅ Did you run the migration? (Step 2)
3. ✅ Are tables created? 
   ```sql
   SELECT COUNT(*) FROM device_fingerprints;
   ```
4. ✅ Is server showing device logs?
   - Check console after signup for "✅ Device registered" messages
   - If blank → Supabase not initialized

---

## 📊 Test Daily Usage Limits

### Test Free User Limit (3/day)

1. Sign in as the first account you created
2. Click "Generate Blueprint" 
3. Repeat 3 times
4. On 4th attempt - should see error:
   ```
   Daily energy limit reached (3/3). Upgrade to Pro for 10 daily units.
   ```

### Check Server Logs

Should see:
```
✅ Usage incremented for user
```

### If Limits Don't Enforce

Check:
1. ✅ Can server access `user_daily_usage` table?
   ```sql
   SELECT COUNT(*) FROM user_daily_usage;
   ```
2. ✅ Is server console showing "Usage incremented" messages?

---

## 🔍 Debugging Queries

Run these in **Supabase SQL Editor** to check data:

### See All Device Fingerprints
```sql
SELECT 
  device_fingerprint,
  account_count,
  is_blocked,
  created_at
FROM device_fingerprints
ORDER BY created_at DESC;
```

### See Accounts Per Device
```sql
SELECT 
  device_fingerprint,
  COUNT(DISTINCT user_id) as account_count,
  STRING_AGG(DISTINCT user_id::text, ', ') as user_ids
FROM device_fingerprints
GROUP BY device_fingerprint
ORDER BY account_count DESC;
```

### See Daily Usage
```sql
SELECT 
  u.user_id,
  u.usage_count,
  u.usage_date,
  p.email
FROM user_daily_usage u
LEFT JOIN auth.users p ON p.id = u.user_id
WHERE u.usage_date = CURRENT_DATE
ORDER BY u.usage_count DESC;
```

### See Suspicious Activity
```sql
SELECT 
  device_fingerprint,
  action,
  details,
  created_at
FROM spam_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📝 Vault Limits (Per-User)

### Issue: Vault showing all users' blueprints

Fixed! Now:
- Free users see only their 5 vault items
- Pro users see unlimited
- Each user has separate storage

### Test
1. Sign in as User A
2. Generate and save 5 blueprints
3. Sign out
4. Sign in as User B
5. Vault should be empty (not showing User A's items) ✅

---

## 🆘 Still Not Working?

### Collect Debug Info

**Server logs** (copy-paste from terminal):
```
npm run dev
# Generate a blueprint
# Share the console output
```

**Browser console** (F12 → Console tab):
```javascript
// Type in console:
console.log(localStorage.getItem('acend_device_fingerprint'))
```

**Supabase status**:
```sql
-- Run in SQL Editor
SELECT COUNT(*) FROM device_fingerprints;
SELECT COUNT(*) FROM user_daily_usage;
SELECT COUNT(*) FROM auth.users;
```

### Common Issues

| Problem | Solution |
|---------|----------|
| "Supabase not initialized" | Add service role key to server/.env (Step 1) |
| "relation does not exist" | Run migration in SQL Editor (Step 2) |
| Device still allows 4th account | Check if tables are being updated (query above) |
| Vault shows all users' items | Hard refresh browser (Ctrl+Shift+R) and re-login |
| Daily limits not enforcing | Restart server after .env change |

---

## ✅ Success Checklist

- [ ] Server startup shows "✅ Supabase initialized"
- [ ] Migration ran successfully in SQL Editor
- [ ] Tables exist: `device_fingerprints`, `user_daily_usage`, `spam_logs`
- [ ] 1st account creation → ✅ succeeds
- [ ] 2nd account → ✅ succeeds
- [ ] 3rd account → ✅ succeeds
- [ ] 4th account → 🚫 blocked with error message
- [ ] Generate 3 blueprints → 4th blocked with "Daily limit"
- [ ] Different browser → new device, can create 1st account again
- [ ] Other user's vault items not visible

Once all ✅, your limits system is working! 🎉

---

## Questions?

Key things to check if still having issues:

1. **Is the service role key actually there?**
   ```bash
   cat server/.env | grep SUPABASE_SERVICE_ROLE_KEY
   ```
   Should show long JWT, NOT `YOUR_SERVICE_ROLE_KEY_HERE`

2. **Did the migration run?**
   ```sql
   \dt  -- In Supabase SQL Editor
   ```
   Should list device_fingerprints, user_daily_usage, spam_logs

3. **Is the server hitting the right endpoints?**
   Check browser Network tab (F12) when signing up:
   - `POST /api/check-spam` - should return `{isBlocked: false}`
   - `POST /api/register-device` - should return `{success: true}`

4. **Are there any error messages?**
   - Browser console (F12)
   - Server terminal
   - Supabase dashboard → Logs

If none of this works, the most common fix is **Step 1: Add the actual service role key**. That's required for everything to function!
