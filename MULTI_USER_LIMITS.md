# Per-User Daily Limits & Device-Based Spam Detection

## Overview
Implemented a comprehensive system to:
1. **Track daily usage per user** - Each authenticated user has their own daily energy limit
2. **Detect spam account creation** - Prevents users from creating multiple accounts on the same device

## Features

### 1. Per-User Daily Usage Tracking

#### How It Works:
- **Database Table**: `user_daily_usage` stores:
  - `user_id`: The authenticated user
  - `usage_count`: Number of blueprints generated today
  - `usage_date`: Current date (resets daily)
  - Timestamps for auditing

- **Backend Endpoints**:
  - `POST /api/get-daily-usage` - Retrieves user's current daily usage
  - `POST /api/increment-usage` - Increments usage when blueprint is generated

- **Frontend Integration**:
  - Daily usage limits enforced before blueprint generation
  - Usage persisted in database (not just localStorage)
  - Server syncs usage on user login

#### Limits:
- **Free Users**: 3 blueprints/day
- **Pro/Trial Users**: 10 blueprints/day
- **Limit resets** at midnight in user's timezone

### 2. Device-Based Spam Detection

#### How It Works:
- **Device Fingerprinting**: Creates unique identifier per device based on:
  - User agent
  - Screen resolution
  - Timezone
  - Language
  - Platform
  - Hardware specs
  - Canvas fingerprint (if available)

- **Database Tables**:
  - `device_fingerprints`: Tracks fingerprint → user mapping
    - `device_fingerprint`: Unique device identifier
    - `user_id`: Associated user (null if anonymized)
    - `account_count`: Number of accounts created on device
    - `is_blocked`: Whether device is blocked
    - `blocked_reason`: Why device was blocked

  - `spam_logs`: Audit trail for suspicious activities
    - Records multiple account creation attempts
    - Stores device fingerprint + action + details

#### Spam Detection Rules:
1. **Check before signup** - `/api/check-spam` validates device
2. **Register after signup** - `/api/register-device` records account creation
3. **Auto-block at limit** - Device automatically blocked after 3+ accounts

#### User Experience:
```
Device with 1 account: ✅ Can create new account
Device with 2 accounts: ⚠️ Warning shown, still allowed
Device with 3+ accounts: 🚫 Cannot create new account
  Error: "Device has exceeded maximum allowed accounts"
```

## API Endpoints

### Check Device Spam Status
```javascript
POST /api/check-spam
Body: { deviceFingerprint: string }
Response: { isBlocked: boolean, reason: string | null }
```

### Register Device after Signup
```javascript
POST /api/register-device
Body: { deviceFingerprint: string, userId: string }
Response: { success: true, message: string }
```

### Get User's Daily Usage
```javascript
POST /api/get-daily-usage
Body: { userId: string }
Response: { usageCount: number, limitReached: boolean }
```

### Increment Usage (Auto-called after generation)
```javascript
POST /api/increment-usage
Body: { userId: string }
Response: { usageCount: number, limitReached: boolean }
```

## Code Changes

### Frontend:
1. **deviceFingerprint.ts** - New service for device identification
   - `generateDeviceFingerprint()` - Creates unique ID
   - `getOrCreateDeviceFingerprint()` - Get or create from localStorage
   - `clearDeviceFingerprint()` - Clear on logout

2. **AuthModal.tsx** - Integrated device spam detection
   - Calls `/api/check-spam` before signup
   - Calls `/api/register-device` after signup
   - Shows error if device is blocked

3. **geminiService.ts** - Pass userId for usage tracking
   - New parameter: `userId?: string`
   - Sent to `/api/generate` endpoint

4. **App.tsx** - Fetch daily usage from server
   - `fetchUserData()` now calls `/api/get-daily-usage`
   - Usage synced from database on login

### Backend:
1. **server/index.js** - Added complete spam detection system
   - Supabase client initialization
   - Device fingerprint management functions
   - 4 new API endpoints for spam/usage tracking
   - Usage increment on successful blueprint generation

2. **server/package.json** - Added dependency
   - `@supabase/supabase-js` for database access

3. **migrations/add_usage_tracking.sql**
   - Creates 3 new tables with RLS policies
   - Helper functions for usage management
   - Indices for performance

## Database Schema

### user_daily_usage
```sql
CREATE TABLE user_daily_usage (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  usage_count integer DEFAULT 0,
  usage_date date DEFAULT CURRENT_DATE,
  created_at timestamp,
  updated_at timestamp,
  UNIQUE(user_id, usage_date)
);
```

### device_fingerprints
```sql
CREATE TABLE device_fingerprints (
  id uuid PRIMARY KEY,
  device_fingerprint text UNIQUE,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  account_count integer DEFAULT 1,
  is_blocked boolean DEFAULT false,
  blocked_reason text,
  created_at timestamp,
  updated_at timestamp
);
```

### spam_logs
```sql
CREATE TABLE spam_logs (
  id uuid PRIMARY KEY,
  device_fingerprint text,
  action text,
  details jsonb,
  created_at timestamp
);
```

## Storage

### Client-Side (localStorage):
- `acend_device_fingerprint` - Unique device ID (persists across sessions)

### Server-Side (Supabase):
- User daily usage tracked per user per day
- Device fingerprints mapped to user accounts
- Spam activity logged for monitoring

## Security Features

✅ **Device fingerprinting** prevents easy account duplication
✅ **Per-user limits** ensure fair resource allocation
✅ **Automatic blocking** halts abuse at scale
✅ **Audit logs** track suspicious behavior
✅ **RLS policies** restrict data access
✅ **Daily reset** allows legitimate reuse after limit reset
✅ **Account count limit** stops coordinated abuse (3 account max/device)

## Future Enhancements

1. **IP-based tracking** - Add IP + device combo detection
2. **Behavioral analysis** - Flag unusual patterns
3. **Admin controls** - Manual device unblock/whitelist
4. **Rate limiting** - Per-hour limits in addition to daily
5. **Geographic checks** - Flag impossible location switches
6. **Phone verification** - Additional signup verification
7. **Captcha integration** - CAPTCHA on suspicious devices

## Testing the Feature

### Test Device Fingerprinting:
1. Sign up with account 1 on Device A ✅
2. Sign up with account 2 on Device A (same browser) ✅
3. Sign up with account 3 on Device A (same browser) ✅
4. Try to sign up as account 4 on Device A 🚫 Blocked!

### Test Daily Limits:
1. Sign in as Free user
2. Generate 3 blueprints → limit reached ⚠️
3. Check error message: "Daily energy limit reached (3/3)"
4. Sign up for Pro tier → limit increases to 10 ✅

### Test Server Sync:
1. Open in incognito (forces new device ID)
2. Sign in → usage loads from database
3. Generate blueprint → usage increments server-side
4. Refresh page → usage persists correctly
