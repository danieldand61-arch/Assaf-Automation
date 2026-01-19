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

const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📷',
    color: 'from-purple-600 to-pink-600',
    description: 'Share photos and videos',
    enabled: true
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '👥',
    color: 'from-blue-600 to-blue-700',
    description: 'Connect with your audience',
    enabled: false // Coming soon
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    color: 'from-blue-700 to-blue-800',
    description: 'Professional networking',
    enabled: false
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: '🐦',
    color: 'from-gray-800 to-black',
    description: 'Share updates and engage',
    enabled: false
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    color: 'from-pink-500 to-purple-500',
    description: 'Create short-form videos',
    enabled: false
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

  useEffect(() => {
    // Check for OAuth callback messages
    const success = searchParams.get('success')
    const errorParam = searchParams.get('error')
    
    if (success) {
      setSuccessMessage(`${success.charAt(0).toUpperCase() + success.slice(1)} connected successfully!`)
      // Clear URL parameters
      window.history.replaceState({}, '', '/connections')
    }
    
    if (errorParam) {
      setError(errorParam)
      window.history.replaceState({}, '', '/connections')
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
    }
  }, [user, activeAccount, session?.access_token, navigate])

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

  const handleConnect = (platformId: string) => {
    const apiUrl = getApiUrl()
    // Redirect to backend OAuth endpoint
    window.location.href = `${apiUrl}/api/social/${platformId}/connect`
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

  const getConnection = (platformId: string) => {
    return connections.find(c => c.platform === platformId)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

      {/* Platforms Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : activeAccount ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLATFORMS.map((platform) => {
            const connection = getConnection(platform.id)
            const isConnected = connection?.is_connected

            return (
              <div
                key={platform.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-gray-700"
              >
                {/* Platform Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`bg-gradient-to-r ${platform.color} p-3 rounded-xl text-3xl`}>
                      {platform.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {platform.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {platform.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  {isConnected ? (
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-medium">
                      ✓ Connected
                    </span>
                  ) : !platform.enabled ? (
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full text-xs font-medium">
                      Coming Soon
                    </span>
                  ) : (
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full text-xs font-medium">
                      Not Connected
                    </span>
                  )}
                </div>

                {/* Connection Info */}
                {isConnected && connection && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium text-gray-900 dark:text-white">
                        @{connection.platform_username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Connected {formatDate(connection.last_connected_at)}</span>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={() => isConnected ? handleDisconnect(platform.id) : handleConnect(platform.id)}
                  disabled={!platform.enabled && !isConnected}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold transition-all
                    ${isConnected
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : platform.enabled
                        ? `bg-gradient-to-r ${platform.color} text-white hover:shadow-lg`
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {isConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
