import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Sparkles, Globe, Upload, X, Check, AlertCircle, Film, Zap, Palette } from 'lucide-react'
import { useAccount } from '../contexts/AccountContext'
import { useApp } from '../contexts/AppContext'

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

/* ── Static data (id + color only, labels resolved via t()) ───── */
const PLATFORM_IDS = [
  { id: 'facebook',        color: '#1877F2', hasLogo: false },
  { id: 'instagram',       color: '#E4405F', hasLogo: true },
  { id: 'linkedin',        color: '#0A66C2', hasLogo: false },
  { id: 'tiktok',          color: '#000000', hasLogo: false },
  { id: 'x',               color: '#000000', hasLogo: false },
  { id: 'google_business', color: '#4285F4', hasLogo: true },
] as const

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
  include_people: boolean
  graphic_mode: boolean
  uploaded_image?: string | null
  media_file?: string | null
  use_custom_url?: boolean
}

interface InputSectionProps {
  onGenerate: (data: GenerateFormData) => void
  savedForm?: GenerateFormData | null
}

/* ── Toggle switch ────────────────────────────────────────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#4A7CFF]' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

/* ── Component ────────────────────────────────────────────────── */
export function InputSection({ onGenerate, savedForm }: InputSectionProps) {
  const { activeAccount } = useAccount()
  const { t } = useApp()
  const hasLogo = !!(activeAccount?.logo_url)

  const PLATFORMS = useMemo(() => {
    const labelMap: Record<string, string> = {
      facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn',
      tiktok: 'TikTok', x: 'X', google_business: 'Google',
    }
    return PLATFORM_IDS.map(p => ({ ...p, label: labelMap[p.id] }))
  }, [])

  const IMAGE_SIZES = useMemo(() => [
    { value: '1080x1080', label: t('imageSizeSquare1080') },
    { value: '1080x1350', label: t('imageSizePortrait1080') },
    { value: '1200x628',  label: t('imageSizeLandscape1200') },
    { value: '1080x1920', label: t('imageSizeStory1080') },
  ], [t])

  const STYLES = useMemo(() => [
    { value: 'professional', label: t('voiceProfessional'), preview: t('voiceProfessionalPreview') },
    { value: 'casual',       label: t('voiceCasual'),       preview: t('voiceCasualPreview') },
    { value: 'bold',         label: t('voiceBold'),         preview: t('voiceBoldPreview') },
    { value: 'minimal',      label: t('voiceMinimal'),      preview: t('voiceMinimalPreview') },
  ], [t])

  const LANGUAGES = useMemo(() => [
    { value: 'en', label: t('langEnglishUS') },
    { value: 'es', label: t('langEspanol') },
    { value: 'he', label: t('langHebrew') },
    { value: 'fr', label: t('langFrancais') },
  ], [t])

  const AUDIENCES = useMemo(() => [
    { value: 'b2c',    label: t('audienceB2C') },
    { value: 'b2b',    label: t('audienceB2B') },
    { value: 'local',  label: t('audienceLocal') },
    { value: 'gen_z',  label: t('audienceGenZ') },
  ], [t])

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
      include_people: false, graphic_mode: false, uploaded_image: null, media_file: null,
    }
  }

  const [form, setForm] = useState<GenerateFormData>(loadDraft)
  const [imagePreview, setImagePreview] = useState<string | null>(form.uploaded_image || null)
  const [mediaIsVideo, setMediaIsVideo] = useState(() => !!form.media_file?.startsWith('data:video/'))
  const [mediaPreview, setMediaPreview] = useState<string | null>(() => {
    const mf = form.media_file
    if (!mf) return null
    if (mf.startsWith('data:video/')) {
      const [header, b64] = mf.split(',')
      const mime = header.match(/:(.*?);/)?.[1] || 'video/mp4'
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      return URL.createObjectURL(new Blob([arr], { type: mime }))
    }
    return mf
  })
  const [showCustomUrl, setShowCustomUrl] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<HTMLInputElement>(null)

  const onboardingUrl = activeAccount?.metadata?.website_url || activeAccount?.metadata?.brand_kit?.website_url || ''

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    }, 500)
    return () => clearTimeout(timer)
  }, [form])

  useEffect(() => {
    if (savedForm) {
      setForm(savedForm)
      setImagePreview(savedForm.uploaded_image || null)
      const mf = savedForm.media_file
      if (mf && mf.startsWith('http')) {
        const isVid = mf.includes('.mp4') || mf.includes('video') || mf.includes('/mp4')
        setMediaPreview(mf)
        setMediaIsVideo(isVid)
      } else if (!mf) {
        setMediaPreview(null)
        setMediaIsVideo(false)
      }
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
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) { alert(t('uploadImageAlert')); return }
    if (file.size > 10 * 1024 * 1024) { alert(t('imageSizeAlert')); return }
    const reader = new FileReader()
    reader.onload = (e) => { const url = e.target?.result as string; setImagePreview(url); set('uploaded_image', url) }
    reader.readAsDataURL(file)
  }

  const handleMediaFile = (file: File) => {
    const isImage = file.type.match(/^image\/(jpeg|png|webp|gif)$/)
    const isVideo = file.type.match(/^video\/(mp4|quicktime|webm|mov)$/)
    if (!isImage && !isVideo) { alert('Upload JPG, PNG, WebP, GIF, MP4, MOV, or WebM'); return }
    const maxMB = isVideo ? 20 : 10
    if (file.size > maxMB * 1024 * 1024) { alert(`${t('fileSizeAlert')} ${maxMB} ${t('mb')}`); return }
    if (isVideo) {
      const blobUrl = URL.createObjectURL(file)
      setMediaPreview(blobUrl); setMediaIsVideo(true)
      const reader = new FileReader()
      reader.onload = (e) => set('media_file', e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      const reader = new FileReader()
      reader.onload = (e) => { const url = e.target?.result as string; setMediaPreview(url); setMediaIsVideo(false); set('media_file', url) }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => { setImagePreview(null); set('uploaded_image', null); if (fileRef.current) fileRef.current.value = '' }
  const removeMedia = () => { setMediaPreview(null); setMediaIsVideo(false); set('media_file', null); if (mediaRef.current) mediaRef.current.value = '' }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.platforms.length) { alert(t('selectPlatformAlert')); return }
    const effectiveUrl = showCustomUrl ? form.url.trim() : onboardingUrl
    if (!form.media_file && !effectiveUrl && !form.keywords.trim()) { alert(t('describePostAlert')); return }
    if (form.media_file && !form.keywords.trim()) { alert(t('writeCaptionAlert')); return }
    onGenerate({ ...form, url: effectiveUrl, use_custom_url: showCustomUrl })
  }

  const canGenerate = form.platforms.length > 0 && ((showCustomUrl ? form.url.trim() : onboardingUrl) || form.keywords.trim() || !!form.media_file)

  const selectCls = 'w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A7CFF]/20 focus:border-[#4A7CFF] outline-none transition'

  return (
    <div className="max-w-7xl mx-auto w-full pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-white tracking-tight">{t('commandCenter')}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-base mt-1">{t('commandCenterDesc')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ─── LEFT COLUMN (60%) ─────────────────────────────── */}
          <div className="w-full lg:w-[60%] flex flex-col gap-6">

            {/* Platforms */}
            <section className="bg-white dark:bg-gray-800/60 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">{t('targetPlatforms')}</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PLATFORMS.map(p => {
                  const active = form.platforms.includes(p.id)
                  return (
                    <button key={p.id} type="button" onClick={() => togglePlatform(p.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${active ? 'border-[#4A7CFF] bg-[#4A7CFF]/5 text-[#4A7CFF]' : 'border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-[#4A7CFF]/40 hover:text-[#4A7CFF]'}`}>
                      {active && <Check size={10} className="absolute" style={{ marginTop: -24, marginLeft: 24 }} />}
                      {p.hasLogo ? (
                        <span className="w-6 h-6 flex items-center justify-center" style={{ opacity: active ? 1 : 0.5 }}>
                          <PlatformIcon id={p.id} size={22} />
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                          style={{ background: p.color, opacity: active ? 1 : 0.5 }}>
                          <PlatformIcon id={p.id} size={12} />
                        </span>
                      )}
                      <span className="text-[11px] font-bold">{p.label.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Main editor area */}
            <section className="bg-white dark:bg-gray-800/60 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex-1 flex flex-col gap-5">

              {/* URL */}
              {!mediaPreview && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('websiteUrlOptional')}</label>
                  {!showCustomUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                      <Globe size={16} className="text-gray-400 flex-shrink-0" />
                      {onboardingUrl ? (
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{t('using')}: <span className="font-semibold text-gray-700 dark:text-gray-300">{onboardingUrl}</span></span>
                      ) : (
                        <span className="text-sm text-gray-400 flex-1">{t('noWebsiteLinked')}</span>
                      )}
                      <button type="button" onClick={() => setShowCustomUrl(true)}
                        className="text-xs font-semibold text-[#4A7CFF] hover:underline whitespace-nowrap">
                        {t('useDifferentUrl')}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" value={form.url} onChange={e => set('url', e.target.value)}
                          placeholder="https://your-product.com/feature-page"
                          className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A7CFF]/20 focus:border-[#4A7CFF] outline-none transition text-sm" />
                      </div>
                      <button type="button" onClick={() => { setShowCustomUrl(false); set('url', '') }}
                        className="text-xs font-semibold text-gray-400 hover:text-gray-600">
                        {t('backToMySite')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Keywords / prompt */}
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {mediaPreview ? t('whatIsPostAbout') : t('whatsOnYourMind')}
                </label>
                <textarea value={form.keywords} onChange={e => set('keywords', e.target.value)}
                  placeholder={mediaPreview
                    ? 'Describe the topic or idea — AI will write the caption'
                    : "Describe the post you want to create... e.g. 'A professional announcement for our new summer collection launch with a focus on sustainability.'"}
                  className="flex-1 min-h-[120px] w-full p-5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A7CFF]/20 focus:border-[#4A7CFF] outline-none transition resize-none text-base leading-relaxed placeholder:text-gray-400" />
              </div>

              {/* Media */}
              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('mediaOptional')}</label>
                  <span className="text-[10px] font-semibold text-gray-400">{t('aiWillGenerate')}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* AI Generated */}
                  <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${imagePreview ? 'border-[#4A7CFF] bg-[#4A7CFF]/5' : 'border-gray-100 dark:border-gray-700 hover:border-[#4A7CFF]/40'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-[#8B5CF6]" />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{t('aiGeneratedImage')}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">{t('aiGeneratedImageDesc')}</p>
                    {imagePreview ? (
                      <div className="relative inline-block">
                        <img src={imagePreview} alt="ref" className="w-20 h-20 object-cover rounded-lg border dark:border-gray-600" />
                        <button type="button" onClick={removeImage} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"><X size={12} /></button>
                      </div>
                    ) : (
                      <div onClick={() => fileRef.current?.click()}
                        className="border-2 border-dashed border-[#4A7CFF]/30 rounded-lg p-4 flex flex-col items-center gap-1 hover:bg-[#4A7CFF]/5 transition-colors">
                        <Upload size={18} className="text-[#4A7CFF]/60" />
                        <span className="text-[10px] font-bold text-[#4A7CFF]">{t('uploadReference')}</span>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  </div>

                  {/* Use My Media */}
                  <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${mediaPreview ? 'border-green-500 bg-green-500/5' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-800/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Film size={16} className="text-gray-400" />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{t('useMyMedia')}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">{t('useMyMediaDesc')}</p>
                    {mediaPreview ? (
                      <div className="relative inline-block">
                        {mediaIsVideo ? (
                          <video src={mediaPreview!} className="w-20 h-20 object-cover rounded-lg border dark:border-gray-600" autoPlay muted loop playsInline />
                        ) : (
                          <img src={mediaPreview} alt="media" className="w-20 h-20 object-cover rounded-lg border dark:border-gray-600" />
                        )}
                        <button type="button" onClick={removeMedia} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"><X size={12} /></button>
                      </div>
                    ) : (
                      <div onClick={() => mediaRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-4 flex flex-col items-center gap-1 hover:border-gray-400 transition-colors">
                        <Upload size={18} className="text-gray-400" />
                        <span className="text-[10px] font-bold text-gray-400">{t('uploadPhotoVideo')}</span>
                      </div>
                    )}
                    <input ref={mediaRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaFile(f) }} />
                  </div>

                  {/* Graphic Design */}
                  <div onClick={() => set('graphic_mode', !form.graphic_mode)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${form.graphic_mode
                      ? 'border-violet-500 bg-violet-500/5 ring-1 ring-violet-300'
                      : 'border-gray-100 dark:border-gray-700 hover:border-violet-400 bg-gray-50 dark:bg-gray-800/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Palette size={16} className="text-violet-500" />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{t('graphicDesign')}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">{t('graphicDesignDesc')}</p>
                    <div className={`rounded-lg p-3 flex items-center justify-center gap-2 transition ${form.graphic_mode
                      ? 'bg-violet-100 dark:bg-violet-900/30' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
                      <Palette size={18} className={form.graphic_mode ? 'text-violet-600' : 'text-gray-400'} />
                      <span className={`text-[11px] font-bold ${form.graphic_mode ? 'text-violet-600' : 'text-gray-400'}`}>
                        {form.graphic_mode ? t('graphicModeOn') : t('enableGraphicMode')}
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            </section>
          </div>

          {/* ─── RIGHT COLUMN (40%) ─────────────────────────────── */}
          <div className="w-full lg:w-[40%] flex flex-col gap-5 relative">
            <div className="space-y-5 lg:pb-28">

              {/* Media Setup */}
              {!mediaPreview && (
                <div className="bg-white dark:bg-gray-800/60 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-[#4A7CFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <h3 className="font-bold text-gray-900 dark:text-white">{t('mediaSetup')}</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('aiGeneratedVisuals')}</span>
                      <Toggle checked={!form.media_file} onChange={() => {}} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('imageSize')}</label>
                      <select value={form.image_size} onChange={e => set('image_size', e.target.value)} className={selectCls}>
                        {IMAGE_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Strategy */}
              <div className="bg-white dark:bg-gray-800/60 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-[#4A7CFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  <h3 className="font-bold text-gray-900 dark:text-white">{t('strategy')}</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('brandVoice')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {STYLES.map(s => (
                        <button key={s.value} type="button" onClick={() => set('style', s.value)}
                          className={`text-left p-2.5 rounded-xl border-2 transition-all ${form.style === s.value
                            ? 'border-[#4A7CFF] bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
                        >
                          <span className="text-xs font-bold text-gray-900 dark:text-white block">{s.label}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 italic leading-tight block mt-0.5">{s.preview}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('language')}</label>
                      <select value={form.language} onChange={e => set('language', e.target.value)} className={selectCls}>
                        {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('audience')}</label>
                      <select value={form.target_audience} onChange={e => set('target_audience', e.target.value)} className={selectCls}>
                        {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-white dark:bg-gray-800/60 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={18} className="text-[#4A7CFF]" />
                  <h3 className="font-bold text-gray-900 dark:text-white">{t('toggles')}</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('includeEmojis')}</span>
                    <Toggle checked={form.include_emojis} onChange={v => set('include_emojis', v)} />
                  </div>
                  {!form.graphic_mode && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('includeLogo')}</span>
                      <Toggle checked={form.include_logo} onChange={v => set('include_logo', v)} />
                    </div>
                  )}
                  {!mediaPreview && !form.graphic_mode && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('includePeople')}</span>
                      <Toggle checked={form.include_people} onChange={v => set('include_people', v)} />
                    </div>
                  )}
                </div>

                {form.include_logo && !hasLogo && (
                  <div className="flex items-start gap-2 p-3 mt-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                    <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {t('logoWarning')} <span className="underline font-medium">{t('settingsAccount')}</span>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Generate Button */}
            <div className="lg:sticky lg:bottom-6 pt-4 bg-gradient-to-t from-gray-50 dark:from-gray-900 via-gray-50/95 dark:via-gray-900/95 to-transparent">
              <button type="submit" disabled={!canGenerate}
                className="w-full py-4 text-white rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: canGenerate ? 'linear-gradient(135deg, #4A7CFF 0%, #6366F1 50%, #8B5CF6 100%)' : '#94a3b8',
                  boxShadow: canGenerate ? '0 8px 30px rgba(74,124,255,0.35)' : undefined,
                }}>
                <Zap className="w-5 h-5" />
                {t('generateHighPerforming')}
              </button>
            </div>
          </div>
        </div>
      </form>

    </div>
  )
}
