import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Globe, Upload, X, Image as ImageIcon, Check, AlertCircle } from 'lucide-react'
import { useAccount } from '../contexts/AccountContext'

/* ── Platform SVG icons ────────────────────────────────────────── */
const PlatformIcon = ({ id, size = 18 }: { id: string; size?: number }) => {
  const s = size
  const icons: Record<string, JSX.Element> = {
    facebook: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    ),
    instagram: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
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
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
    ),
  }
  return icons[id] || null
}

/* ── Platform definitions ─────────────────────────────────────── */
const PLATFORMS = [
  { id: 'facebook',        label: 'Facebook',        color: '#1877F2' },
  { id: 'instagram',       label: 'Instagram',       color: '#E4405F' },
  { id: 'linkedin',        label: 'LinkedIn',        color: '#0A66C2' },
  { id: 'tiktok',          label: 'TikTok',          color: '#010101' },
  { id: 'x',               label: 'X (Twitter)',     color: '#1DA1F2' },
  { id: 'google_business', label: 'Google Business', color: '#4285F4' },
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
      uploaded_image: null,
    }
  }

  const [form, setForm] = useState<GenerateFormData>(loadDraft)
  const [imagePreview, setImagePreview] = useState<string | null>(form.uploaded_image || null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const removeImage = () => {
    setImagePreview(null)
    set('uploaded_image', null)
    if (fileRef.current) fileRef.current.value = ''
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
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                    style={{ background: active ? p.color : '#9CA3AF' }}
                  >
                    <PlatformIcon id={p.id} size={16} />
                  </span>
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

        {/* ── 4. Image upload ──────────────────────────────────── */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Add Image <span className="text-xs font-normal text-gray-400">(optional)</span>
          </label>

          {imagePreview ? (
            <div className="relative inline-block">
              <img src={imagePreview} alt="upload" className="w-32 h-32 object-cover rounded-xl border dark:border-gray-600" />
              <button type="button" onClick={removeImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition"
              >
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
                dragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Click or drag an image here</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">JPG, PNG, WebP · Max 10 MB</span>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {!imagePreview && (
            <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-1">
              <ImageIcon size={12} /> Or let AI generate one for you
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
