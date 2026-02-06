# Credits Tracking System

Complete AI usage tracking system for Joyo Marketing.

## Features

- **Automatic Tracking**: Every AI request is automatically tracked
- **Real-time Costs**: Calculate costs based on tokens and model pricing
- **Service Breakdown**: Track usage by service type (chat, ads, posts, images)
- **User Balance**: Monitor credits purchased, used, and remaining
- **Detailed History**: View every AI request with timestamps and costs
- **Statistics**: Get usage stats for 7 days, 30 days, or custom periods

## Database Tables

### `user_credits`
Stores user's credits balance.

```sql
- user_id: UUID (PK)
- total_credits_purchased: DECIMAL
- credits_used: DECIMAL
- credits_remaining: DECIMAL
- last_purchase_at: TIMESTAMPTZ
```

### `credits_usage`
Logs every AI request.

```sql
- id: UUID (PK)
- user_id: UUID
- account_id: UUID
- service_type: VARCHAR ('chat', 'google_ads', 'social_posts', 'image_generation')
- action: VARCHAR (specific action like 'chat_message', 'generate_ads_content')
- model_name: VARCHAR ('gemini-3-flash-preview', etc)
- input_tokens: INTEGER
- output_tokens: INTEGER
- total_tokens: INTEGER
- cost_per_token: DECIMAL
- credits_spent: DECIMAL
- request_metadata: JSONB
- created_at: TIMESTAMPTZ
```

## Pricing (Credits per 1M tokens)

### Gemini Models
- **gemini-3-flash-preview**: 
  - Input: $0.075 per 1M tokens
  - Output: $0.30 per 1M tokens
- **gemini-1.5-pro**: 
  - Input: $1.25 per 1M tokens
  - Output: $5.00 per 1M tokens

### Image Generation
- **imagen-3**: $0.04 per image

## API Endpoints

### GET `/api/credits/balance`
Get user's current credits balance.

**Response:**
```json
{
  "success": true,
  "balance": {
    "total_purchased": 100.0,
    "used": 2.45,
    "remaining": 97.55
  }
}
```

### GET `/api/credits/usage?days=30`
Get usage statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_spent": 2.45,
    "by_service": {
      "chat": {
        "count": 150,
        "cost": 1.20
      },
      "google_ads": {
        "count": 25,
        "cost": 0.85
      },
      "social_posts": {
        "count": 40,
        "cost": 0.40
      }
    },
    "total_requests": 215,
    "period_days": 30
  }
}
```

### GET `/api/credits/history?limit=100&offset=0&service_type=chat`
Get detailed usage history.

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": "...",
      "service_type": "chat",
      "model_name": "gemini-3-flash-preview",
      "input_tokens": 1500,
      "output_tokens": 500,
      "total_tokens": 2000,
      "credits_spent": 0.0006,
      "created_at": "2026-02-04T12:00:00Z",
      "request_metadata": {...}
    }
  ],
  "total": 100
}
```

### GET `/api/credits/summary`
Get complete summary (balance + 7-day + 30-day stats).

**Response:**
```json
{
  "success": true,
  "balance": {...},
  "usage_30_days": {...},
  "usage_7_days": {...}
}
```

## How It Works

### 1. Automatic Tracking

Every AI service call automatically tracks usage:

```python
from services.credits_tracker import track_ai_usage

# After AI request
response = model.generate_content(prompt)

# Track usage
await track_ai_usage(
    user_id=user_id,
    account_id=account_id,
    service_type="chat",
    model_name="gemini-3-flash-preview",
    input_tokens=response.usage_metadata.prompt_token_count,
    output_tokens=response.usage_metadata.candidates_token_count,
    action="chat_message",
    metadata={"chat_id": chat_id}
)
```

### 2. Cost Calculation

Costs are calculated based on model pricing:

```python
# For Gemini Flash
input_cost = (input_tokens / 1_000_000) * 0.075
output_cost = (output_tokens / 1_000_000) * 0.30
total_cost = input_cost + output_cost
```

### 3. Balance Update

A PostgreSQL trigger automatically updates user balance after each usage:

```sql
CREATE TRIGGER trigger_update_credits_balance
    AFTER INSERT ON credits_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_user_credits_balance();
```

## Usage in Code

### Track AI Usage

```python
from services.credits_tracker import CreditsTracker

tracker = CreditsTracker(user_id, account_id)

# Track usage
result = await tracker.track_usage(
    service_type="google_ads",
    model_name="gemini-3-flash-preview",
    input_tokens=3000,
    output_tokens=1000,
    action="generate_ads",
    metadata={"keywords": "coffee shop"}
)

# Result: {"success": True, "credits_spent": 0.0012, "usage_id": "..."}
```

### Get User Balance

```python
tracker = CreditsTracker(user_id)
balance = await tracker.get_user_balance()

# balance: {"total_purchased": 100, "used": 2.45, "remaining": 97.55}
```

### Get Usage Stats

```python
tracker = CreditsTracker(user_id)
stats = await tracker.get_usage_stats(days=30)

# stats: {"total_spent": 2.45, "by_service": {...}, "total_requests": 215}
```

## Services with Tracking

### ✅ AI Chat
- **Service Type**: `chat`
- **Action**: `chat_message`
- **Location**: `routers/chats.py`

### ✅ Google Ads Generation
- **Service Type**: `google_ads`
- **Action**: `generate_ads_content`
- **Location**: `services/google_ads_generator.py`

### ✅ Social Posts Generation
- **Service Type**: `social_posts`
- **Action**: `generate_posts`
- **Location**: `services/content_generator.py`

### 🔄 Image Generation (TODO)
- **Service Type**: `image_generation`
- **Action**: `generate_image`
- **Location**: `services/image_generator.py`

## UI Components

### Credits Usage Page
**Location**: `frontend/src/pages/CreditsUsage.tsx`

**Features**:
- Balance card with progress bar
- 7-day usage breakdown
- 30-day usage breakdown
- Service-wise cost analysis
- Request counts

**Access**: Settings → Credits Usage tab

## Database Migration

Run the migration to create tables:

```bash
# Connect to Supabase SQL Editor
# Paste contents of: database/migrations/create_credits_system.sql
# Execute
```

## Testing

### Test Tracking

```python
# Send a chat message
# Check credits_usage table for new entry
# Verify user_credits balance updated
```

### Test API

```bash
# Get balance
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/credits/balance

# Get usage
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/credits/usage?days=7
```

## Monitoring

- Monitor `credits_usage` table for all AI requests
- Check `user_credits` for balance issues
- Review costs by service type to optimize AI usage
- Alert users when credits are low

## Future Enhancements

- [ ] Add image generation tracking
- [ ] Credit purchase flow (Stripe integration)
- [ ] Usage alerts (email when low on credits)
- [ ] Cost optimization suggestions
- [ ] Monthly reports
- [ ] Team-level tracking
- [ ] Budget limits per user/account
