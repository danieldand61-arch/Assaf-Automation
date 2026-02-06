import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Loader2, Coins, TrendingUp, Calendar, Activity } from 'lucide-react'

interface CreditsBalance {
  total_purchased: number
  used: number
  remaining: number
}

interface UsageStats {
  total_spent: number
  by_service: {
    [key: string]: {
      count: number
      cost: number
    }
  }
  total_requests: number
  period_days: number
}

interface CreditsSummary {
  balance: CreditsBalance
  usage_30_days: UsageStats
  usage_7_days: UsageStats
}

export function CreditsUsage() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<CreditsSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSummary()
  }, [])

  const loadSummary = async () => {
    try {
      setLoading(true)
      setError('')

      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/credits/summary`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load credits summary')
      }

      const data = await response.json()
      setSummary(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load credits data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    )
  }

  if (!summary) {
    return null
  }

  const { balance, usage_30_days, usage_7_days } = summary

  // Service type labels
  const serviceLabels: { [key: string]: string } = {
    chat: 'AI Chat',
    google_ads: 'Google Ads Generation',
    social_posts: 'Social Media Posts',
    image_generation: 'Image Generation'
  }

  // Calculate percentage
  const usagePercentage = balance.total_purchased > 0
    ? (balance.used / balance.total_purchased) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Coins className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Credits Balance</h2>
              <p className="text-blue-100">Total available credits</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-sm text-blue-100 mb-1">Purchased</p>
            <p className="text-2xl font-bold">${balance.total_purchased.toFixed(2)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-sm text-blue-100 mb-1">Used</p>
            <p className="text-2xl font-bold">${balance.used.toFixed(2)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-sm text-blue-100 mb-1">Remaining</p>
            <p className="text-2xl font-bold">${balance.remaining.toFixed(2)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        {balance.total_purchased > 0 && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-blue-100">Usage</span>
              <span className="font-semibold">{usagePercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-white rounded-full h-3 transition-all"
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Usage Stats - Last 7 Days */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Last 7 Days</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {usage_7_days.total_requests} requests · ${usage_7_days.total_spent.toFixed(4)} spent
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(usage_7_days.by_service || {}).map(([service, data]) => (
            <div key={service} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {serviceLabels[service] || service}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.count} requests
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 dark:text-white">
                  ${data.cost.toFixed(4)}
                </p>
              </div>
            </div>
          ))}
          
          {Object.keys(usage_7_days.by_service || {}).length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No usage in the last 7 days
            </p>
          )}
        </div>
      </div>

      {/* Usage Stats - Last 30 Days */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Last 30 Days</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {usage_30_days.total_requests} requests · ${usage_30_days.total_spent.toFixed(4)} spent
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(usage_30_days.by_service || {}).map(([service, data]) => (
            <div key={service} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {serviceLabels[service] || service}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.count} requests
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 dark:text-white">
                  ${data.cost.toFixed(4)}
                </p>
              </div>
            </div>
          ))}
          
          {Object.keys(usage_30_days.by_service || {}).length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No usage in the last 30 days
            </p>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">About Credits</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
              <li>Credits are consumed based on AI model usage (tokens processed)</li>
              <li>Different services have different rates (chat, ads, images)</li>
              <li>Costs are calculated automatically for each request</li>
              <li>You can track detailed usage history in real-time</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
