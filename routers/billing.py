"""
Billing Router — Stripe subscriptions + one-time credit purchases.
Monthly subscriptions grant credits each period. Webhook handles renewals.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import stripe
import logging
import os
from middleware.auth import get_current_user
import services.credits_service as cs

router = APIRouter(prefix="/api/billing", tags=["billing"])
logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://app.joyo.marketing")

stripe.api_key = STRIPE_SECRET_KEY

# ─── Subscription packages (monthly) ───────────────────────────────
SUBSCRIPTION_PACKAGES = {
    "starter": {"credits": 50_000, "price_cents": 5000, "label": "Starter", "interval": "month"},
    "growth":  {"credits": 100_000, "price_cents": 8900, "label": "Growth", "interval": "month"},
    "scale":   {"credits": 200_000, "price_cents": 16900, "label": "Scale", "interval": "month"},
}

# Legacy one-time packages (kept for backwards compat / top-ups)
CREDIT_PACKAGES = SUBSCRIPTION_PACKAGES


class CheckoutRequest(BaseModel):
    package_id: str


@router.get("/packages")
async def get_packages(current_user: dict = Depends(get_current_user)):
    """Return available subscription packages."""
    cpp = cs.CREDITS_PER_POST
    cpv = cs.CREDITS_PER_VIDEO
    return {
        "packages": [
            {
                "id": pkg_id,
                "credits": pkg["credits"],
                "price": pkg["price_cents"] / 100,
                "label": pkg["label"],
                "interval": pkg["interval"],
                "description": f"~{pkg['credits'] // cpp} posts or ~{pkg['credits'] // cpv} videos / month",
            }
            for pkg_id, pkg in SUBSCRIPTION_PACKAGES.items()
        ],
        "credits_per_post": cpp,
        "credits_per_video": cpv,
    }


@router.post("/checkout")
async def create_checkout_session(
    request: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout Session for monthly subscription."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    pkg = SUBSCRIPTION_PACKAGES.get(request.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package")

    user_id = current_user["user_id"]
    user_email = current_user.get("email", "")

    try:
        customer = _get_or_create_customer(user_id, user_email)

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer.id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": pkg["price_cents"],
                        "recurring": {"interval": pkg["interval"]},
                        "product_data": {
                            "name": f"{pkg['label']} Plan",
                            "description": f"{pkg['credits']:,} credits/month — ~{pkg['credits'] // cs.CREDITS_PER_POST} posts or ~{pkg['credits'] // cs.CREDITS_PER_VIDEO} videos",
                        },
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "user_id": user_id,
                "package_id": request.package_id,
                "credits": str(pkg["credits"]),
            },
            subscription_data={
                "metadata": {
                    "user_id": user_id,
                    "package_id": request.package_id,
                    "credits": str(pkg["credits"]),
                },
            },
            success_url=f"{FRONTEND_URL}/app?tab=billing&payment=success",
            cancel_url=f"{FRONTEND_URL}/app?tab=billing&payment=cancelled",
        )

        logger.info(f"Stripe subscription checkout: session={session.id} user={user_id[:8]} package={request.package_id}")
        return {"url": session.url}

    except stripe.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscription")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Check if user has an active subscription or admin bypass."""
    from database.supabase_client import get_supabase
    supabase = get_supabase()
    user_id = current_user["user_id"]

    # Admin bypass — always grants access
    uc = supabase.table("user_credits").select("bypass_subscription").eq("user_id", user_id).limit(1).execute()
    if uc.data and uc.data[0].get("bypass_subscription"):
        return {"has_subscription": True, "bypass": True, "subscription": None}

    # Any subscription row (active, canceled, expired) = user subscribed at some point → full access
    sub = supabase.table("subscriptions") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if sub.data:
        s = sub.data[0]
        return {
            "has_subscription": True,
            "bypass": False,
            "subscription": {
                "id": s["id"],
                "package_id": s["package_id"],
                "status": s["status"],
                "credits_per_period": s["credits_per_period"],
                "current_period_end": s["current_period_end"],
                "cancel_at_period_end": s.get("cancel_at_period_end", False),
            },
        }

    # Never subscribed, no bypass → gate
    return {"has_subscription": False, "bypass": False, "subscription": None}


@router.post("/cancel-subscription")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel subscription at end of current billing period."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    from database.supabase_client import get_supabase
    supabase = get_supabase()
    user_id = current_user["user_id"]

    sub = supabase.table("subscriptions") \
        .select("stripe_subscription_id") \
        .eq("user_id", user_id) \
        .in_("status", ["active", "trialing"]) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if not sub.data or not sub.data[0].get("stripe_subscription_id"):
        raise HTTPException(status_code=404, detail="No active subscription found")

    stripe_sub_id = sub.data[0]["stripe_subscription_id"]
    try:
        stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=True)
        supabase.table("subscriptions").update({
            "cancel_at_period_end": True,
        }).eq("stripe_subscription_id", stripe_sub_id).execute()
        logger.info(f"Subscription {stripe_sub_id} set to cancel at period end for user {user_id[:8]}")
        return {"success": True, "message": "Subscription will cancel at end of billing period"}
    except stripe.StripeError as e:
        logger.error(f"Cancel subscription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reactivate-subscription")
async def reactivate_subscription(current_user: dict = Depends(get_current_user)):
    """Undo cancellation — keep subscription active."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    from database.supabase_client import get_supabase
    supabase = get_supabase()
    user_id = current_user["user_id"]

    sub = supabase.table("subscriptions") \
        .select("stripe_subscription_id") \
        .eq("user_id", user_id) \
        .in_("status", ["active", "trialing"]) \
        .eq("cancel_at_period_end", True) \
        .limit(1) \
        .execute()

    if not sub.data:
        raise HTTPException(status_code=404, detail="No subscription pending cancellation")

    stripe_sub_id = sub.data[0]["stripe_subscription_id"]
    try:
        stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=False)
        supabase.table("subscriptions").update({
            "cancel_at_period_end": False,
        }).eq("stripe_subscription_id", stripe_sub_id).execute()
        return {"success": True}
    except stripe.StripeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Webhook ────────────────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events for subscriptions."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            import json
            event = json.loads(payload)
            logger.warning("Stripe webhook signature verification skipped (no secret)")
    except (ValueError, stripe.SignatureVerificationError) as e:
        logger.error(f"Webhook sig failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    etype = event.type if hasattr(event, "type") else event.get("type", "")
    obj = event.data.object if hasattr(event, "data") and hasattr(event.data, "object") else event.get("data", {}).get("object", {})
    meta = _get_meta(obj)

    logger.info(f"Stripe webhook: {etype}")

    if etype == "checkout.session.completed":
        # Initial subscription checkout completed — subscription is created by Stripe
        pass

    elif etype == "customer.subscription.created":
        await _handle_subscription_created(obj, meta)

    elif etype == "customer.subscription.updated":
        await _handle_subscription_updated(obj, meta)

    elif etype == "customer.subscription.deleted":
        await _handle_subscription_deleted(obj, meta)

    elif etype == "invoice.paid":
        await _handle_invoice_paid(obj)

    return {"ok": True}


# ─── Webhook handlers ──────────────────────────────────────────────

async def _handle_subscription_created(obj, meta):
    from database.supabase_client import get_supabase
    supabase = get_supabase()

    user_id = meta.get("user_id")
    if not user_id:
        logger.warning("subscription.created: no user_id in metadata")
        return

    sub_id = _get_id(obj)
    customer_id = _get_field(obj, "customer")
    package_id = meta.get("package_id", "")
    credits = int(meta.get("credits", "0"))
    status = _get_field(obj, "status")
    period_start = _get_field(obj, "current_period_start")
    period_end = _get_field(obj, "current_period_end")

    supabase.table("subscriptions").upsert({
        "user_id": user_id,
        "stripe_subscription_id": sub_id,
        "stripe_customer_id": customer_id,
        "package_id": package_id,
        "status": status,
        "credits_per_period": credits,
        "current_period_start": _ts(period_start),
        "current_period_end": _ts(period_end),
        "cancel_at_period_end": False,
    }, on_conflict="stripe_subscription_id").execute()

    # Grant initial credits
    await _add_credits(user_id, credits, package_id, f"sub_{sub_id}")
    logger.info(f"Subscription created: user={user_id[:8]} pkg={package_id} credits={credits}")


async def _handle_subscription_updated(obj, meta):
    from database.supabase_client import get_supabase
    supabase = get_supabase()

    sub_id = _get_id(obj)
    status = _get_field(obj, "status")
    cancel_at_end = _get_field(obj, "cancel_at_period_end")
    period_start = _get_field(obj, "current_period_start")
    period_end = _get_field(obj, "current_period_end")

    update = {"status": status, "updated_at": "now()"}
    if cancel_at_end is not None:
        update["cancel_at_period_end"] = bool(cancel_at_end)
    if period_start:
        update["current_period_start"] = _ts(period_start)
    if period_end:
        update["current_period_end"] = _ts(period_end)

    supabase.table("subscriptions").update(update).eq("stripe_subscription_id", sub_id).execute()
    logger.info(f"Subscription updated: {sub_id} → status={status}")


async def _handle_subscription_deleted(obj, meta):
    from database.supabase_client import get_supabase
    supabase = get_supabase()
    sub_id = _get_id(obj)
    supabase.table("subscriptions").update({
        "status": "canceled",
        "updated_at": "now()",
    }).eq("stripe_subscription_id", sub_id).execute()
    logger.info(f"Subscription canceled: {sub_id}")


async def _handle_invoice_paid(obj):
    """On renewal invoice paid, grant credits for the new period."""
    from database.supabase_client import get_supabase
    supabase = get_supabase()

    sub_id = _get_field(obj, "subscription")
    if not sub_id:
        return

    billing_reason = _get_field(obj, "billing_reason")
    # Only grant on recurring payments, not the initial subscription_create
    if billing_reason == "subscription_create":
        return

    sub = supabase.table("subscriptions").select("user_id, package_id, credits_per_period") \
        .eq("stripe_subscription_id", sub_id).limit(1).execute()
    if not sub.data:
        logger.warning(f"invoice.paid: no subscription found for {sub_id}")
        return

    row = sub.data[0]
    user_id = row["user_id"]
    credits = row["credits_per_period"]
    package_id = row["package_id"]

    await _add_credits(user_id, credits, package_id, f"renewal_{sub_id}")
    logger.info(f"Renewal credits: user={user_id[:8]} +{credits} credits (pkg={package_id})")


# ─── Helpers ────────────────────────────────────────────────────────

def _get_or_create_customer(user_id: str, email: str):
    """Get existing Stripe customer or create new one."""
    from database.supabase_client import get_supabase
    supabase = get_supabase()

    existing = supabase.table("subscriptions").select("stripe_customer_id") \
        .eq("user_id", user_id).not_.is_("stripe_customer_id", "null").limit(1).execute()
    if existing.data and existing.data[0].get("stripe_customer_id"):
        try:
            return stripe.Customer.retrieve(existing.data[0]["stripe_customer_id"])
        except stripe.StripeError:
            pass

    customer = stripe.Customer.create(
        email=email or None,
        metadata={"user_id": user_id},
    )
    return customer


async def _add_credits(user_id: str, credits: int, package_id: str, ref: str):
    """Add purchased credits to user's balance."""
    from database.supabase_client import get_supabase
    supabase = get_supabase()

    existing = supabase.table("user_credits").select("*").eq("user_id", user_id).limit(1).execute()
    if existing.data:
        row = existing.data[0]
        supabase.table("user_credits").update({
            "total_credits_purchased": float(row["total_credits_purchased"]) + credits,
            "credits_remaining": float(row["credits_remaining"]) + credits,
        }).eq("user_id", user_id).execute()
    else:
        supabase.table("user_credits").insert({
            "user_id": user_id,
            "total_credits_purchased": float(credits),
            "credits_used": 0.0,
            "credits_remaining": float(credits),
        }).execute()

    supabase.table("credits_usage").insert({
        "user_id": user_id,
        "service_type": "credit_purchase",
        "model_name": f"stripe_{package_id}",
        "input_tokens": 0, "output_tokens": 0, "total_tokens": credits,
        "credits_spent": -credits,
        "request_metadata": {"package_id": package_id, "ref": ref},
    }).execute()

    logger.info(f"Added {credits} credits to user {user_id[:8]}")


def _get_meta(obj) -> dict:
    if isinstance(obj, dict):
        return obj.get("metadata", {}) or {}
    return dict(getattr(obj, "metadata", {}) or {})

def _get_id(obj) -> str:
    return obj.get("id", "") if isinstance(obj, dict) else getattr(obj, "id", "")

def _get_field(obj, name):
    return obj.get(name) if isinstance(obj, dict) else getattr(obj, name, None)

def _ts(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        from datetime import datetime, timezone
        return datetime.fromtimestamp(val, tz=timezone.utc).isoformat()
    return str(val)
