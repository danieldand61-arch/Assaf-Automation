import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Globe, Upload, X, Image as ImageIcon, Check, AlertCircle, Film, FileImage } from 'lucide-react'
import { useAccount } from '../contexts/AccountContext'

/* ── Platform SVG icons ────────────────────────────────────────── */
const PlatformIcon = ({ id, size = 18 }: { id: string; size?: number }) => {
  const s = size
  const icons: Record<string, JSX.Element> = {
    facebook: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    ),
    instagram: (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <defs>
          <radialGradient id="ig1" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/>
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#ig1)"/>
        <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="#fff" strokeWidth="1.8"/>
        <circle cx="12" cy="12" r="4.5" fill="none" stroke="#fff" strokeWidth="1.8"/>
        <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
      </svg>
    ),
    linkedin: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    ),
    tiktok: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
    ),
    x: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    ),
    google_business: (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  }
  return icons[id] || null
}

/* ── Platform definitions ─────────────────────────────────────── */
const PLATFORMS = [
  { id: 'facebook',        label: 'Facebook',        color: '#1877F2', hasLogo: false },
  { id: 'instagram',       label: 'Instagram',       color: '#E4405F', hasLogo: true },
  { id: 'linkedin',        label: 'LinkedIn',        color: '#0A66C2', hasLogo: false },
  { id: 'tiktok',          label: 'TikTok',          color: '#000000', hasLogo: false },
  { id: 'x',               label: 'X',               color: '#000000', hasLogo: false },
  { id: 'google_business', label: 'Google',          color: '#4285F4', hasLogo: true },
] as const

const IMAGE_SIZES = [
  { value: '1080x1080', label: '1:1 Square (1080×1080)' },
  { value: '1080x1350', label: '4:5 Portrait (1080×1350)' },
  { value: '1080x1920', label: '9:16 Story / Reel (1080×1920)' },
  { value: '1200x628',  label: '16:9 Landscape (1200×628)' },
]

const STYLES = [
  { value: 'professional',   label: 'Professional' },
  { value: 'casual',         label: 'Casual & Fun' },
  { value: 'bold',           label: 'Bold & Vibrant' },
  { value: 'minimal',        label: 'Minimal & Clean' },
]

const LANGUAGES = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'he', label: '🇮🇱 עברית' },
  { value: 'fr', label: '🇫🇷 Français' },
]

const AUDIENCES = [
  { value: 'b2c',       label: 'B2C (Consumers)' },
  { value: 'b2b',       label: 'B2B (Business)' },
  { value: 'local',     label: 'Local Community' },
]

const DRAFT_KEY = 'joyo_draft_form'

/* ── Types ────────────────────────────────────────────────────── */
export interface GenerateFormData {
  url: string
  keywords: string
  platforms: string[]
  image_size: string
  style: string
  language: string
  target_audience: string
  include_emojis: boolean
  include_logo: boolean
  uploaded_image?: string | null
  media_file?: string | null
  media_type?: 'none' | 'ai_reference' | 'direct_media'
  post_type?: 'post' | 'reel' | 'story'
}

interface InputSectionProps {
  onGenerate: (data: GenerateFormData) => void
  savedForm?: GenerateFormData | null
}

/* ── Component ────────────────────────────────────────────────── */
export function InputSection({ onGenerate, savedForm }: InputSectionProps) {
  const { activeAccount } = useAccount()
  const hasLogo = !!(activeAccount?.logo_url)

  const loadDraft = (): GenerateFormData => {
    if (savedForm) return savedForm
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return {
      url: '', keywords: '', platforms: ['facebook', 'instagram'],
      image_size: '1080x1080', style: 'professional', language: 'en',
      target_audience: 'b2c', include_emojis: true, include_logo: false,
      uploaded_image: null, media_file: null, media_type: 'none', post_type: 'post',
    }
  }

  const [form, setForm] = useState<GenerateFormData>(loadDraft)
  const [imagePreview, setImagePreview] = useState<string | null>(form.uploaded_image || null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(form.media_file || null)
  const [mediaIsVideo, setMediaIsVideo] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<HTMLInputElement>(null)

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    }, 500)
    return () => clearTimeout(timer)
  }, [form])

  // Restore from savedForm when coming back
  useEffect(() => {
    if (savedForm) {
      setForm(savedForm)
      setImagePreview(savedForm.uploaded_image || null)
    }
  }, [savedForm])

  const set = useCallback(<K extends keyof GenerateFormData>(key: K, val: GenerateFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }, [])

  const togglePlatform = (id: string) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(id)
        ? prev.platforms.filter(p => p !== id)
        : [...prev.platforms, id]
    }))
  }

  const handleFile = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      alert('Please upload a JPG, PNG, or WebP image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      setImagePreview(url)
      set('uploaded_image', url)
      set('media_type', 'ai_reference')
    }
    reader.readAsDataURL(file)
  }

  const handleMediaFile = (file: File) => {
    const isImage = file.type.match(/^image\/(jpeg|png|webp|gif)$/)
    const isVideo = file.type.match(/^video\/(mp4|quicktime|webm|mov)$/)
    if (!isImage && !isVideo) {
      alert('Upload JPG, PNG, WebP, GIF, MP4, MOV, or WebM')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('File must be under 50 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      setMediaPreview(url)
      setMediaIsVideo(!!isVideo)
      set('media_file', url)
      set('media_type', 'direct_media')
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImagePreview(null)
    set('uploaded_image', null)
    set('media_type', 'none')
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeMedia = () => {
    setMediaPreview(null)
    setMediaIsVideo(false)
    set('media_file', null)
    set('media_type', 'none')
    if (mediaRef.current) mediaRef.current.value = ''
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.platforms.length) { alert('Select at least one platform'); return }
    if (!form.url.trim() && !form.keywords.trim()) { alert('Enter a URL or describe your post'); return }
    onGenerate(form)
  }

  const canGenerate = form.platforms.length > 0 && (form.url.trim() || form.keywords.trim())

  /* ── select / input class ────────────────────────────────────── */
  const fieldCls = 'w-full px-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition text-sm'

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 space-y-6">

        {/* ── 1. Platforms ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Platforms <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PLATFORMS.map(p => {
              const active = form.platforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className="relative flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold transition border-2"
                  style={{
                    borderColor: active ? p.color : 'transparent',
                    background: active ? `${p.color}15` : undefined,
                    color: active ? p.color : undefined,
                  }}
                >
                  {active && (
                    <Check size={12} className="absolute top-1 right-1" style={{ color: p.color }} />
                  )}
                  {p.hasLogo ? (
                    <span className="w-8 h-8 flex items-center justify-center" style={{ opacity: active ? 1 : 0.5 }}>
                      <PlatformIcon id={p.id} size={28} />
                    </span>
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ background: p.color, opacity: active ? 1 : 0.5 }}>
                      <PlatformIcon id={p.id} size={16} />
                    </span>
                  )}
                  {p.label.split(' ')[0]}
                </button>
              )
            })}
          </div>
          {!form.platforms.length && (
            <p className="text-xs text-red-500 mt-1">Select at least one platform</p>
          )}
        </div>

        {/* ── 2. URL ───────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Globe className="inline w-4 h-4 mr-1" /> Website / Social URL
          </label>
          <input
            type="text"
            value={form.url}
            onChange={e => set('url', e.target.value)}
            placeholder="yourbusiness.com or instagram.com/yourpage"
            className={fieldCls}
          />
        </div>

        {/* ── 3. What's on your mind? ──────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            What's on your mind?
          </label>
          <textarea
            value={form.keywords}
            onChange={e => set('keywords', e.target.value)}
            placeholder="Tell us what you'd like to post about..."
            rows={3}
            className={`${fieldCls} resize-none`}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Keyword, description, promotion, anything...
          </p>
        </div>

        {/* ── 4. Post type ──────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Post Type</label>
          <div className="flex gap-2">
            {([
              { id: 'post' as const, label: 'Post', icon: FileImage },
              { id: 'reel' as const, label: 'Reel', icon: Film },
              { id: 'story' as const, label: 'Story', icon: Sparkles },
            ]).map(pt => {
              const active = (form.post_type || 'post') === pt.id
              return (
                <button key={pt.id} type="button" onClick={() => set('post_type', pt.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition border-2"
                  style={{ borderColor: active ? '#4A7CFF' : 'transparent', background: active ? '#4A7CFF10' : undefined, color: active ? '#4A7CFF' : undefined }}>
                  <pt.icon size={16} /> {pt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 5. Media ──────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Media <span className="text-xs font-normal text-gray-400">(optional)</span>
          </label>

          {/* Toggle: AI reference vs direct media */}
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => { set('media_type', 'ai_reference'); removeMedia() }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition"
              style={{ borderColor: form.media_type === 'ai_reference' ? '#4A7CFF' : undefined, background: form.media_type === 'ai_reference' ? '#4A7CFF10' : undefined, color: form.media_type === 'ai_reference' ? '#4A7CFF' : undefined }}>
              <ImageIcon size={14} /> Reference for AI image
            </button>
            <button type="button" onClick={() => { set('media_type', 'direct_media'); removeImage() }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition"
              style={{ borderColor: form.media_type === 'direct_media' ? '#4A7CFF' : undefined, background: form.media_type === 'direct_media' ? '#4A7CFF10' : undefined, color: form.media_type === 'direct_media' ? '#4A7CFF' : undefined }}>
              <Film size={14} /> Upload my media
            </button>
          </div>

          {/* AI reference image upload */}
          {form.media_type === 'ai_reference' && (
            <>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="upload" className="w-32 h-32 object-cover rounded-xl border dark:border-gray-600" />
                  <button type="button" onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                  onClick={() => fileRef.current?.click()}
                  className={`flex flex-col items-center gap-2 py-6 border-2 border-dashed rounded-xl cursor-pointer transition ${
                    dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}>
                  <Upload size={24} className="text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Upload a reference image for AI</span>
                  <span className="text-xs text-gray-400">JPG, PNG, WebP · Max 10 MB</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              {!imagePreview && (
                <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <ImageIcon size={12} /> AI will use this as inspiration for the generated image
                </p>
              )}
            </>
          )}

          {/* Direct media upload (video/image) */}
          {form.media_type === 'direct_media' && (
            <>
              {mediaPreview ? (
                <div className="relative inline-block">
                  {mediaIsVideo ? (
                    <video src={mediaPreview} className="w-40 h-32 object-cover rounded-xl border dark:border-gray-600" muted />
                  ) : (
                    <img src={mediaPreview} alt="media" className="w-32 h-32 object-cover rounded-xl border dark:border-gray-600" />
                  )}
                  <button type="button" onClick={removeMedia}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition">
                    <X size={14} />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
                    {mediaIsVideo ? 'VIDEO' : 'IMAGE'}
                  </span>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleMediaFile(f) }}
                  onClick={() => mediaRef.current?.click()}
                  className={`flex flex-col items-center gap-2 py-6 border-2 border-dashed rounded-xl cursor-pointer transition ${
                    dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}>
                  <Upload size={24} className="text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Upload your image or video</span>
                  <span className="text-xs text-gray-400">JPG, PNG, GIF, MP4, MOV, WebM · Max 50 MB</span>
                </div>
              )}
              <input ref={mediaRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaFile(f) }} />
              <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Film size={12} /> This will be used as-is for your post (AI generates only the caption)
              </p>
            </>
          )}

          {/* No media selected */}
          {(!form.media_type || form.media_type === 'none') && (
            <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
              <ImageIcon size={12} /> Select an option above or let AI generate an image for you
            </p>
          )}
        </div>

        {/* ── 5-8. Dropdowns row ───────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Image Size</label>
            <select value={form.image_size} onChange={e => set('image_size', e.target.value)} className={fieldCls}>
              {IMAGE_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Style</label>
            <select value={form.style} onChange={e => set('style', e.target.value)} className={fieldCls}>
              {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Language</label>
            <select value={form.language} onChange={e => set('language', e.target.value)} className={fieldCls}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Target Audience</label>
            <select value={form.target_audience} onChange={e => set('target_audience', e.target.value)} className={fieldCls}>
              {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── 9. Toggles ───────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.include_emojis} onChange={e => set('include_emojis', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include Emojis</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.include_logo}
                onChange={e => {
                  const checked = e.target.checked
                  set('include_logo', checked)
                }}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include Logo</span>
            </label>
          </div>

          {/* Logo prompt when no logo is uploaded */}
          {form.include_logo && !hasLogo && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold mb-1">No logo found</p>
                <p>Upload your logo in <span className="underline font-medium">Settings → Account</span> so it can be overlaid on generated images.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── 10. Generate button ──────────────────────────────── */}
        <button
          type="submit"
          disabled={!canGenerate}
          className="w-full py-4 rounded-xl font-bold text-lg text-white transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canGenerate
              ? 'linear-gradient(135deg, #4A7CFF 0%, #7C3AED 100%)'
              : undefined,
            boxShadow: canGenerate ? '0 4px 20px rgba(74,124,255,0.4)' : undefined,
          }}
        >
          <Sparkles className="w-5 h-5" />
          {canGenerate
            ? `✨ Generate Content for ${form.platforms.length} Platform${form.platforms.length > 1 ? 's' : ''}`
            : 'Select platforms to generate'
          }
        </button>
      </form>
    </div>
  )
}
