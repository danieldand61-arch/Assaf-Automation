import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { getApiUrl } from '../lib/api'
import { useNavigate, useSearchParams } from 'react-router-dom'

interface Connection {
  id: string
  platform: string
  platform_username: string
  platform_profile_url: string
  is_connected: boolean
  last_connected_at: string
  connection_error?: string
}

interface Platform {
  id: string
  name: string
  description: string
  icon: JSX.Element
  enabled: boolean
  isAds?: boolean
}

const SOCIAL_MEDIA_PLATFORMS: Platform[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Share updates and engage with your audience on Facebook Pages',
    icon: (
      <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    enabled: true
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Publish posts and stories to your Instagram business accounts',
    icon: (
      <svg className="w-10 h-10 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    enabled: true
  },
  {
    id: 'linkedin',
    name: 'LinkedIn (Company Page)',
    description: 'Post to your company LinkedIn page',
    icon: (
      <svg className="w-10 h-10 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    enabled: true
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    description: 'Post tweets and engage with your audience on X',
    icon: (
      <svg className="w-10 h-10 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    enabled: true
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Create and share short-form videos on TikTok',
    icon: (
      <svg className="w-10 h-10 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ),
    enabled: true
  }
]

const ADVERTISING_PLATFORMS: Platform[] = [
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Create and manage Google Ads campaigns with AI-powered automation',
    icon: (
      <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.5 9.5m0 11.1c-2.4 0-4.3-2-4.3-4.4s2-4.4 4.3-4.4c1.3 0 2.4.5 3.2 1.4l.7.7-1.4 1.4-.7-.7c-.4-.4-1-.7-1.8-.7-1.5 0-2.7 1.2-2.7 2.8 0 1.5 1.2 2.8 2.7 2.8 1.1 0 1.9-.5 2.3-1.3h-2.3v-1.9h4.2l.1.6c0 .1 0 .3 0 .5 0 2.7-1.8 4.6-4.3 4.6zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
      </svg>
    ),
    enabled: true,
    isAds: true
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads (Facebook & Instagram)',
    description: 'Track campaign performance across Facebook and Instagram ads',
    icon: (
      <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    enabled: true,
    isAds: true
  }
]

export function Connections() {
  const { user, session } = useAuth()
  const { activeAccount } = useAccount()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Google Ads specific state
  const [googleAdsConnected, setGoogleAdsConnected] = useState(false)
  const [googleAdsCustomerId, setGoogleAdsCustomerId] = useState('')
  const [showGoogleAdsModal, setShowGoogleAdsModal] = useState(false)
  const [googleAdsRefreshToken, setGoogleAdsRefreshToken] = useState('')
  const [googleAdsCustomerIdInput, setGoogleAdsCustomerIdInput] = useState('')
  const [isConnectingGoogleAds, setIsConnectingGoogleAds] = useState(false)

  // Meta Ads state
  const [metaAdsConnected, setMetaAdsConnected] = useState(false)
  const [metaAdAccounts, setMetaAdAccounts] = useState<any[]>([])
  const [metaSelectedAccount, setMetaSelectedAccount] = useState<string>('')

  useEffect(() => {
    // Check for OAuth callback messages
    const success = searchParams.get('success')
    const errorParam = searchParams.get('error')
    const googleAdsOAuth = searchParams.get('google_ads_oauth')
    
    if (success) {
      setSuccessMessage(`${success.charAt(0).toUpperCase() + success.slice(1)} connected successfully!`)
      // Clear URL parameters
      window.history.replaceState({}, '', '/app?tab=integrations')
    }
    
    if (errorParam) {
      setError(errorParam)
      window.history.replaceState({}, '', '/app?tab=integrations')
    }

    // Check if OAuth completed - open modal for customer ID
    if (googleAdsOAuth === 'true') {
      const tempToken = sessionStorage.getItem('google_ads_temp_token')
      if (tempToken) {
        setGoogleAdsRefreshToken(tempToken)
        setShowGoogleAdsModal(true)
        // Clear URL parameter
        window.history.replaceState({}, '', '/settings?tab=connections')
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    
    if (!activeAccount) {
      setLoading(false)
      return
    }
    
    if (session) {
      fetchConnections()
      fetchGoogleAdsStatus()
      fetchMetaAdsStatus()
    }
  }, [user, activeAccount, session?.access_token, navigate])

  const fetchGoogleAdsStatus = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/google-ads/status`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setGoogleAdsConnected(data.connected)
        if (data.customer_id) {
          setGoogleAdsCustomerId(data.customer_id)
        }
      }
    } catch (err) {
      console.error('Failed to check Google Ads status:', err)
    }
  }

  const fetchMetaAdsStatus = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/social/connections`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      if (response.ok) {
        const data = await response.json()
        const metaConn = (data.connections || []).find((c: Connection) => c.platform === 'meta_ads')
        setMetaAdsConnected(!!metaConn?.is_connected)
      }
      // Fetch ad accounts list
      const accRes = await fetch(`${apiUrl}/api/social/meta-ads/ad-accounts`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      if (accRes.ok) {
        const accData = await accRes.json()
        setMetaAdAccounts(accData.ad_accounts || [])
        setMetaSelectedAccount(accData.selected || '')
      }
    } catch (err) { console.error('Failed to check Meta Ads status:', err) }
  }

  const startMetaAdsOAuth = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/social/meta-ads/connect`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      if (!response.ok) throw new Error('Failed to start Meta Ads OAuth')
      const data = await response.json()
      window.location.href = data.auth_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Meta Ads OAuth')
    }
  }

  const handleDisconnectMetaAds = async () => {
    if (!confirm('Are you sure you want to disconnect Meta Ads?')) return
    try {
      const apiUrl = getApiUrl()
      await fetch(`${apiUrl}/api/social/connections/meta_ads`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      setMetaAdsConnected(false)
      setMetaAdAccounts([])
      setMetaSelectedAccount('')
      setSuccessMessage('Meta Ads disconnected successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Meta Ads')
    }
  }

  const fetchConnections = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/social/connections`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch connections')
      
      const data = await response.json()
      setConnections(data.connections || [])
    } catch (err) {
      console.error('Error fetching connections:', err)
      setError(err instanceof Error ? err.message : 'Failed to load connections')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (platformId: string) => {
    try {
      const apiUrl = getApiUrl()
      // Get OAuth URL from backend (with auth header)
      const response = await fetch(`${apiUrl}/api/social/${platformId}/connect`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to get authorization URL')
      
      const data = await response.json()
      // Redirect to OAuth URL
      window.location.href = data.auth_url
    } catch (err) {
      console.error('Error connecting:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }

  const handleDisconnect = async (platformId: string) => {
    if (!confirm(`Are you sure you want to disconnect ${platformId}?`)) {
      return
    }
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/social/connections/${platformId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to disconnect')
      
      setSuccessMessage(`${platformId.charAt(0).toUpperCase() + platformId.slice(1)} disconnected successfully`)
      fetchConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  const startGoogleAdsOAuth = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/google-ads/oauth/authorize`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to start OAuth flow')
      }
      
      const data = await response.json()
      // Open OAuth URL in same window
      window.location.href = data.auth_url
    } catch (err) {
      console.error('Failed to start OAuth:', err)
      setError(err instanceof Error ? err.message : 'Failed to start OAuth flow')
    }
  }

  const handleConnectGoogleAds = async () => {
    if (!googleAdsCustomerIdInput) {
      setError('Please enter Customer ID')
      return
    }

    if (!googleAdsRefreshToken) {
      setError('OAuth token missing. Please try connecting again.')
      return
    }
    
    setIsConnectingGoogleAds(true)
    setError(null)
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/google-ads/oauth/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: googleAdsRefreshToken,
          customer_id: googleAdsCustomerIdInput
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to connect Google Ads')
      }
      
      const data = await response.json()
      setGoogleAdsConnected(true)
      setGoogleAdsCustomerId(googleAdsCustomerIdInput)
      setSuccessMessage(`Google Ads connected successfully! Found ${data.campaigns_count} campaigns.`)
      setShowGoogleAdsModal(false)
      setGoogleAdsRefreshToken('')
      setGoogleAdsCustomerIdInput('')
      
      // Clear temp token from sessionStorage
      sessionStorage.removeItem('google_ads_temp_token')
      
      // Refresh status
      fetchGoogleAdsStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Google Ads')
    } finally {
      setIsConnectingGoogleAds(false)
    }
  }

  const handleDisconnectGoogleAds = async () => {
    if (!confirm('Are you sure you want to disconnect Google Ads?')) {
      return
    }
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/google-ads/disconnect`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to disconnect Google Ads')
      
      setGoogleAdsConnected(false)
      setGoogleAdsCustomerId('')
      setSuccessMessage('Google Ads disconnected successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Google Ads')
    }
  }

  const getConnection = (platformId: string) => {
    return connections.find(c => c.platform === platformId)
  }

  if (!user) return null

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Social Media Connections
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your social media accounts to start publishing
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded-lg mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-green-800 dark:text-green-300">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg mb-6">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* No Active Account Warning */}
      {!loading && !activeAccount && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
                No business account selected
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                Please create or select a business account first to manage social media connections.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Platforms List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : activeAccount ? (
        <>
          {/* Social Media Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Social Media</h2>
            <div className="space-y-4">
              {SOCIAL_MEDIA_PLATFORMS.map((platform) => {
                const connection = getConnection(platform.id)
                const isConnected = connection?.is_connected

                return (
                  <div
                    key={platform.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      {/* Left: Icon + Info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="flex-shrink-0">
                          {platform.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            {platform.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {platform.description}
                          </p>

                          {connection && (
                            <div className="mt-2 text-sm">
                              <p className="text-gray-700 dark:text-gray-300">
                                Connected as: <span className="font-medium">{connection.platform_username}</span>
                              </p>
                              {connection.platform_profile_url && (
                                <a
                                  href={connection.platform_profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  View Profile
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Status + Actions */}
                      <div className="flex items-center gap-3 ml-4">
                        {isConnected ? (
                          <>
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Connected
                            </span>
                            <button
                              onClick={() => handleDisconnect(platform.id)}
                              className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg font-semibold transition-all"
                            >
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleConnect(platform.id)}
                              disabled={!platform.enabled}
                              className={`
                                px-6 py-2.5 rounded-lg font-semibold transition-all
                                ${platform.enabled
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                }
                              `}
                            >
                              Connect
                            </button>

                            {!platform.enabled && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                Coming soon
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Advertising Platforms Section */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Advertising Platforms</h2>
            <div className="space-y-4">
              {ADVERTISING_PLATFORMS.map((platform) => {
                const isGoogle = platform.id === 'google_ads'
                const isMeta = platform.id === 'meta_ads'
                const isConn = isGoogle ? googleAdsConnected : isMeta ? metaAdsConnected : false

                return (
                  <div key={platform.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="flex-shrink-0">{platform.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{platform.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{platform.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        {isConn ? (
                          <>
                            {isGoogle && googleAdsCustomerId && (
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{googleAdsCustomerId}</p>
                            )}
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Connected
                            </span>
                            <button
                              onClick={isGoogle ? handleDisconnectGoogleAds : handleDisconnectMetaAds}
                              className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg font-semibold transition-all">
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={isGoogle ? startGoogleAdsOAuth : startMetaAdsOAuth}
                            className="px-6 py-2.5 rounded-lg font-semibold transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md flex items-center gap-2">
                            {isGoogle ? (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                            )}
                            {isGoogle ? 'Sign in with Google' : 'Connect Meta Ads'}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Meta Ads: Ad Account selector */}
                    {isMeta && isConn && metaAdAccounts.length > 1 && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Ad Account:</label>
                          <select
                            value={metaSelectedAccount}
                            onChange={async (e) => {
                              const newId = e.target.value
                              setMetaSelectedAccount(newId)
                              try {
                                const apiUrl = getApiUrl()
                                await fetch(`${apiUrl}/api/social/meta-ads/select-account`, {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${session?.access_token}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ ad_account_id: newId }),
                                })
                              } catch (err) { console.error('Failed to switch ad account:', err) }
                            }}
                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                          >
                            {metaAdAccounts.map((a: any) => (
                              <option key={a.id} value={a.id}>
                                {a.name || a.id} {a.currency ? `(${a.currency})` : ''} {a.account_status === 1 ? '' : '⚠️ inactive'}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : null}

      {/* Google Ads Connection Modal */}
      {showGoogleAdsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Connect Google Ads Account
                </h3>
                <button
                  onClick={() => {
                    setShowGoogleAdsModal(false)
                    setGoogleAdsRefreshToken('')
                    setGoogleAdsCustomerIdInput('')
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isConnectingGoogleAds}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Success Message */}
              <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded-lg mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-green-900 dark:text-green-200 mb-1">
                      ✅ Google authentication successful!
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-300">
                      Now enter your Google Ads Customer ID to complete the connection.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* Customer ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Customer ID *
                  </label>
                  <input
                    type="text"
                    value={googleAdsCustomerIdInput}
                    onChange={(e) => setGoogleAdsCustomerIdInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="1234567890"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                    disabled={isConnectingGoogleAds}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    10-digit number without dashes. Find it in Google Ads top-right corner.
                  </p>
                </div>

                {/* Help */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                        Where to find Customer ID?
                      </h4>
                      <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                        <li>Open <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Ads</a></li>
                        <li>Look at the top-right corner for "XXX-XXX-XXXX"</li>
                        <li>Remove dashes and enter here (e.g., 1234567890)</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowGoogleAdsModal(false)
                      setGoogleAdsRefreshToken('')
                      setGoogleAdsCustomerIdInput('')
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    disabled={isConnectingGoogleAds}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnectGoogleAds}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isConnectingGoogleAds || !googleAdsRefreshToken || !googleAdsCustomerIdInput}
                  >
                    {isConnectingGoogleAds ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      'Connect Google Ads'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
