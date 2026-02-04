# Google Ads API Setup Guide

This guide will help you connect your Google Ads account to the platform.

## Prerequisites

- Active Google Ads account with campaigns
- Admin access to Google Ads account
- Google Cloud Console access

## Step 1: Setup Google Ads API Access

### 1.1 Enable Google Ads API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Ads API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Ads API"
   - Click "Enable"

### 1.2 Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Configure OAuth consent screen if needed:
   - User Type: External
   - Add required scopes: `https://www.googleapis.com/auth/adwords`
4. Select Application type: **Web application**
5. Add Authorized redirect URIs:
   ```
   http://localhost
   https://your-domain.com/auth/callback
   ```
6. Save and note down:
   - **Client ID**
   - **Client Secret**

## Step 2: Get Developer Token

1. Go to [Google Ads](https://ads.google.com/)
2. Click Tools & Settings → Setup → API Center
3. Apply for Basic or Standard access
4. Copy your **Developer Token** (format: `XXXXXX-XXXXX-XXXXXX`)

> **Note:** For testing, you can use Basic access. For production, you'll need Standard access (requires Google review).

## Step 3: Generate Refresh Token

### Option A: Using OAuth Playground (Easiest)

1. Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click ⚙️ (settings icon) in top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In "Step 1", select:
   ```
   Google Ads API v15
   https://www.googleapis.com/auth/adwords
   ```
6. Click "Authorize APIs"
7. Sign in with Google account that has access to Google Ads
8. Click "Exchange authorization code for tokens"
9. Copy the **Refresh Token** (format: `1//0abc123...`)

### Option B: Using cURL

```bash
# 1. Get authorization code
# Visit this URL in browser (replace CLIENT_ID):
https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&scope=https://www.googleapis.com/auth/adwords&response_type=code&access_type=offline&prompt=consent

# 2. After authorization, you'll be redirected. Copy the 'code' from URL

# 3. Exchange code for tokens:
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost" \
  -d "grant_type=authorization_code"

# Response will contain refresh_token
```

## Step 4: Get Customer ID

1. Go to [Google Ads](https://ads.google.com/)
2. Look at top-right corner for your **Customer ID**
3. Format: `XXX-XXX-XXXX`
4. **Remove dashes**: `1234567890` (10 digits)

> **Important:** Use the Customer ID WITHOUT dashes in the platform

## Step 5: Connect in Platform

1. Go to **Settings** → **Social Media** tab
2. Find **Google Ads** card
3. Click **Connect**
4. Enter:
   - **OAuth Refresh Token**: `1//0abc123...`
   - **Customer ID**: `1234567890` (no dashes)
5. Click **Connect Google Ads**

## Environment Variables (Backend)

Make sure these are set in your `.env` file:

```bash
# Google Ads API Credentials
GOOGLE_ADS_DEVELOPER_TOKEN=XXXXXX-XXXXX-XXXXXX
GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-client-secret

# Optional: Login Customer ID (if using manager account)
GOOGLE_ADS_LOGIN_CUSTOMER_ID=1234567890
```

## Troubleshooting

### Error: "Invalid refresh token"
- **Cause:** Token expired or revoked
- **Solution:** Generate new refresh token (Step 3)

### Error: "Customer ID not found"
- **Cause:** Wrong Customer ID format
- **Solution:** 
  - Ensure 10 digits without dashes
  - Verify in Google Ads interface
  - If using manager account, use sub-account Customer ID

### Error: "Developer token not approved"
- **Cause:** Using test/basic access in production
- **Solution:** 
  - Apply for Standard access in Google Ads API Center
  - Wait for Google approval (1-2 weeks)

### Error: "Insufficient permissions"
- **Cause:** OAuth scope missing
- **Solution:** 
  - Regenerate tokens with correct scope
  - Ensure scope: `https://www.googleapis.com/auth/adwords`

### Error: "API not enabled"
- **Cause:** Google Ads API not enabled in project
- **Solution:** Enable in Google Cloud Console (Step 1.1)

## API Limits

- **Basic Access:** 15,000 operations/day
- **Standard Access:** Higher limits (after approval)

## Security Notes

- ✅ Refresh tokens are stored encrypted in database
- ✅ Never share your refresh token or developer token
- ✅ Use environment variables for backend credentials
- ✅ Regularly rotate tokens for security
- ✅ Monitor API usage in Google Cloud Console

## Next Steps

After connecting:
1. View campaigns: Dashboard → Google Ads
2. Generate RSA ads: Tools → Google Ads Generator
3. Create campaigns: Coming soon with LLM platform

## Resources

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0 Guide](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [API Center](https://ads.google.com/aw/apicenter)
- [Developer Token Guide](https://developers.google.com/google-ads/api/docs/get-started/dev-token)

## Support

If you encounter issues:
1. Check error logs in browser console
2. Verify all credentials are correct
3. Ensure API is enabled in Google Cloud
4. Contact support with error details
