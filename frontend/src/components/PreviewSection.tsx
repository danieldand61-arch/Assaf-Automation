import { useState } from 'react'
import { ArrowLeft, Calendar, Send, Download, RefreshCw, Edit3, BookmarkPlus, Check, AlertTriangle, ImageOff, ChevronDown, ChevronUp } from 'lucide-react'
import { useContentStore } from '../store/contentStore'
import { useAuth } from '../contexts/AuthContext'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { PostEditModal } from './PostEditModal'
import { ImageEditModal } from './ImageEditModal'
import { PostToSocial } from './PostToSocial'
import { SchedulePostModal } from './SchedulePostModal'
import { getApiUrl } from '../lib/api'

/* ── Platform config ──────────────────────────────────────────── */
const PLATFORM_META: Record<string, { label: string; color: string; charLimit: number }> = {
  facebook:        { label: 'Facebook',        color: '#1877F2', charLimit: 63206 },
  instagram:       { label: 'Instagram',       color: '#E4405F', charLimit: 2200 },
  linkedin:        { label: 'LinkedIn',        color: '#0A66C2', charLimit: 3000 },
  tiktok:          { label: 'TikTok',          color: '#010101', charLimit: 2200 },
  x:               { label: 'X (Twitter)',     color: '#1DA1F2', charLimit: 280 },
  google_business: { label: 'Google Business', color: '#4285F4', charLimit: 1500 },
}

interface PreviewSectionProps {
  onReset: () => void
  onBack?: () => void
  content?: any
}

export function PreviewSection({ onReset, onBack, content }: PreviewSectionProps) {
  const { generatedContent: globalContent, updateVariation, updateImage } = useContentStore()
  const generatedContent = content || globalContent
  const { session } = useAuth()

  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingImageIdx, setEditingImageIdx] = useState<number | null>(null)
  const [postingIdx, setPostingIdx] = useState<number | null>(null)
  const [schedulingIdx, setSchedulingIdx] = useState<number | null>(null)
  const [savingIdx, setSavingIdx] = useState<number | null>(null)
  const [publishedStatus, setPublishedStatus] = useState<Record<number, string>>({})

  const userMedia: string | null = generatedContent?.user_media || null
  const hasImages = !!(generatedContent?.images?.length)

  if (!generatedContent?.variations?.length || (!hasImages && !userMedia)) {
    return <div className="text-center text-gray-500 py-20">No content generated yet</div>
  }

  const variations = generatedContent.variations
  const images = generatedContent.images || []
  const platforms: string[] = generatedContent.request_params?.platforms || ['facebook', 'instagram']

  /* ── Helpers ─────────────────────────────────────────────────── */
  const getFullText = (v: any) => {
    const tags = v.hashtags?.map((t: string) => `#${t}`).join(' ') || ''
    const cta = v.call_to_action || ''
    return `${v.text}${tags ? '\n\n' + tags : ''}${cta ? '\n\n' + cta : ''}`
  }

  const autoSaveToLibrary = async (idx: number) => {
    if (!session) return
    try {
      const v = variations[idx]
      const img = images[idx] || images[0]
      await fetch(`${getApiUrl()}/api/saved-posts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          text: v.text, hashtags: v.hashtags, call_to_action: v.call_to_action,
          image_url: img.url, platforms,
        })
      })
    } catch { /* silent — publish/schedule is the primary action */ }
  }

  const handleDownloadAll = async () => {
    const zip = new JSZip()
    variations.forEach((v: any, i: number) => {
      zip.file(`post-${i + 1}.txt`, getFullText(v))
      const img = images[i] || images[0]
      if (img?.url?.startsWith('data:')) {
        const b64 = img.url.split(',')[1]
        const bin = atob(b64)
        const arr = new Uint8Array(bin.length)
        for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j)
        zip.file(`image-${i + 1}.jpg`, arr, { binary: true })
      }
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, 'social-posts.zip')
  }

  const handleSave = async (idx: number) => {
    if (!session) return
    setSavingIdx(idx)
    try {
      const v = variations[idx]
      const img = images[idx] || images[0]
      const res = await fetch(`${getApiUrl()}/api/saved-posts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          text: v.text, hashtags: v.hashtags, call_to_action: v.call_to_action,
          image_url: img.url, platforms,
        })
      })
      if (!res.ok) throw new Error('Save failed')
      setPublishedStatus(prev => ({ ...prev, [idx]: 'Saved to Library ✓' }))
    } catch { alert('Failed to save') }
    finally { setSavingIdx(null) }
  }

  const handleTextSave = (text: string, hashtags: string[], cta: string) => {
    if (editingIdx !== null) updateVariation(editingIdx, text, hashtags, cta)
    setEditingIdx(null)
  }

  const handleImageUpdate = (url: string) => {
    if (editingImageIdx !== null) updateImage(editingImageIdx, url)
    setEditingImageIdx(null)
  }

  const cols = variations.length >= 3 ? 'grid-cols-1 lg:grid-cols-2' : variations.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'
  const [expandedIdx, setExpandedIdx] = useState<Record<number, boolean>>({})
  const TEXT_CLAMP = 200

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* ── Top Action Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {onBack && (
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
        <div className="flex-1" />
        <button onClick={handleDownloadAll}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <Download size={16} /> Download All
        </button>
        <button onClick={onReset}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition"
          style={{ background: 'linear-gradient(135deg, #4A7CFF, #7C3AED)' }}
        >
          <RefreshCw size={16} /> New Generation
        </button>
      </div>

      {/* ── Post Cards Grid ────────────────────────────────────── */}
      <div className={`grid ${cols} gap-5`}>
        {variations.map((v: any, idx: number) => {
          const img = images[idx] || images[0] || (userMedia ? { url: userMedia, size: '', dimensions: '' } : null)
          const platform = v.platform || platforms[idx % platforms.length]
          const meta = PLATFORM_META[platform] || PLATFORM_META.facebook
          const fullText = getFullText(v)
          const overLimit = fullText.length > meta.charLimit
          const status = publishedStatus[idx]
          const isPlaceholder = img?.url?.includes('placehold.co')
          const isExpanded = expandedIdx[idx]
          const needsTruncate = v.text.length > TEXT_CLAMP

          return (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
              {/* Platform header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700"
                style={{ background: `${meta.color}10` }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ background: meta.color }}
                >
                  {meta.label[0]}
                </div>
                <span className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</span>
                <div className="flex-1" />
                <span className={`text-xs font-medium flex items-center gap-1 ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
                  {overLimit && <AlertTriangle size={12} />}
                  {fullText.length}/{meta.charLimit}
                </span>
              </div>

              {/* Image / Video */}
              {img?.url && !isPlaceholder ? (
                <div className="relative" style={{ maxHeight: 280, overflow: 'hidden' }}>
                  {img.url.startsWith('data:video') ? (
                    <video src={img.url} className="w-full h-full object-cover" style={{ maxHeight: 280 }} controls muted />
                  ) : (
                    <img src={img.url} alt="" className="w-full h-full object-cover" style={{ maxHeight: 280 }} />
                  )}
                  {!userMedia && (
                    <button onClick={() => setEditingImageIdx(idx)}
                      className="absolute top-2 right-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition flex items-center gap-1"
                    >
                      <Edit3 size={11} /> Edit Image
                    </button>
                  )}
                </div>
              ) : isPlaceholder ? (
                <div className="flex flex-col items-center justify-center py-8 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700">
                  <ImageOff size={28} className="text-gray-300 dark:text-gray-500 mb-2" />
                  <span className="text-xs text-gray-400 dark:text-gray-500 mb-2">Image generation failed</span>
                  <button onClick={() => setEditingImageIdx(idx)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition"
                    style={{ background: 'linear-gradient(135deg, #4A7CFF, #7C3AED)' }}
                  >
                    <RefreshCw size={11} className="inline mr-1" style={{ verticalAlign: '-1px' }} />Regenerate
                  </button>
                </div>
              ) : null}

              {/* Caption */}
              <div className="px-4 py-3">
                <p className="text-[13px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {needsTruncate && !isExpanded ? v.text.slice(0, TEXT_CLAMP) + '...' : v.text}
                </p>
                {needsTruncate && (
                  <button onClick={() => setExpandedIdx(prev => ({ ...prev, [idx]: !isExpanded }))}
                    className="text-xs font-medium mt-1 flex items-center gap-0.5"
                    style={{ color: meta.color }}
                  >
                    {isExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Read more</>}
                  </button>
                )}
                {v.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {v.hashtags.map((tag: string, i: number) => (
                      <span key={i} className="text-xs text-blue-500 dark:text-blue-400">#{tag}</span>
                    ))}
                  </div>
                )}
                {v.call_to_action && (
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-2">{v.call_to_action}</p>
                )}
              </div>

              {/* Status badge */}
              {status && (
                <div className="px-4 pb-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full">
                    <Check size={12} /> {status}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button onClick={() => setEditingIdx(idx)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  <Edit3 size={12} /> Edit
                </button>
                <button onClick={() => handleSave(idx)} disabled={savingIdx === idx}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition disabled:opacity-50"
                >
                  <BookmarkPlus size={12} /> {savingIdx === idx ? '...' : 'Save'}
                </button>
                <div className="flex-1" />
                <button onClick={() => setSchedulingIdx(idx)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <Calendar size={12} /> Schedule
                </button>
                <button onClick={() => setPostingIdx(idx)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition"
                  style={{ background: meta.color }}
                >
                  <Send size={12} /> Publish
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
      {editingIdx !== null && (
        <PostEditModal
          isOpen
          onClose={() => setEditingIdx(null)}
          initialText={variations[editingIdx].text}
          initialHashtags={variations[editingIdx].hashtags}
          initialCTA={variations[editingIdx].call_to_action}
          onSave={handleTextSave}
          language={generatedContent.request_params?.language || 'en'}
        />
      )}

      {editingImageIdx !== null && (
        <ImageEditModal
          isOpen
          onClose={() => setEditingImageIdx(null)}
          currentImage={(images[editingImageIdx] || images[0]).url}
          websiteData={generatedContent.website_data || {}}
          postText={variations[editingImageIdx].text}
          platform={platforms[editingImageIdx % platforms.length] || 'instagram'}
          imageSize={generatedContent.request_params?.image_size || '1080x1080'}
          includeLogo={generatedContent.request_params?.include_logo || false}
          onImageUpdate={handleImageUpdate}
        />
      )}

      {postingIdx !== null && (
        <PostToSocial
          isOpen
          onClose={() => {
            autoSaveToLibrary(postingIdx)
            setPublishedStatus(prev => ({ ...prev, [postingIdx!]: 'Published ✓' }))
            setPostingIdx(null)
          }}
          prefilledData={{
            text: getFullText(variations[postingIdx]),
            imageUrl: (images[postingIdx] || images[0]).url,
          }}
        />
      )}

      {schedulingIdx !== null && (
        <SchedulePostModal
          isOpen
          onClose={() => {
            autoSaveToLibrary(schedulingIdx)
            setPublishedStatus(prev => ({ ...prev, [schedulingIdx!]: 'Scheduled ✓' }))
            setSchedulingIdx(null)
          }}
          postData={{
            text: variations[schedulingIdx].text,
            hashtags: variations[schedulingIdx].hashtags,
            cta: variations[schedulingIdx].call_to_action || '',
            imageUrl: (images[schedulingIdx] || images[0]).url,
          }}
          platforms={platforms}
        />
      )}
    </div>
  )
}
