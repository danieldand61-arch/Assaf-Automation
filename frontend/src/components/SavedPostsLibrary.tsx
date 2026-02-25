import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Archive, Calendar, Trash2, RefreshCw } from 'lucide-react'
import { SchedulePostModal } from './SchedulePostModal'

const PLATFORM_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  facebook:        { bg: '#1877F215', text: '#1877F2', label: 'Facebook' },
  instagram:       { bg: '#E4405F15', text: '#E4405F', label: 'Instagram' },
  linkedin:        { bg: '#0A66C215', text: '#0A66C2', label: 'LinkedIn' },
  tiktok:          { bg: '#01010115', text: '#666',    label: 'TikTok' },
  x:               { bg: '#1DA1F215', text: '#1DA1F2', label: 'X' },
  google_business: { bg: '#4285F415', text: '#4285F4', label: 'Google' },
}

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

function getHook(text: string): string {
  const first = text.split(/[.\n!?]/)[0]?.trim()
  return first?.length > 80 ? first.slice(0, 80) + '...' : first || 'Untitled Post'
}

export function SavedPostsLibrary() {
  const { session } = useAuth()
  const [posts, setPosts] = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<SavedPost | null>(null)
  const [isScheduling, setIsScheduling] = useState(false)

  useEffect(() => { if (session) fetchPosts() }, [session])

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/saved-posts/list`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (e) { console.error('Fetch saved posts:', e) }
    finally { setLoading(false) }
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post from library?')) return
    try {
      const res = await fetch(`${getApiUrl()}/api/saved-posts/${postId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed')
      setPosts(posts.filter(p => p.id !== postId))
    } catch { alert('Failed to delete post') }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
    </div>
  )

  if (posts.length === 0) return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-16 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
        <Archive className="w-8 h-8 text-purple-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Saved Posts Yet</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        Save posts from the content generator to schedule and publish them later
      </p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Archive size={20} className="text-purple-500" /> Content Library
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{posts.length} saved {posts.length === 1 ? 'post' : 'posts'}</p>
        </div>
        <button onClick={fetchPosts} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {posts.map((post) => {
          const hook = getHook(post.text)
          const isVideo = post.image_url?.includes('video') || post.image_url?.includes('.mp4')
          return (
            <div key={post.id}
              className="group bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-600 transition cursor-pointer"
              onClick={() => { setSelectedPost(post); setIsScheduling(true) }}
            >
              {/* Thumbnail */}
              {post.image_url && (
                <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  {isVideo ? (
                    <>
                      <video src={post.image_url} className="w-full h-full object-cover" muted playsInline />
                      <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-[10px] font-bold">VIDEO</div>
                    </>
                  ) : (
                    <img src={post.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  )}
                </div>
              )}

              <div className="p-4 space-y-2.5">
                {/* Hook / Headline */}
                <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">{hook}</h3>

                {/* Text preview */}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{post.text}</p>

                {/* Platform badges */}
                {post.platforms?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {post.platforms.map(p => {
                      const pm = PLATFORM_COLORS[p]
                      return pm ? (
                        <span key={p} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: pm.bg, color: pm.text }}>
                          {pm.label}
                        </span>
                      ) : null
                    })}
                  </div>
                )}

                {/* Hashtags */}
                {post.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.hashtags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="text-[10px] text-blue-500">#{tag}</span>
                    ))}
                    {post.hashtags.length > 4 && <span className="text-[10px] text-gray-400">+{post.hashtags.length - 4}</span>}
                  </div>
                )}

                {/* Date + Actions */}
                <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-[10px] text-gray-400">{new Date(post.saved_at).toLocaleDateString()}</span>
                  <div className="flex gap-1.5">
                    <button onClick={e => { e.stopPropagation(); setSelectedPost(post); setIsScheduling(true) }}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition">
                      <Calendar size={10} /> Schedule
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(post.id) }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedPost && (
        <SchedulePostModal
          isOpen={isScheduling}
          onClose={() => { setIsScheduling(false); setSelectedPost(null) }}
          postData={{ text: selectedPost.text, hashtags: selectedPost.hashtags, cta: selectedPost.call_to_action, imageUrl: selectedPost.image_url }}
          platforms={selectedPost.platforms.length > 0 ? selectedPost.platforms : []}
        />
      )}
    </div>
  )
}
