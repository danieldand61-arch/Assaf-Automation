import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { getApiUrl } from '../lib/api'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TikTokUpload } from '../components/TikTokUpload'

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

export function Connections() {
  const { user, session } = useAuth()
  const { activeAccount } = useAccount()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isTikTokUploadOpen, setIsTikTokUploadOpen] = useState(false)

  useEffect(() => {
    // Check for OAuth callback messages
    const success = searchParams.get('success')
    const errorParam = searchParams.get('error')
    
    if (success) {
      setSuccessMessage(`${success.charAt(0).toUpperCase() + success.slice(1)} connected successfully!`)
      // Clear URL parameters
      window.history.replaceState({}, '', '/settings')
    }
    
    if (errorParam) {
      setError(errorParam)
      window.history.replaceState({}, '', '/settings')
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
        <div className="space-y-4">
          {PLATFORMS.map((platform) => {
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
                    {/* Platform Icon */}
                    <div className="flex-shrink-0">
                      {platform.icon}
                    </div>

                    {/* Platform Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {platform.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {platform.description}
                      </p>
                      <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Permissions we use
                      </button>
                    </div>
                  </div>

                  {/* Right: Status + Actions */}
                  <div className="flex items-center gap-4 ml-4">
                    {isConnected && connection ? (
                      <>
                        {/* Connected Account Info */}
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {connection.platform_username}
                          </p>
                        </div>

                        {/* Connected Badge */}
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Connected
                        </span>

                        {/* Test Upload Button (TikTok only) */}
                        {platform.id === 'tiktok' && (
                          <button
                            onClick={() => setIsTikTokUploadOpen(true)}
                            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white border border-pink-700 rounded-lg font-semibold transition-all flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Test Upload
                          </button>
                        )}

                        {/* Disconnect Button */}
                        <button
                          onClick={() => handleDisconnect(platform.id)}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg font-semibold transition-all"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Connect Button */}
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
      ) : null}

      {/* TikTok Upload Modal */}
      <TikTokUpload 
        isOpen={isTikTokUploadOpen}
        onClose={() => setIsTikTokUploadOpen(false)}
      />
    </div>
  )
}
