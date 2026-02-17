# Setup Guide: Per-User Limits & Device Spam Detection

## Quick Setup Steps

### Step 1: Get Your Supabase Service Role Key

1. Go to your Supabase Project: [https://app.supabase.com](https://app.supabase.com)
2. Navigate to **Settings → API** (left sidebar)
3. Find **Project API Keys** section
4. Copy the **Service Role Secret** (NOT the anon key)
5. Edit `server/.env` and replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key

```env
# server/.env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Security Note**: Service role key is sensitive! Keep it in `.env` and never commit to git.

### Step 2: Run the Migration

Execute the migration to create new tables:

```bash
# Using psql (direct Postgres connection)
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" -f migrations/add_usage_tracking.sql

# Or using Supabase SQL Editor:
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy contents from migrations/add_usage_tracking.sql
# 3. Paste and run
```

You should see success messages:
```
✅ user_daily_usage table created
✅ device_fingerprints table created
✅ spam_logs table created
✅ RLS policies enabled
```

### Step 3: Restart Backend Server

```bash
cd server
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:3301
📊 Using 3 API key(s) for Gemini
✅ Supabase initialized for server-side operations
```

### Step 4: Verify It's Working

**Test 1: Sign Up & Device Tracking**
1. Open http://localhost:3006
2. Click "Sign In to Generate"
3. Create new account (different email each time)
4. First signup should work ✅
5. Try creating 2nd account on same device (watch browser console)
6. After 3rd account, 4th should show error

**Test 2: Daily Usage Limits**
1. Sign in with account
2. Generate 3 blueprints → should hit limit
3. See message: "Daily energy limit reached (3/3)"
4. Wait for next day OR sign out and in with Pro account

**Test 3: Server Logs**
Watch server terminal:
```
⚠️ New account detected on device with 2 total accounts
✅ Device registered for user
✅ Usage incremented for user
```

## Troubleshooting

### Error: "Supabase keys missing - device tracking will be disabled"
**Solution**: Add `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `server/.env`

### Error: "relation 'user_daily_usage' does not exist"
**Solution**: Run the migration in step 2. Migration creates these tables.

### Default Usage Count at Login
If you see usage always reset to 0:
1. Check Supabase has `user_daily_usage` table
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
3. Check server logs for connection errors

### Device Fingerprint Not Persisting
**Solution**: 
- Browser might be blocking localStorage
- Try different browser or incognito mode
- Check browser console for storage errors

### Can't Create More Accounts on Device
**Solution**:
- This is working as intended! 
- To test with more accounts, use a different browser/device
- Or clear localStorage: `localStorage.removeItem('acend_device_fingerprint')`

## Configuration Files Changed

### Frontend
- ✅ `App.tsx` - Fetches daily usage from server
- ✅ `components/AuthModal.tsx` - Checks device spam before signup
- ✅ `services/geminiService.ts` - Passes userId to backend
- ✅ `services/deviceFingerprint.ts` - NEW - Device tracking
- ✅ `package.json` - No new deps needed

### Backend
- ✅ `server/index.js` - Added 4 new endpoints + Supabase client
- ✅ `server/.env` - Added Supabase keys
- ✅ `server/package.json` - Added @supabase/supabase-js
- ✅ `migrations/add_usage_tracking.sql` - NEW - Database schema

## API Endpoints Reference

### Check Device (Before Signup)
```bash
curl -X POST http://localhost:3301/api/check-spam \
  -H "Content-Type: application/json" \
  -d '{ "deviceFingerprint": "abc123..." }'

# Response
{ "isBlocked": false, "reason": null }
```

### Register Device (After Signup)
```bash
curl -X POST http://localhost:3301/api/register-device \
  -H "Content-Type: application/json" \
  -d '{
    "deviceFingerprint": "abc123...",
    "userId": "user-id-uuid"
  }'

# Response
{ "success": true, "message": "Device registered" }
```

### Get Daily Usage
```bash
curl -X POST http://localhost:3301/api/get-daily-usage \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user-id-uuid" }'

# Response
{ "usageCount": 2, "limitReached": false }
```

### Increment Usage (Auto-called)
```bash
curl -X POST http://localhost:3301/api/increment-usage \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user-id-uuid" }'

# Response
{ "usageCount": 3, "limitReached": true }
```

## How It Works

### Daily Usage Flow
```
1. User logs in → App calls /api/get-daily-usage
2. Gets today's count from database (resets daily at midnight)
3. User generates blueprint → /api/increment-usage called
4. Server increments count and returns current usage
5. UI shows: "2/3 energy units used today"
```

### Device Fingerprinting Flow
```
1. User clicks "Create Account" 
2. Frontend generates device fingerprint (browser+screen+timezone+etc)
3. Sends to /api/check-spam
4. Server checks if device has > 3 accounts
5. If blocked, shows error; if OK, allows signup
6. After signup, /api/register-device called
7. Server updates device→user mapping
```

### Spam Detection Rules
- Device with 1 account: ✅ Can create more
- Device with 2 accounts: ⚠️ Warning (still allowed)
- Device with 3+ accounts: 🚫 Blocked automatically

### Why Per-Device Limits?
Prevents users from:
- Creating unlimited free tier accounts
- Evading daily usage limits by signing up repeatedly
- Abusing the system while maintaining legitimacy

## Database Schema Summary

### user_daily_usage
Stores daily blueprint generation count per user

```sql
SELECT * FROM user_daily_usage WHERE user_id = 'xxx';
-- Returns: id, user_id, usage_count, usage_date, created_at, updated_at
```

### device_fingerprints
Maps devices to user accounts for spam detection

```sql
SELECT * FROM device_fingerprints WHERE device_fingerprint = 'xyz';
-- Returns: id, device_fingerprint, user_id, account_count, is_blocked, blocked_reason
```

### spam_logs
Audit trail for suspicious activity

```sql
SELECT * FROM spam_logs ORDER BY created_at DESC LIMIT 10;
-- Shows: id, device_fingerprint, action, details, created_at
```

## Next Steps

1. ✅ Add service role key to `server/.env`
2. ✅ Run migration SQL in Supabase
3. ✅ Restart server: `npm run dev`
4. ✅ Test signup flow with device tracking
5. ✅ Test daily limits (3 for free, 10 for pro)
6. ✅ Monitor server logs for tracking events

## Security Considerations

- ✅ Device fingerprints are stored locally + server-side
- ✅ Service role key only used server-side (never exposed to client)
- ✅ RLS policies enforce user isolation
- ✅ Usage can't be manipulated by client
- ✅ Device checks happen before account creation
- ✅ Failed logins don't increment usage

## Monitoring

Watch for these patterns in server logs:

```
✅ Device registered for user           → New account created
✅ Usage incremented for user           → Blueprint generated
⚠️ New account detected on device       → Multiple accounts suspected
🚫 Device has exceeded maximum accounts → Spam detected & blocked
```

Monitor in Supabase:
```
SELECT COUNT(*) as total_accounts FROM device_fingerprints;
SELECT COUNT(*) as active_users FROM user_daily_usage 
  WHERE usage_date = CURRENT_DATE;
SELECT action, COUNT(*) FROM spam_logs 
  GROUP BY action ORDER BY COUNT(*) DESC;
```

## Production Checklist

Before going live:
- [ ] Secret keys stored in environment, not in code
- [ ] Database backups configured
- [ ] Monitor spam_logs table for abuse patterns
- [ ] Set up alerts for: is_blocked = true records
- [ ] Test daily reset: users can generate again at midnight
- [ ] Test Pro tier: limits increase to 10
- [ ] Rate limiting on API endpoints (consider Cloudflare)

Your app is now protected against fraud! 🎉
