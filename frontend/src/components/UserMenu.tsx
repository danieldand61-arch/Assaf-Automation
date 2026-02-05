import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from '../lib/api'
import { User, LogOut, Settings, ChevronDown, BookmarkPlus, Calendar, Link as LinkIcon } from 'lucide-react'

interface SocialConnection {
  platform: string
  connected: boolean
  username?: string
}

export function UserMenu() {
  const { user, signOut, session } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [connections, setConnections] = useState<SocialConnection[]>([])
  const [loadingConnections, setLoadingConnections] = useState(false)

  useEffect(() => {
    if (isOpen && session) {
      loadConnections()
    }
  }, [isOpen, session])

  const loadConnections = async () => {
    setLoadingConnections(true)
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/social/status`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        const platformsList = [
          { platform: 'instagram', name: 'Instagram', connected: data.instagram?.connected || false, username: data.instagram?.username },
          { platform: 'facebook', name: 'Facebook', connected: data.facebook?.connected || false, username: data.facebook?.username },
          { platform: 'linkedin', name: 'LinkedIn', connected: data.linkedin?.connected || false, username: data.linkedin?.username },
          { platform: 'twitter', name: 'Twitter', connected: data.twitter?.connected || false, username: data.twitter?.username },
          { platform: 'tiktok', name: 'TikTok', connected: data.tiktok?.connected || false, username: data.tiktok?.username }
        ]
        setConnections(platformsList)
      }
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoadingConnections(false)
    }
  }

  if (!user) return null

  const handleSignOut = async () => {
    setIsOpen(false)
    try {
      // Sign out from Supabase
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      // Clear Supabase auth data from storage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key)
        }
      })
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          sessionStorage.removeItem(key)
        }
      })
      // Force full page reload to login
      window.location.replace('/login')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
            
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {user.user_metadata?.full_name || 'User'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={() => {
                  navigate('/library')
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <BookmarkPlus className="w-4 h-4" />
                Post Library
              </button>

              <button
                onClick={() => {
                  navigate('/scheduled')
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <Calendar className="w-4 h-4" />
                Scheduled Posts
              </button>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

              {/* Social Media Connections */}
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  <LinkIcon className="w-3 h-3" />
                  Social Media
                </div>
                
                {loadingConnections ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400 py-2">Loading...</div>
                ) : (
                  <div className="space-y-1">
                    {connections.map((conn) => (
                      <button
                        key={conn.platform}
                        onClick={() => {
                          navigate('/settings?tab=connections')
                          setIsOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                      >
                        <span className="text-gray-700 dark:text-gray-300 capitalize">
                          {conn.platform}
                        </span>
                        <span className={`text-xs ${conn.connected ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {conn.connected ? '✓ Connected' : 'Not connected'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

              <button
                onClick={() => {
                  navigate('/settings')
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
