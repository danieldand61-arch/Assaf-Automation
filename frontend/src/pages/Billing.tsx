import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useApp } from '../contexts/AppContext'
import { CreditCard, Zap, TrendingUp, Rocket, Loader2, Check, ExternalLink, XCircle, RefreshCw } from 'lucide-react'
import { getApiUrl } from '../lib/api'

const API_URL = getApiUrl()

interface CreditPackage {
  id: string
  credits: number
  price: number
  label: string
  description: string
  interval?: string
}

interface SubInfo {
  package_id: string
  status: string
  credits_per_period: number
  current_period_end: string
  cancel_at_period_end: boolean
}

const PACKAGE_STYLES: Record<string, { icon: typeof Zap; gradient: string; badge?: string }> = {
  starter: { icon: Zap, gradient: 'from-blue-500 to-cyan-500' },
  growth: { icon: TrendingUp, gradient: 'from-violet-500 to-purple-600', badge: 'popular' },
  scale: { icon: Rocket, gradient: 'from-amber-500 to-orange-600' },
}

export default function Billing() {
  const { session } = useAuth()
  const { t } = useApp()
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [selectedPkg, setSelectedPkg] = useState<string>('growth')
  const [balance, setBalance] = useState<number | null>(null)
  const [creditsPerPost, setCreditsPerPost] = useState(226)
  const [creditsPerVideo, setCreditsPerVideo] = useState(1000)
  const [subscription, setSubscription] = useState<SubInfo | null>(null)
  const [hasSub, setHasSub] = useState(false)
  const [cancelingOrReactivating, setCancelingOrReactivating] = useState(false)

  const loadAll = async () => {
    try {
      const headers = { Authorization: `Bearer ${session?.access_token}` }
      const [pkgRes, balRes, subRes] = await Promise.all([
        fetch(`${API_URL}/api/billing/packages`, { headers }),
        fetch(`${API_URL}/api/credits/balance`, { headers }),
        fetch(`${API_URL}/api/billing/subscription`, { headers }),
      ])
      if (pkgRes.ok) {
        const data = await pkgRes.json()
        setPackages(data.packages || [])
        if (data.credits_per_post) setCreditsPerPost(data.credits_per_post)
        if (data.credits_per_video) setCreditsPerVideo(data.credits_per_video)
      }
      if (balRes.ok) {
        const data = await balRes.json()
        setBalance(data.balance?.credits_remaining ?? null)
      }
      if (subRes.ok) {
        const data = await subRes.json()
        setHasSub(data.has_subscription)
        setSubscription(data.subscription || null)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [session])

  // After Stripe redirect, webhook may not have fired yet — poll until subscription appears
  useEffect(() => {
    const ps = new URLSearchParams(window.location.search).get('payment')
    if (ps !== 'success') return
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      if (attempts > 10) { clearInterval(poll); return }
      try {
        const res = await fetch(`${API_URL}/api/billing/subscription`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (res.ok) {
          const d = await res.json()
          if (d.has_subscription) { clearInterval(poll); await loadAll() }
        }
      } catch {}
    }, 3000)
    return () => clearInterval(poll)
  }, [])

  const handlePurchase = async (packageId: string) => {
    setPurchasing(packageId)
    try {
      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ package_id: packageId }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.detail || t('failedToCreateCheckout'))
        return
      }
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err: any) {
      alert(err.message || t('somethingWentWrong'))
    } finally {
      setPurchasing(null)
    }
  }

  const handleCancelSub = async () => {
    if (!confirm('Cancel your subscription? You will keep access until the end of the current billing period.')) return
    setCancelingOrReactivating(true)
    try {
      const res = await fetch(`${API_URL}/api/billing/cancel-subscription`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) await loadAll()
      else alert('Failed to cancel subscription')
    } catch { alert('Network error') }
    finally { setCancelingOrReactivating(false) }
  }

  const handleReactivateSub = async () => {
    setCancelingOrReactivating(true)
    try {
      const res = await fetch(`${API_URL}/api/billing/reactivate-subscription`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) await loadAll()
      else alert('Failed to reactivate')
    } catch { alert('Network error') }
    finally { setCancelingOrReactivating(false) }
  }

  const paymentStatus = new URLSearchParams(window.location.search).get('payment')

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{hasSub ? t('buyCredits') : 'Choose Your Plan'}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{hasSub ? t('purchaseCreditsDesc') : 'Subscribe to start using JOYO'}</p>
          </div>
        </div>
      </div>

      {/* Payment Success/Cancel Banner */}
      {paymentStatus === 'success' && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-800 dark:text-green-300 text-sm">{t('paymentSuccessful')}</p>
            <p className="text-green-600 dark:text-green-400 text-xs">{t('creditsAddedToAccount')}</p>
          </div>
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <span className="text-amber-600 text-sm">!</span>
          </div>
          <p className="text-amber-700 dark:text-amber-300 text-sm">{t('paymentCancelled')}</p>
        </div>
      )}

      {/* Active Subscription Card */}
      {subscription && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Plan</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{subscription.package_id} Plan</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              subscription.cancel_at_period_end
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            }`}>
              {subscription.cancel_at_period_end ? 'Cancels at period end' : 'Active'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {subscription.credits_per_period.toLocaleString()} credits/month · Renews {new Date(subscription.current_period_end).toLocaleDateString()}
          </p>
          {subscription.cancel_at_period_end ? (
            <button onClick={handleReactivateSub} disabled={cancelingOrReactivating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-semibold hover:bg-green-100 transition-all disabled:opacity-40">
              {cancelingOrReactivating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reactivate Subscription
            </button>
          ) : (
            <button onClick={handleCancelSub} disabled={cancelingOrReactivating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-100 transition-all disabled:opacity-40">
              {cancelingOrReactivating ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Cancel Subscription
            </button>
          )}
        </div>
      )}

      {/* Current Balance */}
      {balance !== null && hasSub && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('currentBalance')}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round(balance).toLocaleString()} <span className="text-base font-normal text-gray-400">{t('creditsUnit')}</span></p>
            </div>
            <div className="text-end text-xs text-gray-400">
              <p>~{Math.floor(balance / creditsPerPost).toLocaleString()} {t('postsRemaining')}</p>
            </div>
          </div>
        </div>
      )}

      {/* No subscription banner */}
      {!hasSub && (
        <div className="mb-6 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
          <p className="text-violet-800 dark:text-violet-300 text-sm font-semibold">Subscribe to unlock all features</p>
          <p className="text-violet-600 dark:text-violet-400 text-xs mt-1">Choose a plan below to start creating content with JOYO.</p>
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {packages.map((pkg) => {
          const style = PACKAGE_STYLES[pkg.id] || PACKAGE_STYLES.starter
          const Icon = style.icon
          const approxPosts = Math.floor(pkg.credits / creditsPerPost)
          const approxVideos = Math.floor(pkg.credits / creditsPerVideo)
          const isSelected = selectedPkg === pkg.id
          const isCurrentPlan = subscription?.package_id === pkg.id && !subscription?.cancel_at_period_end

          return (
            <div
              key={pkg.id}
              onClick={() => setSelectedPkg(pkg.id)}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all hover:shadow-xl cursor-pointer ${
                isSelected
                  ? 'border-violet-400 dark:border-violet-500 shadow-lg shadow-violet-100 dark:shadow-violet-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              {style.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-500 text-white shadow-lg">
                    {t(style.badge as any)}
                  </span>
                </div>
              )}

              <div className="p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{pkg.label}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{pkg.description}</p>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">${pkg.price}</span>
                  <span className="text-sm text-gray-400 ms-1">/month</span>
                </div>

                <ul className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    {pkg.credits.toLocaleString()} credits/month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    ~{approxPosts.toLocaleString()} {t('postsLabel')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    ~{approxVideos} {t('videosLabel')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    {t('invoiceEmailed')}
                  </li>
                </ul>

                <button
                  onClick={(e) => { e.stopPropagation(); handlePurchase(pkg.id) }}
                  disabled={!!purchasing || isCurrentPlan}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    isCurrentPlan
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                      : isSelected
                        ? 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                  } disabled:opacity-40`}
                >
                  {isCurrentPlan ? (
                    <><Check size={14} /> Current Plan</>
                  ) : purchasing === pkg.id ? (
                    <><Loader2 size={16} className="animate-spin" /> {t('processing')}</>
                  ) : (
                    <><ExternalLink size={14} /> {hasSub ? 'Change Plan' : 'Subscribe'}</>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* FAQ */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t('faq')}</h3>
        <div className="space-y-4 text-sm">
          {[
            { q: 'How does the subscription work?', a: 'You get credits every month based on your plan. Credits are used for generating posts, images, videos, and AI features. Unused credits carry over.' },
            { q: t('faqHowCredits'), a: t('faqHowCreditsAnswer') },
            { q: 'Can I cancel anytime?', a: 'Yes! Cancel anytime from this page. You keep access until the end of your billing period.' },
          ].map(({ q, a }, i) => (
            <div key={i}>
              <p className="font-semibold text-gray-700 dark:text-gray-300">{q}</p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
