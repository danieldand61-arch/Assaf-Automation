import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Globe, Upload, X, Check, AlertCircle, Film } from 'lucide-react'
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
  { value: '1080x1080', label: '1:1 Post (1080×1080)' },
  { value: '1080x1350', label: '4:5 Portrait (1080×1350)' },
  { value: '1080x1920', label: '9:16 Reel (1080×1920)' },
  { value: '1080x1920_story', label: '9:16 Story (1080×1920)' },
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
      uploaded_image: null, media_file: null,
    }
  }

  const [form, setForm] = useState<GenerateFormData>(loadDraft)
  const [imagePreview, setImagePreview] = useState<string | null>(form.uploaded_image || null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(form.media_file || null)
  const [mediaIsVideo, setMediaIsVideo] = useState(false)
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
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImagePreview(null)
    set('uploaded_image', null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeMedia = () => {
    setMediaPreview(null)
    setMediaIsVideo(false)
    set('media_file', null)
    if (mediaRef.current) mediaRef.current.value = ''
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.platforms.length) { alert('Select at least one platform'); return }
    if (!form.media_file && !form.url.trim() && !form.keywords.trim()) { alert('Enter a URL or describe your post'); return }
    if (form.media_file && !form.keywords.trim()) { alert('Write a caption or describe the post'); return }
    onGenerate(form)
  }

  const canGenerate = form.platforms.length > 0 && (form.url.trim() || form.keywords.trim() || !!form.media_file)

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

        {/* ── 2. URL (hidden when using own media) ──────────── */}
        {!mediaPreview && (
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
        )}

        {/* ── 3. Post text ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {mediaPreview ? 'What is the post about?' : "What's on your mind?"}
          </label>
          <textarea
            value={form.keywords}
            onChange={e => set('keywords', e.target.value)}
            placeholder={mediaPreview ? 'Describe the topic or idea — AI will write the caption' : "Tell us what you'd like to post about..."}
            rows={3}
            className={`${fieldCls} resize-none`}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {mediaPreview ? 'Just give the topic — AI writes the full caption for you' : 'Keyword, description, promotion, anything...'}
          </p>
        </div>

        {/* ── 4. Media ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Media <span className="text-xs font-normal text-gray-400">(optional)</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* Option A: AI generates image */}
            <div className="rounded-xl border dark:border-gray-600 p-3 space-y-2" style={{ background: imagePreview ? '#4A7CFF08' : undefined, borderColor: imagePreview ? '#4A7CFF' : undefined }}>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-purple-500" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">AI Generated Image</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-tight">Upload a reference — AI will generate a new image inspired by it</p>

              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="ref" className="w-24 h-24 object-cover rounded-lg border dark:border-gray-600" />
                  <button type="button" onClick={removeImage}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-1 py-4 border border-dashed rounded-lg cursor-pointer transition border-gray-300 dark:border-gray-600 hover:border-gray-400">
                  <Upload size={18} className="text-gray-400" />
                  <span className="text-[11px] text-gray-400">Upload reference</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>

            {/* Option B: Use own media as-is */}
            <div className="rounded-xl border dark:border-gray-600 p-3 space-y-2" style={{ background: mediaPreview ? '#10B98108' : undefined, borderColor: mediaPreview ? '#10B981' : undefined }}>
              <div className="flex items-center gap-2 mb-1">
                <Film size={14} className="text-green-500" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Use My Media</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-tight">Upload your photo/video — it goes directly into the post, AI writes only the caption</p>

              {mediaPreview ? (
                <div className="relative inline-block">
                  {mediaIsVideo ? (
                    <video src={mediaPreview} className="w-24 h-24 object-cover rounded-lg border dark:border-gray-600" muted />
                  ) : (
                    <img src={mediaPreview} alt="media" className="w-24 h-24 object-cover rounded-lg border dark:border-gray-600" />
                  )}
                  <button type="button" onClick={removeMedia}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                    <X size={12} />
                  </button>
                  <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold text-white bg-black/60 px-1 py-0.5 rounded">
                    {mediaIsVideo ? 'VIDEO' : 'IMAGE'}
                  </span>
                </div>
              ) : (
                <div onClick={() => mediaRef.current?.click()}
                  className="flex flex-col items-center gap-1 py-4 border border-dashed rounded-lg cursor-pointer transition border-gray-300 dark:border-gray-600 hover:border-gray-400">
                  <Upload size={18} className="text-gray-400" />
                  <span className="text-[11px] text-gray-400">Upload photo/video</span>
                </div>
              )}
              <input ref={mediaRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaFile(f) }} />
            </div>
          </div>

          {!imagePreview && !mediaPreview && (
            <p className="text-[11px] text-gray-400 mt-2 text-center">No media? AI will generate an image automatically</p>
          )}
        </div>

        {/* ── 5-8. Dropdowns row ───────────────────────────────── */}
        <div className={`grid gap-4 ${mediaPreview ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {!mediaPreview && (
            <>
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
            </>
          )}
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
