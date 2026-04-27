"""Meta Conversions API (CAPI) endpoint.

Receives signup events from the frontend and forwards them to Meta's Graph API
with the same event_id used by the browser-side Pixel, enabling deduplication.

Required env vars:
  META_PIXEL_ID            — same Pixel ID used in frontend
  META_CAPI_ACCESS_TOKEN   — long-lived CAPI access token
  META_TEST_EVENT_CODE     — optional, only during testing (remove in prod)
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["meta-capi"])

GRAPH_VERSION = "v19.0"


class MetaCapiEvent(BaseModel):
    event_name: str
    event_id: str
    event_source_url: Optional[str] = None
    email: Optional[str] = None
    fbc: Optional[str] = None
    fbp: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None


def _sha256(s: str) -> str:
    return hashlib.sha256(s.strip().lower().encode("utf-8")).hexdigest()


def _client_ip(request: Request) -> Optional[str]:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    rip = request.headers.get("x-real-ip")
    if rip:
        return rip.strip()
    return request.client.host if request.client else None


@router.post("/meta-capi")
async def meta_capi(body: MetaCapiEvent, request: Request):
    pixel_id = os.getenv("META_PIXEL_ID")
    token = os.getenv("META_CAPI_ACCESS_TOKEN")
    test_code = os.getenv("META_TEST_EVENT_CODE")

    if not pixel_id or not token:
        logger.warning("Meta CAPI not configured (missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN)")
        return {"ok": False, "error": "capi_not_configured"}

    user_data: dict = {
        "client_user_agent": request.headers.get("user-agent"),
        "client_ip_address": _client_ip(request),
    }
    if body.email:
        user_data["em"] = [_sha256(body.email)]
    if body.fbc:
        user_data["fbc"] = body.fbc
    if body.fbp:
        user_data["fbp"] = body.fbp

    custom_data = {"currency": "USD", "value": 0}
    if body.utm_source:
        custom_data["utm_source"] = body.utm_source
    if body.utm_medium:
        custom_data["utm_medium"] = body.utm_medium
    if body.utm_campaign:
        custom_data["utm_campaign"] = body.utm_campaign

    event = {
        "event_name": body.event_name,
        "event_time": int(time.time()),
        "event_id": body.event_id,
        "event_source_url": body.event_source_url,
        "action_source": "website",
        "user_data": {k: v for k, v in user_data.items() if v},
        "custom_data": custom_data,
    }

    payload: dict = {"data": [event]}
    if test_code:
        payload["test_event_code"] = test_code

    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{pixel_id}/events"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, params={"access_token": token}, json=payload)
        if r.status_code >= 400:
            logger.error(f"Meta CAPI error {r.status_code}: {r.text}")
            return {"ok": False, "status": r.status_code, "error": r.text}
        logger.info(f"✅ Meta CAPI event sent: {body.event_name} id={body.event_id}")
        return {"ok": True, "response": r.json()}
    except Exception as e:
        logger.exception("Meta CAPI request failed")
        return {"ok": False, "error": str(e)}
