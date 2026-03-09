"""
Billing Router — Stripe integration for credit purchases.
Handles checkout sessions, webhooks, and credit top-ups.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import stripe
import logging
import os
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/billing", tags=["billing"])
logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://app.joyo.marketing")

stripe.api_key = STRIPE_SECRET_KEY

# Credit packages — credits, price in cents, Stripe creates prices dynamically
CREDIT_PACKAGES = {
    "starter": {"credits": 50_000, "price_cents": 2900, "label": "50K Credits", "description": "~100 posts"},
    "growth": {"credits": 100_000, "price_cents": 4900, "label": "100K Credits", "description": "~200 posts"},
    "scale": {"credits": 200_000, "price_cents": 8900, "label": "200K Credits", "description": "~400 posts"},
}


class CheckoutRequest(BaseModel):
    package_id: str  # "starter", "growth", "scale"


@router.get("/packages")
async def get_packages(current_user: dict = Depends(get_current_user)):
    """Return available credit packages."""
    return {
        "packages": [
            {
                "id": pkg_id,
                "credits": pkg["credits"],
                "price": pkg["price_cents"] / 100,
                "label": pkg["label"],
                "description": pkg["description"],
            }
            for pkg_id, pkg in CREDIT_PACKAGES.items()
        ]
    }


@router.post("/checkout")
async def create_checkout_session(
    request: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout Session for credit purchase."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    pkg = CREDIT_PACKAGES.get(request.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package")

    user_id = current_user["user_id"]
    user_email = current_user.get("email", "")

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            customer_email=user_email or None,
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": pkg["price_cents"],
                        "product_data": {
                            "name": pkg["label"],
                            "description": f"{pkg['credits']:,} credits — {pkg['description']}",
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
            invoice_creation={"enabled": True},
            success_url=f"{FRONTEND_URL}?tab=settings&payment=success",
            cancel_url=f"{FRONTEND_URL}?tab=settings&payment=cancelled",
        )

        logger.info(f"Stripe checkout created: session={session.id} user={user_id[:8]} package={request.package_id}")
        return {"url": session.url}

    except stripe.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events — adds credits after successful payment."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            import json
            event = json.loads(payload)
            logger.warning("Stripe webhook signature verification skipped (no secret configured)")
    except (ValueError, stripe.SignatureVerificationError) as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        user_id = metadata.get("user_id")
        credits_str = metadata.get("credits", "0")
        package_id = metadata.get("package_id", "")

        if not user_id:
            logger.warning("Webhook: no user_id in metadata")
            return {"ok": True}

        credits = int(credits_str)
        logger.info(f"Payment completed: user={user_id[:8]} package={package_id} credits={credits}")

        try:
            await _add_credits(user_id, credits, package_id, session.get("id", ""))
        except Exception as e:
            logger.error(f"Failed to add credits after payment: {e}", exc_info=True)

    return {"ok": True}


async def _add_credits(user_id: str, credits: int, package_id: str, session_id: str):
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
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": credits,
        "credits_spent": -credits,
        "request_metadata": {"package_id": package_id, "stripe_session": session_id},
    }).execute()

    logger.info(f"Added {credits} credits to user {user_id[:8]}")
