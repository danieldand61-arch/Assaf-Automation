# Google Ads OAuth Setup - Automatic Connection

This guide shows how to setup OAuth 2.0 for automatic Google Ads connection (Sign in with Google).

## ⚡ What Changed

**Before:** Users had to manually get Refresh Token via OAuth Playground  
**After:** One-click "Sign in with Google" → automatic connection

## 🔧 Backend Setup (Environment Variables)

Add these to your `.env` file:

```bash
# Google Ads OAuth Credentials
GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_REDIRECT_URI=http://localhost:5173/auth/google-ads/callback
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token

# URLs for callbacks
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
```

## 📋 Step-by-Step OAuth Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable **Google Ads API**:
   - "APIs & Services" → "Library"
   - Search "Google Ads API"
   - Click "Enable"

### 2. Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select **External** user type
3. Fill in app information:
   - App name: "Your App Name"
   - User support email: your@email.com
   - Developer contact: your@email.com
4. Add scopes:
   ```
   https://www.googleapis.com/auth/adwords
   ```
5. Add test users (your Gmail addresses)
6. Save and continue

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: "Google Ads Connection"
5. **Authorized redirect URIs** (IMPORTANT):
   ```
   http://localhost:5173/auth/google-ads/callback
   https://your-domain.com/auth/google-ads/callback
   ```
6. Click "Create"
7. Copy:
   - **Client ID** → `GOOGLE_ADS_CLIENT_ID`
   - **Client Secret** → `GOOGLE_ADS_CLIENT_SECRET`

### 4. Get Developer Token

1. Go to [Google Ads](https://ads.google.com/)
2. Tools & Settings → Setup → API Center
3. Apply for access (Basic or Standard)
4. Copy **Developer Token** → `GOOGLE_ADS_DEVELOPER_TOKEN`

### 5. Update Environment Variables

**Backend (`.env`):**
```bash
GOOGLE_ADS_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=abc123xyz
GOOGLE_ADS_REDIRECT_URI=http://localhost:5173/auth/google-ads/callback
GOOGLE_ADS_DEVELOPER_TOKEN=XXXXXX-XXXXX-XXXXXX
FRONTEND_URL=http://localhost:5173
```

**Production:**
Update redirect URI to your production domain:
```bash
GOOGLE_ADS_REDIRECT_URI=https://your-domain.com/auth/google-ads/callback
```

## 🚀 How It Works

### User Flow:

1. **User clicks "Sign in with Google"** in Settings
2. **Opens Google OAuth** consent screen
3. **User grants access** to Google Ads
4. **Redirects back** with authorization code
5. **Backend exchanges** code for refresh token
6. **Modal opens** asking for Customer ID
7. **Connection complete** ✅

### Technical Flow:

```
Frontend                Backend                 Google
   |                       |                       |
   | 1. GET /oauth/authorize                      |
   |--------------------->|                       |
   |                      |                       |
   | 2. auth_url          |                       |
   |<---------------------|                       |
   |                      |                       |
   | 3. Redirect to Google OAuth                 |
   |------------------------------------------>|
   |                      |                       |
   |                      |    4. User approves   |
   |                      |<----------------------|
   |                      |                       |
   | 5. Callback with code                       |
   |--------------------->|                       |
   |                      |                       |
   |                      | 6. Exchange code for tokens
   |                      |--------------------->|
   |                      |                       |
   |                      | 7. refresh_token      |
   |                      |<---------------------|
   |                      |                       |
   | 8. Redirect with token                      |
   |<---------------------|                       |
   |                      |                       |
   | 9. Modal: Enter Customer ID                 |
   |                      |                       |
   | 10. POST /oauth/complete                    |
   |--------------------->|                       |
   |                      |                       |
   | 11. Connection saved |                       |
   |<---------------------|                       |
```

## 🎯 API Endpoints

### 1. Start OAuth Flow
```
GET /api/google-ads/oauth/authorize
Authorization: Bearer {token}

Response:
{
  "auth_url": "https://accounts.google.com/o/oauth2/auth?...",
  "redirect_uri": "http://localhost:5173/auth/google-ads/callback"
}
```

### 2. OAuth Callback (Automatic)
```
GET /api/google-ads/oauth/callback?code={code}&state={user_id}

→ Exchanges code for refresh_token
→ Redirects to frontend with token
```

### 3. Complete Connection
```
POST /api/google-ads/oauth/complete
Authorization: Bearer {token}
Content-Type: application/json

{
  "refresh_token": "1//0abc123...",
  "customer_id": "1234567890"
}

Response:
{
  "success": true,
  "customer_id": "1234567890",
  "campaigns_count": 15,
  "message": "Google Ads account connected successfully"
}
```

## 🔒 Security

- ✅ OAuth 2.0 with PKCE (secure flow)
- ✅ Refresh tokens stored encrypted in database
- ✅ No passwords stored
- ✅ User can revoke access anytime via Google Account settings
- ✅ Tokens auto-refresh when expired

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URI in Google Cloud doesn't match `.env`  
**Solution:** 
1. Check `GOOGLE_ADS_REDIRECT_URI` in `.env`
2. Verify it's added in Google Cloud Console
3. Must match exactly (including http/https)

### Error: "invalid_client"
**Cause:** Wrong Client ID or Secret  
**Solution:** 
1. Re-copy from Google Cloud Console
2. Check for extra spaces in `.env`

### Error: "access_denied"
**Cause:** User denied access  
**Solution:** User needs to approve OAuth consent

### Error: "No refresh token received"
**Cause:** OAuth was already approved before  
**Solution:** 
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Remove your app
3. Try connecting again (will ask for consent again)

### Frontend shows "No token"
**Cause:** Backend callback failed  
**Solution:** 
1. Check backend logs
2. Verify `GOOGLE_ADS_CLIENT_SECRET` is correct
3. Ensure backend is running on correct URL

## 📝 Testing

### Local Testing:

1. Start backend: `python main.py` (port 5000)
2. Start frontend: `cd frontend && npm run dev` (port 5173)
3. Go to Settings → Social Media
4. Click "Sign in with Google" for Google Ads
5. Grant access
6. Enter Customer ID
7. Check connection status

### Production:

1. Update `.env` with production URLs
2. Add production redirect URI to Google Cloud Console
3. Deploy backend and frontend
4. Test OAuth flow end-to-end

## 🎉 Benefits

- ✅ **Easier:** One click vs manual token copy
- ✅ **Faster:** 30 seconds vs 5 minutes
- ✅ **Safer:** No manual token handling
- ✅ **Better UX:** Familiar "Sign in with Google" flow
- ✅ **Auto-refresh:** Tokens refresh automatically

## 📚 Resources

- [Google Ads API OAuth Guide](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [OAuth 2.0 Explained](https://oauth.net/2/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Ads API Center](https://ads.google.com/aw/apicenter)

## 🆘 Support

If you encounter issues:
1. Check backend logs for OAuth errors
2. Verify all environment variables are set
3. Test with a test Google account first
4. Ensure redirect URIs match exactly
