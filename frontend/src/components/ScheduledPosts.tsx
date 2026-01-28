import { useState, useEffect } from 'react'
import { Calendar, Clock, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface ScheduledPost {
  id: string
  text: string
  hashtags: string[]
  call_to_action: string
  image_url: string
  scheduled_time: string
  timezone: string
  platforms: string[]
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'cancelled'
  created_at: string
  published_at?: string
  error_message?: string
}

export function ScheduledPosts() {
  const { session } = useAuth()
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'failed'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')

  useEffect(() => {
    fetchScheduledPosts()
  }, [session])

  const fetchScheduledPosts = async () => {
    if (!session) return

    setLoading(true)
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/scheduling/scheduled`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch posts')

      const data = await response.json()
      setPosts(data.scheduled_posts || [])
    } catch (error) {
      console.error('Error fetching scheduled posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (postId: string) => {
    if (!session) return
    if (!confirm('Are you sure you want to cancel this scheduled post?')) return

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/scheduling/scheduled/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to cancel post')

      // Remove from UI
      setPosts(posts.filter(p => p.id !== postId))
      alert('✅ Scheduled post cancelled')
    } catch (error) {
      console.error('Error cancelling post:', error)
      alert('❌ Failed to cancel post')
    }
  }

  const filteredPosts = filter === 'all' 
    ? posts 
    : posts.filter(p => p.status === filter)
  
  // Sort posts by date
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    const dateA = new Date(a.scheduled_time).getTime()
    const dateB = new Date(b.scheduled_time).getTime()
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
  })

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Pending' },
      publishing: { icon: Loader2, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Publishing' },
      published: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Published' },
      failed: { icon: AlertCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Failed' },
      cancelled: { icon: AlertCircle, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Cancelled' }
    }

    const badge = badges[status as keyof typeof badges] || badges.pending
    const Icon = badge.icon

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        <Icon className={`w-3 h-3 ${status === 'publishing' ? 'animate-spin' : ''}`} />
        {badge.label}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Scheduled Posts</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track posts that are scheduled for publishing or already published
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-lg text-xs">
              <Clock className="w-3 h-3" />
              <strong>Pending:</strong> Will be posted at scheduled time
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-xs">
              <CheckCircle className="w-3 h-3" />
              <strong>Published:</strong> Already posted to platforms
            </span>
          </div>
        </div>
        <button
          onClick={fetchScheduledPosts}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition flex items-center gap-2"
        >
          <Loader2 className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filter Tabs and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['all', 'pending', 'published', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-md font-medium transition capitalize ${
                filter === status
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {status} ({status === 'all' ? posts.length : posts.filter(p => p.status === status).length})
            </button>
          ))}
        </div>
        
        {/* Sort Button */}
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setSortOrder('newest')}
            className={`px-4 py-2 rounded-md font-medium transition flex items-center gap-2 ${
              sortOrder === 'newest'
                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Newest First
          </button>
          <button
            onClick={() => setSortOrder('oldest')}
            className={`px-4 py-2 rounded-md font-medium transition flex items-center gap-2 ${
              sortOrder === 'oldest'
                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            Oldest First
          </button>
        </div>
      </div>

      {/* Posts List */}
      {sortedPosts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            {filter === 'all' ? 'No scheduled posts yet' : `No ${filter} posts`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(post.status)}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {formatDate(post.scheduled_time)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {post.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs font-medium capitalize"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
                {post.status === 'pending' && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                    title="Cancel scheduled post"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Text Content */}
                <div>
                  <p className="text-gray-800 dark:text-gray-200 mb-2 line-clamp-3">
                    {post.text}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {post.hashtags.slice(0, 5).map((tag, i) => (
                      <span key={i} className="text-xs text-blue-600 dark:text-blue-400">
                        #{tag}
                      </span>
                    ))}
                    {post.hashtags.length > 5 && (
                      <span className="text-xs text-gray-500">+{post.hashtags.length - 5} more</span>
                    )}
                  </div>
                  {post.call_to_action && (
                    <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                      {post.call_to_action}
                    </p>
                  )}
                </div>

                {/* Image Preview */}
                {post.image_url && (
                  <div>
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Error message if failed */}
              {post.status === 'failed' && post.error_message && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Error: {post.error_message}
                  </p>
                </div>
              )}

              {/* Published info */}
              {post.status === 'published' && post.published_at && (
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  Published at: {formatDate(post.published_at)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
