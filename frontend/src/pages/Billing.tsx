import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { CreditCard, Zap, TrendingUp, Rocket, Loader2, Check, ExternalLink } from 'lucide-react'
import { getApiUrl } from '../lib/api'

const API_URL = getApiUrl()

interface CreditPackage {
  id: string
  credits: number
  price: number
  label: string
  description: string
}

const PACKAGE_STYLES: Record<string, { icon: typeof Zap; gradient: string; badge?: string }> = {
  starter: { icon: Zap, gradient: 'from-blue-500 to-cyan-500' },
  growth: { icon: TrendingUp, gradient: 'from-violet-500 to-purple-600', badge: 'Popular' },
  scale: { icon: Rocket, gradient: 'from-amber-500 to-orange-600' },
}

export default function Billing() {
  const { session } = useAuth()
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [pkgRes, balRes] = await Promise.all([
          fetch(`${API_URL}/api/billing/packages`, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          }),
          fetch(`${API_URL}/api/credits/balance`, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          }),
        ])
        if (pkgRes.ok) {
          const data = await pkgRes.json()
          setPackages(data.packages || [])
        }
        if (balRes.ok) {
          const data = await balRes.json()
          setBalance(data.balance?.credits_remaining ?? null)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

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
        alert(err.detail || 'Failed to create checkout')
        return
      }
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err: any) {
      alert(err.message || 'Something went wrong')
    } finally {
      setPurchasing(null)
    }
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buy Credits</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Purchase credits to generate posts, videos, and more</p>
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
            <p className="font-semibold text-green-800 dark:text-green-300 text-sm">Payment successful!</p>
            <p className="text-green-600 dark:text-green-400 text-xs">Your credits have been added to your account.</p>
          </div>
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <span className="text-amber-600 text-sm">!</span>
          </div>
          <p className="text-amber-700 dark:text-amber-300 text-sm">Payment was cancelled. No charges were made.</p>
        </div>
      )}

      {/* Current Balance */}
      {balance !== null && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round(balance).toLocaleString()} <span className="text-base font-normal text-gray-400">credits</span></p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>~{Math.round(balance / 500)} posts remaining</p>
            </div>
          </div>
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {packages.map((pkg) => {
          const style = PACKAGE_STYLES[pkg.id] || PACKAGE_STYLES.starter
          const Icon = style.icon
          const pricePerPost = (pkg.price / (pkg.credits / 500)).toFixed(2)
          const isPopular = !!style.badge

          return (
            <div
              key={pkg.id}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all hover:shadow-xl ${
                isPopular
                  ? 'border-violet-400 dark:border-violet-500 shadow-lg shadow-violet-100 dark:shadow-violet-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              {style.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-500 text-white shadow-lg">
                    {style.badge}
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
                  <span className="text-sm text-gray-400 ml-1">one-time</span>
                </div>

                <ul className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    {pkg.credits.toLocaleString()} credits
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    ~${pricePerPost} per post
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-green-500" />
                    Invoice emailed automatically
                  </li>
                </ul>

                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={!!purchasing}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    isPopular
                      ? 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                  } disabled:opacity-40`}
                >
                  {purchasing === pkg.id ? (
                    <><Loader2 size={16} className="animate-spin" /> Processing...</>
                  ) : (
                    <><ExternalLink size={14} /> Buy Now</>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* FAQ */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4 text-sm">
          {[
            { q: 'How do credits work?', a: 'Credits are used for all AI operations — post generation, image creation, video generation, and AI advisor chats. Different operations cost different amounts.' },
            { q: 'Do credits expire?', a: 'No, purchased credits never expire. Use them at your own pace.' },
            { q: 'Can I get a refund?', a: 'We offer refunds for unused credits within 14 days of purchase. Contact support for assistance.' },
            { q: 'Will I get an invoice?', a: 'Yes, Stripe automatically sends an invoice/receipt to your email after each purchase.' },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="font-semibold text-gray-700 dark:text-gray-300">{q}</p>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
