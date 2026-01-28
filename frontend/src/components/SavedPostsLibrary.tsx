import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { BookmarkPlus, Calendar, Trash2, RefreshCw } from 'lucide-react'
import { SchedulePostModal } from './SchedulePostModal'

interface SavedPost {
  id: string
  text: string
  hashtags: string[]
  call_to_action: string
  image_url: string
  title?: string
  notes?: string
  source_url?: string
  platforms: string[]
  saved_at: string
  created_at: string
}

export function SavedPostsLibrary() {
  const { session } = useAuth()
  const [posts, setPosts] = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<SavedPost | null>(null)
  const [isScheduling, setIsScheduling] = useState(false)

  useEffect(() => {
    if (session) {
      fetchPosts()
    }
  }, [session])

  const fetchPosts = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/saved-posts/list`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch posts')

      const data = await response.json()
      setPosts(data.posts || [])
    } catch (error) {
      console.error('Error fetching saved posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post from library?')) return

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/saved-posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to delete post')

      setPosts(posts.filter(p => p.id !== postId))
    } catch (error) {
      console.error('Error deleting post:', error)
      alert('Failed to delete post')
    }
  }

  const handleSchedule = (post: SavedPost) => {
    setSelectedPost(post)
    setIsScheduling(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
        <BookmarkPlus className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No Saved Posts Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Save posts from the content generator to schedule them later
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Post Library
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {posts.length} saved {posts.length === 1 ? 'post' : 'posts'}
          </p>
        </div>
        <button
          onClick={fetchPosts}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition cursor-pointer"
            onClick={() => handleSchedule(post)}
          >
            {/* Media Preview */}
            {post.image_url && (
              <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                {post.image_url.includes('video') || post.image_url.includes('.mp4') || post.image_url.includes('/video/') ? (
                  <>
                    <video
                      src={post.image_url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                    />
                    {/* Video indicator */}
                    <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                      VIDEO
                    </div>
                  </>
                ) : (
                  <img
                    src={post.image_url}
                    alt="Post"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              <p className="text-gray-900 dark:text-white text-sm line-clamp-3 mb-2">
                {post.text}
              </p>
              
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {post.hashtags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs text-blue-600 dark:text-blue-400"
                    >
                      #{tag}
                    </span>
                  ))}
                  {post.hashtags.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{post.hashtags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Saved {new Date(post.saved_at).toLocaleDateString()}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSchedule(post)
                  }}
                  className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(post.id)
                  }}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Schedule Modal */}
      {selectedPost && (
        <SchedulePostModal
          isOpen={isScheduling}
          onClose={() => {
            setIsScheduling(false)
            setSelectedPost(null)
          }}
          postData={{
            text: selectedPost.text,
            hashtags: selectedPost.hashtags,
            cta: selectedPost.call_to_action,
            imageUrl: selectedPost.image_url
          }}
          platforms={selectedPost.platforms.length > 0 ? selectedPost.platforms : []}
        />
      )}
    </div>
  )
}
