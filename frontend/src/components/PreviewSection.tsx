import { useState } from 'react'
import { ArrowLeft, Calendar, Send, Download, RefreshCw, Edit3, BookmarkPlus, Check, AlertTriangle, ImageOff, Wand2, Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, ThumbsUp, Globe } from 'lucide-react'
import { useContentStore } from '../store/contentStore'
import { useAuth } from '../contexts/AuthContext'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { PostEditModal } from './PostEditModal'
import { ImageEditModal } from './ImageEditModal'
import { PostToSocial } from './PostToSocial'
import { SchedulePostModal } from './SchedulePostModal'
import { getApiUrl } from '../lib/api'

const PLATFORM_META: Record<string, { label: string; color: string; charLimit: number; icon: string }> = {
  facebook:        { label: 'Facebook',        color: '#1877F2', charLimit: 1200, icon: 'f' },
  instagram:       { label: 'Instagram',       color: '#E4405F', charLimit: 800,  icon: 'ig' },
  linkedin:        { label: 'LinkedIn',        color: '#0A66C2', charLimit: 3000, icon: 'in' },
  tiktok:          { label: 'TikTok',          color: '#010101', charLimit: 2200, icon: 'tk' },
  x:               { label: 'X (Twitter)',     color: '#1DA1F2', charLimit: 280,  icon: 'x' },
  google_business: { label: 'Google Business', color: '#4285F4', charLimit: 1500, icon: 'g' },
}

const VARIANT_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  storyteller: { label: 'Storyteller', emoji: '✨', color: '#8B5CF6' },
  closer:      { label: 'Closer',      emoji: '🎯', color: '#EF4444' },
}

function CharBar({ current, max }: { current: number; max: number }) {
  const pct = Math.min((current / max) * 100, 120)
  const color = pct < 80 ? '#22C55E' : pct <= 100 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono whitespace-nowrap" style={{ color }}>{current}/{max}</span>
    </div>
  )
}

function InstagramMockup({ v, img, brandHandle, isExpanded, onToggle, onEditImage }: { v: any; img: any; brandHandle: string; isExpanded: boolean; onToggle: () => void; onEditImage?: () => void }) {
  const TEXT_CLAMP = 120
  const needsTruncate = v.text.length > TEXT_CLAMP
  return (
    <div className="flex flex-col">
      {/* IG Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
          <div className="w-full h-full rounded-full bg-white dark:bg-gray-800" />
        </div>
        <span className="text-xs font-semibold text-gray-900 dark:text-white">{brandHandle || 'yourbrand'}</span>
        <div className="flex-1" />
        <MoreHorizontal size={14} className="text-gray-500" />
      </div>
      {/* IG Image 4:5 */}
      {img?.url && !img.url.includes('placehold.co') ? (
        <div className="group/img relative w-full bg-black/5 dark:bg-black/30 cursor-pointer" style={{ aspectRatio: '4/5' }} onClick={onEditImage}>
          <img src={img.url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 shadow">
              <Edit3 size={12} /> Edit Image
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center justify-center bg-gray-100 dark:bg-gray-700/40" style={{ aspectRatio: '4/5' }}>
          <ImageOff size={32} className="text-gray-300" />
        </div>
      )}
      {/* IG Actions */}
      <div className="flex items-center gap-3 px-3 py-2">
        <Heart size={18} className="text-gray-800 dark:text-gray-200" />
        <MessageCircle size={18} className="text-gray-800 dark:text-gray-200" />
        <Send size={18} className="text-gray-800 dark:text-gray-200" />
        <div className="flex-1" />
        <Bookmark size={18} className="text-gray-800 dark:text-gray-200" />
      </div>
      {/* IG Caption */}
      <div className="px-3 pb-2">
        <p className="text-[12px] text-gray-800 dark:text-gray-200 leading-relaxed">
          <span className="font-semibold mr-1">{brandHandle || 'yourbrand'}</span>
          {needsTruncate && !isExpanded ? v.text.slice(0, TEXT_CLAMP) + '...' : v.text}
        </p>
        {needsTruncate && (
          <button onClick={onToggle} className="text-[11px] text-gray-400 mt-0.5">
            {isExpanded ? 'less' : 'more'}
          </button>
        )}
        {v.hashtags?.length > 0 && (
          <p className="text-[11px] text-blue-500 mt-1">{v.hashtags.map((t: string) => `#${t}`).join(' ')}</p>
        )}
      </div>
    </div>
  )
}

function FacebookMockup({ v, img, brandHandle, isExpanded, onToggle, onEditImage }: { v: any; img: any; brandHandle: string; isExpanded: boolean; onToggle: () => void; onEditImage?: () => void }) {
  const TEXT_CLAMP = 400
  const needsTruncate = v.text.length > TEXT_CLAMP
  return (
    <div className="flex flex-col">
      {/* FB Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
          {(brandHandle || 'B')[0].toUpperCase()}
        </div>
        <div>
          <span className="text-xs font-semibold text-gray-900 dark:text-white block">{brandHandle || 'Your Brand'}</span>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <span>Just now</span> · <Globe size={9} />
          </div>
        </div>
        <div className="flex-1" />
        <MoreHorizontal size={14} className="text-gray-500" />
      </div>
      {/* FB Text */}
      <div className="px-3 pb-2">
        <p className="text-[12px] text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
          {needsTruncate && !isExpanded ? v.text.slice(0, TEXT_CLAMP) + '...' : v.text}
        </p>
        {needsTruncate && (
          <button onClick={onToggle} className="text-[11px] text-blue-500 font-medium mt-0.5">
            {isExpanded ? 'Show less' : 'See more'}
          </button>
        )}
        {v.hashtags?.length > 0 && (
          <p className="text-[11px] text-blue-500 mt-1">{v.hashtags.map((t: string) => `#${t}`).join(' ')}</p>
        )}
      </div>
      {/* FB Image — full width, no crop, like real FB feed */}
      {img?.url && !img.url.includes('placehold.co') ? (
        <div className="group/img relative w-full bg-black/5 dark:bg-black/20 cursor-pointer" onClick={onEditImage}>
          <img src={img.url} alt="" className="w-full object-contain" />
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 shadow">
              <Edit3 size={12} /> Edit Image
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full h-[200px] flex items-center justify-center bg-gray-100 dark:bg-gray-700/40">
          <ImageOff size={32} className="text-gray-300" />
        </div>
      )}
      {/* FB Reactions */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-100 dark:border-gray-700">
        <button className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-500">
          <ThumbsUp size={14} /> Like
        </button>
        <button className="flex items-center gap-1 text-[11px] text-gray-500">
          <MessageCircle size={14} /> Comment
        </button>
        <button className="flex items-center gap-1 text-[11px] text-gray-500">
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
  )
}

function GenericMockup({ v, img, meta, isExpanded, onToggle, onEditImage }: { v: any; img: any; meta: any; isExpanded: boolean; onToggle: () => void; onEditImage?: () => void }) {
  const TEXT_CLAMP = 200
  const needsTruncate = v.text.length > TEXT_CLAMP
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: meta.color }}>
          {meta.label[0]}
        </div>
        <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
      </div>
      {img?.url && !img.url.includes('placehold.co') ? (
        <div className="group/img relative w-full cursor-pointer" onClick={onEditImage}>
          <img src={img.url} alt="" className="w-full object-contain" />
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 shadow">
              <Edit3 size={12} /> Edit Image
            </span>
          </div>
        </div>
      ) : null}
      <div className="px-3 py-2">
        <p className="text-[12px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
          {needsTruncate && !isExpanded ? v.text.slice(0, TEXT_CLAMP) + '...' : v.text}
        </p>
        {needsTruncate && (
          <button onClick={onToggle} className="text-[11px] mt-0.5" style={{ color: meta.color }}>
            {isExpanded ? 'Show less' : 'Read more'}
          </button>
        )}
        {v.hashtags?.length > 0 && (
          <p className="text-[11px] text-blue-500 mt-1">{v.hashtags.map((t: string) => `#${t}`).join(' ')}</p>
        )}
        {v.call_to_action && (
          <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-1">{v.call_to_action}</p>
        )}
      </div>
    </div>
  )
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
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<Record<number, boolean>>({})

  const userMedia: string | null = generatedContent?.user_media || null
  const hasImages = !!(generatedContent?.images?.length)

  if (!generatedContent?.variations?.length || (!hasImages && !userMedia)) {
    return <div className="text-center text-gray-500 py-20">No content generated yet</div>
  }

  const variations = generatedContent.variations
  const images = generatedContent.images || []
  const platforms: string[] = generatedContent.request_params?.platforms || ['facebook', 'instagram']
  const brandName = generatedContent.website_data?.title || ''
  const brandHandle = brandName ? brandName.toLowerCase().replace(/\s+/g, '') : 'yourbrand'

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
        body: JSON.stringify({ text: v.text, hashtags: v.hashtags, call_to_action: v.call_to_action, image_url: img?.url, platforms })
      })
    } catch { /* silent */ }
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
        body: JSON.stringify({ text: v.text, hashtags: v.hashtags, call_to_action: v.call_to_action, image_url: img?.url, platforms })
      })
      if (!res.ok) throw new Error('Save failed')
      setPublishedStatus(prev => ({ ...prev, [idx]: 'Saved to Library ✓' }))
    } catch { alert('Failed to save') }
    finally { setSavingIdx(null) }
  }

  const handleRegenerate = async (idx: number) => {
    if (!session || regeneratingIdx !== null) return
    setRegeneratingIdx(idx)
    try {
      const v = variations[idx]
      const rp = generatedContent.request_params || {}
      const res = await fetch(`${getApiUrl()}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          url: rp.url || '', keywords: rp.keywords || '', platforms: [v.platform || platforms[0]],
          image_size: rp.image_size || '1080x1080', style: rp.style || 'professional',
          target_audience: rp.target_audience || 'b2c', language: rp.language || 'en',
          include_emojis: rp.include_emojis ?? true, include_logo: rp.include_logo || false,
          account_id: rp.account_id || null
        })
      })
      if (!res.ok) throw new Error('Regeneration failed')
      const data = await res.json()
      const matchType = v.variant_type || 'storyteller'
      const newVar = data.variations?.find((nv: any) => nv.variant_type === matchType) || data.variations?.[0]
      if (newVar) {
        updateVariation(idx, newVar.text, newVar.hashtags || [], newVar.call_to_action || '')
      }
      if (data.images?.[0]?.url) {
        updateImage(idx, data.images[0].url)
      }
    } catch (e) {
      console.error('Regenerate failed:', e)
      alert('Failed to regenerate. Please try again.')
    } finally {
      setRegeneratingIdx(null)
    }
  }

  const handleTextSave = (text: string, hashtags: string[], cta: string) => {
    if (editingIdx !== null) updateVariation(editingIdx, text, hashtags, cta)
    setEditingIdx(null)
  }

  const handleImageUpdate = (url: string) => {
    if (editingImageIdx !== null) updateImage(editingImageIdx, url)
    setEditingImageIdx(null)
  }

  // Group variations by platform for "Choose Your Strategy" layout
  const platformGroups: Record<string, number[]> = {}
  variations.forEach((_: any, idx: number) => {
    const v = variations[idx]
    const plat = v.platform || platforms[idx % platforms.length]
    if (!platformGroups[plat]) platformGroups[plat] = []
    platformGroups[plat].push(idx)
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Action Bar */}
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

      {/* Platform Groups */}
      {Object.entries(platformGroups).map(([platform, indices]) => {
        const meta = PLATFORM_META[platform] || PLATFORM_META.facebook
        return (
          <div key={platform} className="space-y-3">
            {/* Platform Section Header */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: meta.color }}>
                {meta.label[0]}
              </div>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">{meta.label}</h3>
              <span className="text-xs text-gray-400">Choose Your Strategy</span>
            </div>

            {/* Variant Cards Grid */}
            <div className={`grid ${indices.length >= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-md'} gap-4`}>
              {indices.map((idx) => {
                const v = variations[idx]
                const img = images[idx] || images[0] || (userMedia ? { url: userMedia, size: '', dimensions: '' } : null)
                const fullText = getFullText(v)
                const overLimit = fullText.length > meta.charLimit
                const status = publishedStatus[idx]
                const vtype = v.variant_type || (idx % 2 === 0 ? 'storyteller' : 'closer')
                const vtMeta = VARIANT_LABELS[vtype] || VARIANT_LABELS.storyteller
                const isExpanded = expandedIdx[idx] || false
                const isRegenerating = regeneratingIdx === idx

                return (
                  <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col">
                    {/* Variant Badge + Char Bar */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700" style={{ background: `${vtMeta.color}08` }}>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: vtMeta.color }}>
                        {vtMeta.emoji} {vtMeta.label}
                      </span>
                      <div className="flex-1">
                        <CharBar current={fullText.length} max={meta.charLimit} />
                      </div>
                      {overLimit && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                      <button
                        onClick={() => handleRegenerate(idx)}
                        disabled={isRegenerating}
                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-40"
                        title="Regenerate this variant"
                      >
                        <Wand2 size={14} className={`${isRegenerating ? 'animate-spin text-purple-500' : 'text-gray-400 hover:text-purple-500'}`} />
                      </button>
                    </div>

                    {/* Strategist's Note */}
                    {v.strategist_note && (
                      <div className="mx-3 mt-2 mb-1 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40">
                        <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
                          <span className="font-semibold">🧠 Strategy:</span> {v.strategist_note}
                        </p>
                      </div>
                    )}

                    {/* Social Mockup */}
                    <div className="flex-1">
                      {platform === 'instagram' ? (
                        <InstagramMockup v={v} img={img} brandHandle={brandHandle} isExpanded={isExpanded}
                          onToggle={() => setExpandedIdx(prev => ({ ...prev, [idx]: !isExpanded }))}
                          onEditImage={!userMedia ? () => setEditingImageIdx(idx) : undefined} />
                      ) : platform === 'facebook' ? (
                        <FacebookMockup v={v} img={img} brandHandle={brandName || 'Your Brand'} isExpanded={isExpanded}
                          onToggle={() => setExpandedIdx(prev => ({ ...prev, [idx]: !isExpanded }))}
                          onEditImage={!userMedia ? () => setEditingImageIdx(idx) : undefined} />
                      ) : (
                        <GenericMockup v={v} img={img} meta={meta} isExpanded={isExpanded}
                          onToggle={() => setExpandedIdx(prev => ({ ...prev, [idx]: !isExpanded }))}
                          onEditImage={!userMedia ? () => setEditingImageIdx(idx) : undefined} />
                      )}
                    </div>

                    {/* Status */}
                    {status && (
                      <div className="px-3 pb-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                          <Check size={10} /> {status}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <button onClick={() => setEditingIdx(idx)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                      <button onClick={() => handleSave(idx)} disabled={savingIdx === idx}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition disabled:opacity-50"
                      >
                        <BookmarkPlus size={11} /> {savingIdx === idx ? '...' : 'Save'}
                      </button>
                      <div className="flex-1" />
                      <button onClick={() => setSchedulingIdx(idx)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <Calendar size={11} /> Schedule
                      </button>
                      <button onClick={() => setPostingIdx(idx)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-white transition"
                        style={{ background: meta.color }}
                      >
                        <Send size={11} /> Publish
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Modals */}
      {editingIdx !== null && (
        <PostEditModal
          isOpen onClose={() => setEditingIdx(null)}
          initialText={variations[editingIdx].text}
          initialHashtags={variations[editingIdx].hashtags}
          initialCTA={variations[editingIdx].call_to_action}
          onSave={handleTextSave}
          language={generatedContent.request_params?.language || 'en'}
        />
      )}
      {editingImageIdx !== null && (
        <ImageEditModal
          isOpen onClose={() => setEditingImageIdx(null)}
          currentImage={(images[editingImageIdx] || images[0])?.url}
          websiteData={generatedContent.website_data || {}}
          postText={variations[editingImageIdx].text}
          platform={variations[editingImageIdx].platform || platforms[0]}
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
          prefilledData={{ text: getFullText(variations[postingIdx]), imageUrl: (images[postingIdx] || images[0])?.url }}
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
            text: variations[schedulingIdx].text, hashtags: variations[schedulingIdx].hashtags,
            cta: variations[schedulingIdx].call_to_action || '',
            imageUrl: (images[schedulingIdx] || images[0])?.url,
          }}
          platforms={platforms}
        />
      )}
    </div>
  )
}
