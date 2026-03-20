import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Archive, Calendar, Trash2, RefreshCw, Send, X, Wand2, Download } from 'lucide-react'
import { SchedulePostModal } from './SchedulePostModal'
import { PostToSocial } from './PostToSocial'
import { SubtitlePicker, type SubtitleStyle, type SubtitleLang } from './SubtitlePicker'

const API_URL = getApiUrl()

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
  is_video?: boolean
  expires_at?: string
}

function getHook(text: string): string {
  const first = text.split(/[.\n!?]/)[0]?.trim()
  return first?.length > 80 ? first.slice(0, 80) + '...' : first || 'Untitled Post'
}

interface SavedPostsLibraryProps {
  onSendToPostGenerator?: (videoUrl: string, prompt: string) => void
}

export function SavedPostsLibrary({ onSendToPostGenerator }: SavedPostsLibraryProps) {
  const { session } = useAuth()
  const [posts, setPosts] = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<SavedPost | null>(null)
  const [isScheduling, setIsScheduling] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [previewPost, setPreviewPost] = useState<SavedPost | null>(null)
  const [subtitleLang, setSubtitleLang] = useState<SubtitleLang>('en')
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>('classic')
  const [isAddingSubtitles, setIsAddingSubtitles] = useState(false)
  const [subtitledUrl, setSubtitledUrl] = useState<string | null>(null)

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
          const isVideo = post.is_video || post.image_url?.includes('.mp4') || post.image_url?.includes('video')
          return (
            <div key={post.id}
              className="group bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-600 transition cursor-pointer"
              onClick={() => { setPreviewPost(post); setSubtitledUrl(null) }}
            >
              {/* Thumbnail */}
              {post.image_url && (
                <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  {isVideo ? (
                    <>
                      <video src={post.image_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition">
                          <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="bg-black/70 text-white px-2 py-0.5 rounded text-[10px] font-bold">VIDEO</span>
                        {post.expires_at && (
                          <span className="bg-orange-500/90 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                            {Math.max(0, Math.ceil((new Date(post.expires_at).getTime() - Date.now()) / 86400000))}d left
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <img src={post.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  )}
                </div>
              )}

              <div className="p-4 space-y-2.5">
                {/* Hook / Headline */}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">{hook}</h3>

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
                    <button onClick={e => { e.stopPropagation(); setSelectedPost(post); setIsPublishing(true) }}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition">
                      <Send size={10} /> Publish
                    </button>
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

      {selectedPost && isScheduling && (
        <SchedulePostModal
          isOpen
          onClose={() => { setIsScheduling(false); setSelectedPost(null) }}
          postData={{ text: selectedPost.text, hashtags: selectedPost.hashtags, cta: selectedPost.call_to_action, imageUrl: selectedPost.image_url }}
          platforms={selectedPost.platforms.length > 0 ? selectedPost.platforms : []}
        />
      )}
      {selectedPost && isPublishing && (
        <PostToSocial
          isOpen
          onClose={() => { setIsPublishing(false); setSelectedPost(null) }}
          prefilledData={{
            text: `${selectedPost.text}${selectedPost.hashtags?.length ? '\n\n' + selectedPost.hashtags.map(t => `#${t}`).join(' ') : ''}${selectedPost.call_to_action ? '\n\n' + selectedPost.call_to_action : ''}`,
            imageUrl: selectedPost.image_url
          }}
        />
      )}

      {previewPost && (() => {
        const p = previewPost
        const isVid = p.is_video || p.image_url?.includes('.mp4') || p.image_url?.includes('video')
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewPost(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">Post Preview</h3>
                <button onClick={() => setPreviewPost(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {p.image_url && (
                  <div className="rounded-xl overflow-hidden bg-black">
                    {isVid ? (
                      <video key={subtitledUrl || p.image_url} src={subtitledUrl || p.image_url} controls autoPlay className="w-full" style={{ maxHeight: 400 }} />
                    ) : (
                      <img src={p.image_url} alt="" className="w-full object-contain" style={{ maxHeight: 400 }} />
                    )}
                  </div>
                )}

                {isVid && p.expires_at && (
                  <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded-lg">
                    <span className="font-bold">{Math.max(0, Math.ceil((new Date(p.expires_at).getTime() - Date.now()) / 86400000))} days left</span>
                    <span className="text-orange-500">— video expires after 7 days. Download to keep.</span>
                  </div>
                )}

                <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">{p.text}</div>

                {p.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.hashtags.map((tag, i) => (
                      <span key={i} className="text-sm text-blue-500 font-medium">#{tag}</span>
                    ))}
                  </div>
                )}

                {p.call_to_action && (
                  <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">{p.call_to_action}</div>
                )}

                {p.platforms?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.platforms.map(pl => {
                      const pm = PLATFORM_COLORS[pl]
                      return pm ? (
                        <span key={pl} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: pm.bg, color: pm.text }}>{pm.label}</span>
                      ) : null
                    })}
                  </div>
                )}

                <div className="text-xs text-gray-400">Saved {new Date(p.saved_at).toLocaleString()}</div>
              </div>

              {/* Actions */}
              <div className="p-5 border-t dark:border-gray-700 space-y-3">
                <div className="flex flex-wrap gap-2">
                {isVid && onSendToPostGenerator && (
                  <button
                    onClick={() => { onSendToPostGenerator(subtitledUrl || p.image_url, p.text); setPreviewPost(null) }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-sm transition-all shadow-lg"
                  >
                    <Wand2 size={14} /> Send to Post Generator
                  </button>
                )}
                {p.image_url && (
                  <button
                    onClick={async () => {
                      const mediaUrl = subtitledUrl || p.image_url
                      try {
                        const resp = await fetch(mediaUrl)
                        const blob = await resp.blob()
                        const ext = isVid ? 'mp4' : (blob.type.includes('png') ? 'png' : 'jpg')
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a'); a.href = url; a.download = `${isVid ? 'video' : 'image'}-${Date.now()}.${ext}`; a.click()
                        URL.revokeObjectURL(url)
                      } catch { const a = document.createElement('a'); a.href = mediaUrl; a.download = `media-${Date.now()}`; a.click() }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm transition-all"
                  >
                    <Download size={14} /> Download
                  </button>
                )}
                <button
                  onClick={() => { setPreviewPost(null); setSelectedPost({ ...p, image_url: subtitledUrl || p.image_url }); setIsPublishing(true) }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:bg-blue-100 transition"
                >
                  <Send size={14} /> Publish Now
                </button>
                <button
                  onClick={() => { setPreviewPost(null); setSelectedPost({ ...p, image_url: subtitledUrl || p.image_url }); setIsScheduling(true) }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-semibold text-sm hover:bg-purple-100 transition"
                >
                  <Calendar size={14} /> Schedule
                </button>
                <button
                  onClick={() => { setPreviewPost(null); handleDelete(p.id) }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm transition"
                >
                  <Trash2 size={14} /> Delete
                </button>
                </div>

                {/* Subtitles for video posts */}
                {isVid && p.image_url && (
                  <SubtitlePicker
                    lang={subtitleLang}
                    style={subtitleStyle}
                    isProcessing={isAddingSubtitles}
                    hasSubtitles={!!subtitledUrl}
                    onLangChange={setSubtitleLang}
                    onStyleChange={setSubtitleStyle}
                    onRevert={() => setSubtitledUrl(null)}
                    onGenerate={async () => {
                      if (!session) return
                      setIsAddingSubtitles(true)
                      try {
                        const res = await fetch(`${API_URL}/api/video-gen/add-subtitles`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                          body: JSON.stringify({ video_url: p.image_url, language: subtitleLang, style: subtitleStyle }),
                        })
                        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Failed') }
                        const data = await res.json()
                        setSubtitledUrl(data.video_url)
                      } catch (e: any) {
                        alert(e.message || 'Failed to add subtitles')
                      } finally {
                        setIsAddingSubtitles(false)
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
