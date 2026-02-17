# 🔑 API Keys Configuration

## Overview
Your Ascend AI app now uses **3 Gemini API keys** with automatic fallback system for reliability.

## API Keys Setup

### Configuration File: `server/.env`
```env
GEMINI_API_KEY_1=AIzaSyCGlIykI9kF1uIWdCIboO7GqW16eujGlKE
GEMINI_API_KEY_2=AIzaSyBkOG75_ZXgXubdX3s08Ug5wN1XjZCIDoA
GEMINI_API_KEY_3=AIzaSyAKCnqdKNYbLlvkiBJcvBkNxsJPXR6wYE8
```

## Features Using These APIs

### 1. **Blueprint Generation** (`/api/generate`)
- ✅ Generates strategic roadmaps
- ✅ Supports 4 modes: Standard, Detailed, Rapid, Market Intel
- ✅ Uses API key fallback if one fails
- ✅ Streaming response support

### 2. **Chat Feature** (`/api/chat`) - NEW
- ✅ Strategy coaching
- ✅ Real-time conversations
- ✅ Goal achievement guidance
- ✅ Market insights
- ✅ Career advice
- ✅ Automatic API failover

## How It Works

### Load Balancing & Failover
1. Server tries **API Key 1** first
2. If fails, tries **API Key 2**
3. If fails, tries **API Key 3**
4. If all fail, uses **local fallback generator**

### Request Flow

#### Blueprint Generation:
```
User Input → Frontend → /api/generate → Try API Keys → Response Streaming
```

#### Chat Messages:
```
User Message → Frontend → /api/chat → Try API Keys → Chat Response
```

## Server Logs

When server starts, you'll see:
```
🚀 Server running on http://localhost:3301
📊 Using 3 API key(s) for Gemini
```

When a request succeeds:
```
✅ Blueprint generated successfully
✅ Chat response generated successfully
```

## Testing Your Setup

### Test Blueprint Generation:
1. Go to http://localhost:3006
2. Enter a goal and select a mode
3. Click "Architect"
4. Check server logs for success message

### Test Chat Feature:
1. Click "Chat" button
2. Sign in to app
3. Type a message
4. Send and verify response
5. Check server logs

## Fallback System

If all API keys are exhausted/invalid:
- **Blueprint**: Shows generic fallback blueprint
- **Chat**: Shows helpful suggestion message

This ensures your app never shows errors to users.

## Rate Limiting

Each API key has its own quota. The fallback system helps distribute load:
- API Key 1: Blueprint requests
- API Key 2: Chat requests (if Key 1 busy)
- API Key 3: Overflow/backup

## Environment Variables

You can also set these in production:
```bash
export GEMINI_API_KEY_1="your-key-1"
export GEMINI_API_KEY_2="your-key-2"
export GEMINI_API_KEY_3="your-key-3"
```

## Monitoring

Check `server/index.js` logs to monitor:
- Which API key is being used
- Success/failure rates
- Fallback activation count

## Troubleshooting

### Chat/Blueprint still showing errors?
1. Verify API keys in `server/.env`
2. Restart server: `npm run server`
3. Check API key validity in Google Cloud Console
4. Ensure keys have Gemini API access enabled

### Rate limit errors?
- Consider spacing out requests
- Use the fallback system effectively
- Upgrade API quotas in Google Cloud

All set! Your app now has robust API key management with 3 different keys for reliability. 🎉
