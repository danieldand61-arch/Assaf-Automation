# Google Ads API Integration Setup Guide

## 📋 Overview

This guide walks you through setting up Google Ads API integration to publish ads directly from our platform.

---

## 🎯 What You'll Be Able To Do

After setup:
- ✅ Generate Google Ads (15 headlines + 4 descriptions) with AI
- ✅ Connect your Google Ads account
- ✅ View your campaigns and ad groups
- ✅ Publish RSA ads directly (one click!)
- ✅ Add sitelink extensions automatically

---

## 🔑 Prerequisites

1. **Google Ads Account** (with active campaigns)
2. **Google Cloud Project**
3. **Manager Account (MCC)** - Recommended for API access
4. **Time**: 1-2 weeks for Google's Developer Token approval

---

## 📝 Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select Project" → "New Project"
3. Name it: "Assaf Automation Ads API"
4. Click "Create"

### Step 2: Enable Google Ads API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google Ads API"
3. Click **Enable**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure **OAuth consent screen**:
   - User Type: **External**
   - App name: "Assaf Automation"
   - User support email: your email
   - Developer contact: your email
   - Scopes: Add `https://www.googleapis.com/auth/adwords`
   - Test users: Add your email
4. Create **OAuth Client ID**:
   - Application type: **Web application**
   - Name: "Assaf Automation Web Client"
   - Authorized redirect URIs:
     ```
     http://localhost:8000/api/google-ads/oauth/callback
     https://your-production-domain.com/api/google-ads/oauth/callback
     ```
5. Click **Create**
6. **SAVE** the Client ID and Client Secret

### Step 4: Apply for Developer Token

**⚠️ IMPORTANT: This requires approval and takes 1-2 weeks**

1. Go to [Google Ads](https://ads.google.com/)
2. Navigate to **Tools & Settings** → **Setup** → **API Center**
3. Click **Apply for Access** (or view existing token)
4. Fill out the form:
   - **Account type**: Manager account (MCC) recommended
   - **Use case**: "Social media automation platform for creating and managing Google Ads campaigns"
   - **API calls per day**: ~1,000
   - **Features**: Creating RSA ads, managing campaigns
5. Submit and **wait for approval** (1-2 weeks)

**While waiting:**
- You can use a **Test Account** with limited access
- Or proceed with a Manager Account (better approval rate)

### Step 5: Get Your Customer ID

1. Go to [Google Ads](https://ads.google.com/)
2. Look at the top right corner
3. Your Customer ID is displayed (e.g., `123-456-7890`)
4. **Remove dashes**: Use as `1234567890`

---

## 🔧 Configure Application

### 1. Add to `.env` file:

```env
# Google Ads API Configuration
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token-here
GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-client-secret-here
```

### 2. Install Dependencies:

```bash
pip install google-ads==25.1.0
```

### 3. Run Database Migration:

In Supabase SQL Editor, run:
```sql
-- Execute database/google_ads_connections.sql
```

---

## 🚀 Usage

### Connect Google Ads Account

**Frontend (in Settings or Google Ads tool):**

```typescript
// User clicks "Connect Google Ads"
// OAuth flow opens in popup
// User authorizes access
// Callback returns refresh_token and customer_id

await fetch('/api/google-ads/connect', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    refresh_token: refreshToken,
    customer_id: '1234567890'
  })
})
```

### Get Campaigns

```typescript
const response = await fetch('/api/google-ads/campaigns', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})

const { campaigns } = await response.json()
// campaigns: [{ id, name, status, type }]
```

### Create RSA Ad

```typescript
await fetch('/api/google-ads/create-rsa', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ad_group_id: 123456789,
    headlines: [
      "Premium Water Damage Repair",
      "24/7 Emergency Service",
      // ... 13 more headlines
    ],
    descriptions: [
      "Expert water damage restoration with IICRC certified technicians available 24/7.",
      // ... 3 more descriptions
    ],
    final_url: "https://example.com/water-damage",
    path1: "Water-Damage",
    path2: "LA"
  })
})
```

---

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/google-ads/status` | GET | Check if account is connected |
| `/api/google-ads/connect` | POST | Connect Google Ads account |
| `/api/google-ads/campaigns` | GET | List all campaigns |
| `/api/google-ads/campaigns/{id}/ad-groups` | GET | List ad groups for campaign |
| `/api/google-ads/create-rsa` | POST | Create Responsive Search Ad |
| `/api/google-ads/add-sitelinks` | POST | Add sitelink extensions |
| `/api/google-ads/disconnect` | DELETE | Disconnect account |

---

## 🔒 Security Notes

1. **Refresh tokens are stored in database** - Consider encrypting them
2. **RSA ads are created in PAUSED status** - User must activate manually
3. **RLS policies** ensure users only see their own data
4. **Rate limiting** - Google Ads API has strict rate limits

---

## 🐛 Troubleshooting

### "Developer token not approved"
- **Solution**: Wait for Google's approval or use Test Account
- **Timeline**: 1-2 weeks

### "Customer ID not found"
- **Solution**: Remove dashes from Customer ID (`123-456-7890` → `1234567890`)

### "Insufficient permissions"
- **Solution**: Ensure OAuth scope includes `https://www.googleapis.com/auth/adwords`
- **Solution**: User must have admin access to Google Ads account

### "RSA creation failed"
- **Check**: Headlines < 30 chars, Descriptions < 90 chars
- **Check**: 3-15 headlines, 2-4 descriptions
- **Check**: No excessive punctuation or ALL CAPS

---

## ✅ Testing Checklist

- [ ] Google Cloud Project created
- [ ] Google Ads API enabled
- [ ] OAuth credentials created
- [ ] Developer Token applied for (or approved)
- [ ] Environment variables configured
- [ ] Database migration run
- [ ] Test account connected
- [ ] Can fetch campaigns
- [ ] Can create test RSA ad

---

## 📚 Resources

- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [Developer Token Guide](https://developers.google.com/google-ads/api/docs/get-started/dev-token)
- [OAuth 2.0 Setup](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [Python Client Library](https://developers.google.com/google-ads/api/docs/client-libs/python/)

---

## 🎉 Success!

Once configured, users can:
1. Generate ad copy with AI
2. Click "Publish to Google Ads"
3. Select campaign/ad group
4. One-click publish! ✨

**The ad is created in PAUSED status for safety - user reviews and activates manually in Google Ads.**
