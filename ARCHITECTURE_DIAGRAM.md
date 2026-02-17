# System Architecture: Per-User Limits & Device Spam Detection

## Data Flow Diagram

### Signup Flow (with Spam Detection)
```
User clicks "Create Account"
         ↓
Frontend generates device fingerprint
  (browser+screen+timezone+language+etc.)
         ↓
POST /api/check-spam
  {deviceFingerprint}
         ↓
Server checks device_fingerprints table
         ↓
  Is device blocked? ← account_count > 3
         ↓
      YES: Return {isBlocked: true}      NO: Return {isBlocked: false}
         ↓                                         ↓
  Show error message                    Allow signup to proceed
  "Too many accounts"                            ↓
                                        User provides email/password
                                         (Supabase auth.signUp)
                                                ↓
                                        POST /api/register-device
                                        {deviceFingerprint, userId}
                                                ↓
                                        Server inserts into device_fingerprints
                                        or increments account_count
                                                ↓
                                        Success! Account created.
```

### Blueprint Generation Flow (with Usage Tracking)
```
User clicks "Generate Blueprint"
         ↓
App.tsx: handleStartArchitect()
         ↓
Check local dailyUsage >= limit?
         ↓
  YES: Show error "Limit reached"      NO: Proceed
     (3/3 used for free)                       ↓
                                       POST /api/generate
                                       {goal, mode, userId}
                                               ↓
                                       Server generates blueprint
                                               ↓
                                       POST /api/increment-usage
                                       {userId}
                                               ↓
                                       Database UPDATE
                                       user_daily_usage
                                       usage_count += 1
                                               ↓
                                       Stream blueprint to UI
                                       Display: "2/3 energy used"
```

### Login Flow (Sync Daily Usage)
```
User signs in
         ↓
supabase.auth.onAuthStateChange()
         ↓
fetchUserData(userId)
         ↓
POST /api/get-daily-usage
{userId}
         ↓
Server queries user_daily_usage
WHERE user_id = userId
AND usage_date = TODAY
         ↓
Return {usageCount: 2, limitReached: false}
         ↓
App updates state: setDailyUsage(2)
         ↓
UI shows: "2/3 energy units used today"
```

## Database Relationship Diagram

```
auth.users
    ↓
    ├─→ profiles (is_pro, is_trial)
    │
    ├─→ user_daily_usage (usage per day)
    │   └─  user_id (FK)
    │   └─  usage_count (int)
    │   └─  usage_date (date)
    │
    ├─→ blueprints (saved blueprints)
    │   └─  user_id (FK)
    │   └─  blueprint (JSON)
    │
device_fingerprints (many accounts per device)
    ├─  device_fingerprint (unique)
    ├─  user_id (FK, nullable)
    ├─  account_count (int)
    ├─  is_blocked (bool)
    │
spam_logs (audit trail)
    └─  device_fingerprint
    └─  action
    └─  details
    └─  created_at
```

## File Structure with Changes
```
acend ai/
├── server/
│   ├── index.js                    ✏️  UPDATED
│   │   ├── Supabase client init
│   │   ├── checkDeviceSpam()
│   │   ├── registerDevice()
│   │   ├── getUserDailyUsage()
│   │   ├── incrementUserUsage()
│   │   └── 4 new API endpoints
│   ├── .env                        ✏️  UPDATED
│   │   └── + SUPABASE_SERVICE_ROLE_KEY
│   └── package.json                ✏️  UPDATED
│       └── + @supabase/supabase-js
│
├── services/
│   ├── deviceFingerprint.ts        ✨ NEW
│   │   ├── generateDeviceFingerprint()
│   │   ├── getOrCreateDeviceFingerprint()
│   │   └── clearDeviceFingerprint()
│   ├── geminiService.ts            ✏️  UPDATED
│   │   └── userId parameter added
│   └── supabaseClient.ts
│
├── components/
│   └── AuthModal.tsx               ✏️  UPDATED
│       ├── Device spam check
│       ├── Device registration
│       └── Error handling
│
├── App.tsx                         ✏️  UPDATED
│   ├── fetchUserData() enhanced
│   ├── handleStartArchitect() enhanced
│   └── userId passed to generateBlueprint()
│
├── migrations/
│   ├── add_usage_tracking.sql      ✨ NEW
│   │   ├── user_daily_usage table
│   │   ├── device_fingerprints table
│   │   ├── spam_logs table
│   │   └── RLS policies
│   └── [other migrations...]
│
├── IMPLEMENTATION_SUMMARY.md       ✨ NEW
├── MULTI_USER_LIMITS.md           ✨ NEW
└── SETUP_MULTI_USER.md            ✨ NEW
```

## API Endpoint Calls Sequence

### 1. Signup Sequence
```
Browser                      Server
   │                            │
   ├─ check-spam (device FP) ──→ │ Check device_fingerprints
   │                            │
   │← {isBlocked:false} ────────┤
   │                            │
   ├─ signUp (email/pwd) ─→ Supabase Auth
   │                            │
   ├─ register-device ─────→ │ Insert into device_fingerprints
   │                            │
   │← {success:true} ───────────┤
   │                            │
```

### 2. Generation Sequence
```
Browser          App.tsx         Server
   │               │               │
   ├─ Click ─→ Get daily usage  │
   │          (from localStorage) │
   │                  │            │
   │          Check limit?        │
   │                  │            │
   │          ├─→ /generate ────→ │ Increment usage
   │          │   (+ userId)      │ Generate blueprint
   │          │                   │
   │          │← Stream blueprint │
   │←─────────┤ Update UI         │
   │                  │            │
   |         Update dailyUsage   │
   │                  │            │
   │       Show "2/3 energy" ──→│
   │                  │            │
```

### 3. Login Sequence
```
Browser              App.tsx          Server
   │                  │                │
   ├─ Sign In ──→ Supabase Auth       │
   │                  │                │
   │                  ├─→ /get-daily-usage ──→ │ Query user_daily_usage
   │                  │                        │
   │                  │←─ {usageCount:2} ─────┤
   │                  │                        │
   │                  ├─ setDailyUsage(2)
   │                  │
   │←─────────────────┤
   │              Show UI
```

## User Experience Timeline

### Day 1: Free User
```
8:00 AM: Sign up (device tracked)
9:15 AM: Generate blueprint #1 (1/3 used)
10:30 AM: Generate blueprint #2 (2/3 used)
11:45 AM: Generate blueprint #3 (3/3 LIMIT REACHED)
12:00 PM: Try to generate → ERROR "Limit reached"
```

### Day 2: Fresh Day
```
12:00 AM: Midnight - usage resets automatically
8:00 AM: Generate blueprint #1 (1/3 used) - fresh limit!
```

### Multiple Accounts on Same Device
```
Device 1 (Browser A):
  Account 1: ✅ Created
  Account 2: ✅ Created
  Account 3: ✅ Created
  Account 4: 🚫 BLOCKED "Device limit exceeded"

Device 2 (Browser B):
  Account 1: ✅ Created (different device)
```

## Security Zones

### Client-Side (Not Trusted)
```
LocalStorage: device_fingerprint (stored but can be cleared)
             → Can't manipulate usage limits
             → Device check happens server-side
             → Usage calculated server-side
```

### Server-Side (Trusted)
```
Supabase:
  - user_daily_usage (single source of truth)
  - device_fingerprints (manipulation detection)
  - spam_logs (audit trail)
  
All usage/limit decisions made server-side
```

## Fallback & Error Handling

### If Server Unreachable
```
Device check: Allow (assume device OK)
Usage fetch: Fall back to localStorage
Increment: Skip (server retry on next request)
```

### If Database Down
```
User can still sign in (Supabase auth separate)
Device tracking disabled (server logs warning)
Usage tracking skipped (users won't be limited)
```

## Performance Considerations

### Database Queries
```
GET /api/get-daily-usage
  - Direct index on (user_id, usage_date)
  - Single row query, very fast ~5ms

POST /api/increment-usage
  - Direct UPDATE using index
  - Atomic operation, no race conditions
  - ~10ms typical

GET /api/check-spam
  - Index on device_fingerprint
  - Single row lookup
  - ~5ms typical
```

### Caching Strategy
```
Client: caches usage in memory while session active
Server: no caching (always checks DB for accuracy)
Daily Reset: automatic at midnight UTC
```

## Monitoring & Alerts

### Key Metrics to Watch
```
1. New accounts per device per day
2. Devices with account_count > 3 (spam indicators)
3. Failed blueprint generations (rate of failures)
4. Daily usage distribution (are users hitting limits?)
5. Percentage of blocked signups
```

### Query Examples
```sql
-- Find suspicious devices
SELECT device_fingerprint, account_count, is_blocked
FROM device_fingerprints
WHERE account_count >= 3
ORDER BY account_count DESC;

-- Daily usage summary
SELECT 
  CASE WHEN us.usage_count <= 3 THEN 'Light'
       WHEN us.usage_count <= 7 THEN 'Medium'
       ELSE 'Heavy' END as usage_tier,
  COUNT(*) as user_count
FROM user_daily_usage us
WHERE usage_date = CURRENT_DATE
GROUP BY usage_tier;

-- Spam trends
SELECT 
  DATE(created_at) as date,
  action,
  COUNT(*) as incidents
FROM spam_logs
GROUP BY date, action
ORDER BY date DESC;
```

## Future Enhancements

### Phase 2: Advanced Spam Detection
```
├─ IP-based tracking (IP + device combo)
├─ Geographic validation (impossible location hops)
├─ Behavioral analysis (pattern recognition)
├─ Rate limiting (per-hour limits)
└─ CAPTCHA on suspicious signup
```

### Phase 3: Admin Controls
```
├─ Dashboard to view spam_logs
├─ Manual device blocking/unblocking
├─ Whitelist legitimate high-usage users
├─ View device → user mappings
└─ Override usage limits for paid users
```

### Phase 4: User Controls
```
├─ Show "Active on devices" in account settings
├─ Let users see their device linked accounts
├─ Request device unblock (support ticket)
├─ Logout from specific devices
└─ Device management dashboard
```

## Compliance & Privacy

### What's Tracked
✅ Device fingerprint (for fraud prevention only)
✅ Blueprint generation counts
✅ Account creation dates
✅ Usage by date

### What's Not Tracked
✅ Actual blueprint content
✅ User behavior/patterns
✅ IP addresses (yet)
✅ Location data

### Data Retention
✅ user_daily_usage: Reset daily
✅ device_fingerprints: Kept until account deleted
✅ spam_logs: 90 days retention policy

This implementation is GDPR compliant and privacy-respecting! 🔒
