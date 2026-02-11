import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from '../lib/api'
import { Loader2, Search, ArrowUpDown, Users, DollarSign, Activity, LogOut } from 'lucide-react'

interface UserStats {
  user_id: string
  email: string
  full_name: string
  usage_by_service: {
    [key: string]: {
      requests: number
      input_tokens: number
      output_tokens: number
      total_tokens: number
    }
  }
  total_requests: number
  last_activity: string
}

export function Admin() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserStats[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'email' | 'credits' | 'requests'>('credits')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [error, setError] = useState('')

  // Check admin access
  useEffect(() => {
    const hasAccess = sessionStorage.getItem('admin_access')
    if (!hasAccess) {
      navigate('/admin', { replace: true })
      return
    }
  }, [navigate])

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError('')

      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/admin/users-stats`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load users')
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  // Calculate total tokens for user
  const getTotalTokens = (user: UserStats) => {
    return Object.values(user.usage_by_service || {}).reduce(
      (sum, service) => sum + (service.total_tokens || 0),
      0
    )
  }

  // Filter and sort users
  const filteredUsers = users
    .filter(u => 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      let comparison = 0
      
      if (sortBy === 'email') {
        comparison = a.email.localeCompare(b.email)
      } else if (sortBy === 'credits') {
        comparison = getTotalTokens(a) - getTotalTokens(b)
      } else if (sortBy === 'requests') {
        comparison = a.total_requests - b.total_requests
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Admin Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                User credits usage and statistics
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Back to Home
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem('admin_access')
                  navigate('/admin')
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Total Users</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{users.length}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Total API Usage</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {users.reduce((sum, u) => sum + getTotalTokens(u), 0).toLocaleString()} units
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">tokens + credits</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Total Requests</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {users.reduce((sum, u) => sum + u.total_requests, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email or name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Sort */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="credits">Sort by API Usage</option>
                  <option value="requests">Sort by Requests</option>
                  <option value="email">Sort by Email</option>
                </select>

                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                >
                  <ArrowUpDown className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Total API Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    By Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {user.full_name || 'No name'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {getTotalTokens(user).toLocaleString()} tokens
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {Object.entries(user.usage_by_service || {}).map(([service, usage]) => {
                          // Format service name
                          const serviceNames: { [key: string]: { name: string; icon: string } } = {
                            'gemini_chat': { name: 'Gemini Chat', icon: '💬' },
                            'social_posts': { name: 'Social Posts', icon: '📱' },
                            'image_generation': { name: 'Image Gen', icon: '🖼️' },
                            'video_dubbing': { name: 'Video Dubbing (Est)', icon: '🎬' },
                            'video_dubbing_actual': { name: 'Video Dubbing', icon: '🎬' },
                            'google_ads': { name: 'Google Ads', icon: '📢' },
                            'elevenlabs': { name: 'ElevenLabs', icon: '🔊' },
                            'video_translation': { name: 'Video Trans', icon: '🎥' }
                          }
                          
                          const serviceInfo = serviceNames[service] || { name: service, icon: '⚙️' }
                          const hasTokens = usage.total_tokens > 0
                          
                          // For video_dubbing, show credits instead of tokens
                          const isVideoDubbing = service === 'video_dubbing' || service === 'video_dubbing_actual'
                          const displayValue = isVideoDubbing 
                            ? `${usage.total_tokens.toLocaleString()} credits`
                            : `${usage.total_tokens.toLocaleString()} tokens`
                          
                          return (
                            <div key={service} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1">
                              <div className="flex items-center gap-2">
                                <span>{serviceInfo.icon}</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {serviceInfo.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasTokens ? (
                                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                    {displayValue}
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400">0</span>
                                )}
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({usage.requests} {usage.requests === 1 ? 'call' : 'calls'})
                                </span>
                              </div>
                            </div>
                          )
                        })}
                        {Object.keys(user.usage_by_service || {}).length === 0 && (
                          <span className="text-sm text-gray-400">No usage yet</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {user.total_requests}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {user.last_activity 
                          ? new Date(user.last_activity).toLocaleDateString()
                          : 'Never'
                        }
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No users found matching your search' : 'No users yet'}
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
