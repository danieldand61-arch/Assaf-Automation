// Meta Pixel + CAPI helper
// Pixel snippet itself is injected in index.html.
// This module: captures UTM/fbclid, reads _fbc/_fbp cookies, fires StartTrial/CompleteRegistration
// on signup and forwards them to /api/meta-capi for server-side deduplication.

import { getApiUrl } from './api'

declare global {
  interface Window {
    fbq?: (...args: any[]) => void
  }
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid'] as const

export function captureUtmAndFbclid() {
  try {
    const params = new URLSearchParams(window.location.search)
    UTM_KEYS.forEach((k) => {
      const v = params.get(k)
      if (v) localStorage.setItem(k, v)
    })
  } catch {}
}

function getCookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return m ? decodeURIComponent(m[1]) : undefined
  } catch {
    return undefined
  }
}

function ls(key: string): string | undefined {
  try {
    return localStorage.getItem(key) || undefined
  } catch {
    return undefined
  }
}

function newEventId(): string {
  return `starttrial_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const FIRED_KEY = 'meta_signup_fired'

/**
 * Fires StartTrial + CompleteRegistration via Pixel and forwards to backend CAPI.
 * Idempotent: only fires once per browser (guarded by localStorage flag).
 */
export async function fireSignupEvents(email?: string) {
  try {
    if (localStorage.getItem(FIRED_KEY) === '1') return
  } catch {}

  const eventId = newEventId()
  const regEventId = `${eventId}_reg`
  const url = window.location.href

  // Browser-side Pixel
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'StartTrial', { value: 0, currency: 'USD' }, { eventID: eventId })
      window.fbq('track', 'CompleteRegistration', { value: 0, currency: 'USD' }, { eventID: regEventId })
    }
  } catch (e) {
    console.warn('fbq track failed', e)
  }

  const fbc = getCookie('_fbc')
  const fbp = getCookie('_fbp')
  const utm_source = ls('utm_source')
  const utm_medium = ls('utm_medium')
  const utm_campaign = ls('utm_campaign')

  const base = {
    email,
    fbc,
    fbp,
    utm_source,
    utm_medium,
    utm_campaign,
    event_source_url: url,
  }

  // Server-side CAPI (parallel — same event_ids → Meta dedupes)
  try {
    await Promise.all([
      fetch(`${getApiUrl()}/api/meta-capi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...base, event_name: 'StartTrial', event_id: eventId }),
      }).catch(() => {}),
      fetch(`${getApiUrl()}/api/meta-capi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...base, event_name: 'CompleteRegistration', event_id: regEventId }),
      }).catch(() => {}),
    ])
  } catch {}

  try {
    localStorage.setItem(FIRED_KEY, '1')
  } catch {}
}
