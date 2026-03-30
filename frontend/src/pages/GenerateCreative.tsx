import { useState, useRef } from 'react'
import { Loader2, Download, Sparkles, RotateCcw, Palette, Upload, X, Send, Calendar, BookmarkCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useApp } from '../contexts/AppContext'
import { getApiUrl } from '../lib/api'
import { PostToSocial } from '../components/PostToSocial'
import { SchedulePostModal } from '../components/SchedulePostModal'

const STYLE_OPTIONS = [
  { id: 'modern', key: 'styleModern' as const, emoji: '🔵' },
  { id: 'minimal', key: 'styleMinimal' as const, emoji: '⚪' },
  { id: 'bold', key: 'styleBold' as const, emoji: '🔴' },
  { id: 'luxury', key: 'styleLuxury' as const, emoji: '✨' },
  { id: 'playful', key: 'stylePlayful' as const, emoji: '🟡' },
]

const BG_OPTIONS = [
  { id: '', key: 'bgAuto' as const },
  { id: 'sand', key: 'bgSand' as const },
  { id: 'marble', key: 'bgMarble' as const },
  { id: 'fabric', key: 'bgFabric' as const },
  { id: 'gradient', key: 'bgGradient' as const },
  { id: 'solid', key: 'bgSolid' as const },
  { id: 'nature', key: 'bgNature' as const },
]

const SIZE_OPTIONS = [
  { id: '1080x1080', key: 'sizeSquare' as const },
  { id: '1080x1350', key: 'sizePortrait' as const },
  { id: '1080x1920', key: 'sizeStory' as const },
  { id: '1200x628', key: 'sizeLandscape' as const },
]

interface CreativeResult {
  url: string
  index: number
  error?: string
  headline?: string
  subheadline?: string
}

export default function GenerateCreative() {
  const { session } = useAuth()
  const { activeAccount } = useAccount()
  const { t } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  const bk = activeAccount?.metadata?.brand_kit || {}

  const [productDesc, setProductDesc] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [userImageUrl, setUserImageUrl] = useState('')
  const [userImagePreview, setUserImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [style, setStyle] = useState('modern')
  const [bgStyle, setBgStyle] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1080x1080')
  const [count, setCount] = useState(2)
  const [lang, setLang] = useState('en')

  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CreativeResult[]>([])
  const [generatedCopy, setGeneratedCopy] = useState<{ headline: string; subheadline: string } | null>(null)
  const [error, setError] = useState('')

  // Post text per creative (for publishing)
  const [postTexts, setPostTexts] = useState<Record<number, string>>({})
  // Save/publish state per creative
  const [savedStatus, setSavedStatus] = useState<Record<number, string>>({})
  // Modals
  const [publishIdx, setPublishIdx] = useState<number | null>(null)
  const [scheduleIdx, setScheduleIdx] = useState<number | null>(null)

  const brandName = bk.business_name || activeAccount?.name || ''
  const brandColors = bk.brand_colors || activeAccount?.brand_colors || []

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    if (!file.type.startsWith('image/')) { setError(t('uploadImageAlert')); return }
    if (file.size > 10 * 1024 * 1024) { setError(t('imageSizeAlert')); return }

    setUploadingImage(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${getApiUrl()}/api/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setUserImageUrl(data.url)
      setUserImagePreview(URL.createObjectURL(file))
    } catch {
      setUserImagePreview('')
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setUserImageUrl(dataUrl)
        setUserImagePreview(dataUrl)
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadingImage(false)
    }
  }

  const clearImage = () => {
    setUserImageUrl('')
    setUserImagePreview('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const saveToLibrary = async (idx: number, imageUrl: string, postText: string) => {
    if (!session) return
    setSavedStatus(prev => ({ ...prev, [idx]: t('savingToLibrary') }))
    try {
      const res = await fetch(`${getApiUrl()}/api/saved-posts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          text: postText,
          hashtags: [],
          call_to_action: ctaText.trim() || '',
          image_url: imageUrl,
          platforms: [],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedStatus(prev => ({ ...prev, [idx]: data.duplicate ? t('savedToLibrary') : t('savedToLibrary') }))
      }
    } catch { /* silent */ }
  }

  const handleGenerate = async () => {
    if (!productDesc.trim()) { setError(t('productDescRequired')); return }
    if (!session) { setError(t('pleaseSignIn')); return }
    setError('')
    setLoading(true)
    setResults([])
    setGeneratedCopy(null)
    setPostTexts({})
    setSavedStatus({})

    try {
      const res = await fetch(`${getApiUrl()}/api/creative/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          product_description: productDesc.trim(),
          user_image_url: userImageUrl || undefined,
          cta_text: ctaText.trim() || t('shopNow'),
          brand_name: brandName || undefined,
          brand_colors: brandColors.length ? brandColors : undefined,
          logo_url: bk.logo_url || activeAccount?.logo_url || undefined,
          style,
          aspect_ratio: aspectRatio,
          background_style: bgStyle || undefined,
          count,
          language: lang,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      const creatives: CreativeResult[] = data.creatives || []
      setResults(creatives)
      if (data.copy) setGeneratedCopy(data.copy)

      // Auto-save each creative to library
      for (const c of creatives) {
        if (!c.error && c.url) {
          const text = data.copy ? `${data.copy.headline}\n\n${data.copy.subheadline}` : ''
          setPostTexts(prev => ({ ...prev, [c.index]: text }))
          saveToLibrary(c.index, c.url, text)
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (url: string, idx: number) => {
    try {
      const r = await fetch(url)
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `creative_${idx + 1}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { /* silent */ }
  }

  const getPublishData = (idx: number) => {
    const r = results[idx]
    if (!r) return null
    const text = postTexts[idx] || ''
    return { text, imageUrl: r.url }
  }

  const getScheduleData = (idx: number) => {
    const r = results[idx]
    if (!r) return null
    return {
      text: postTexts[idx] || '',
      hashtags: [] as string[],
      cta: ctaText.trim() || '',
      imageUrl: r.url,
    }
  }

  const fieldCls = "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition text-sm"

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
          <Palette size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('creativeStudio')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('creativeStudioDesc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
            {brandName && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 rounded-lg w-fit">
                {bk.logo_url && <img src={bk.logo_url} alt="" className="w-5 h-5 rounded object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">{brandName}</span>
                {brandColors.slice(0, 3).map((c: string, i: number) => (
                  <div key={i} className="w-3.5 h-3.5 rounded-full border border-gray-200 dark:border-gray-600" style={{ background: c }} />
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('productDescription')} *</label>
              <textarea value={productDesc} onChange={e => setProductDesc(e.target.value)} rows={3} className={fieldCls + ' resize-none'} placeholder={t('placeholderProduct')} />
              <p className="text-[10px] text-gray-400 mt-1">{t('aiWillGenerateCopy')}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{t('referenceImage')}</label>
              {userImagePreview ? (
                <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                  <img src={userImagePreview} alt="" className="w-full max-h-40 object-cover" />
                  <button onClick={clearImage} className="absolute top-2 end-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploadingImage}
                  className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-xs font-medium text-gray-400 hover:border-violet-400 hover:text-violet-500 transition">
                  {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {t('uploadProductImage')}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <p className="text-[10px] text-gray-400 mt-1">{t('imageOptionalHint')}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('ctaButtonText')}</label>
                <input value={ctaText} onChange={e => setCtaText(e.target.value)} className={fieldCls} placeholder={t('shopNow')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('variations')}</label>
                <select value={count} onChange={e => setCount(Number(e.target.value))} className={fieldCls}>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('language')}</label>
                <select value={lang} onChange={e => setLang(e.target.value)} className={fieldCls}>
                  <option value="en">{t('langEnglishUS')}</option>
                  <option value="he">{t('langHebrew')}</option>
                  <option value="es">{t('langEspanol')}</option>
                  <option value="fr">{t('langFrancais')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{t('style')}</label>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_OPTIONS.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${style === s.id ? 'bg-violet-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                    {s.emoji} {t(s.key)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{t('background')}</label>
              <div className="flex flex-wrap gap-1.5">
                {BG_OPTIONS.map(b => (
                  <button key={b.id} onClick={() => setBgStyle(b.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${bgStyle === b.id ? 'bg-violet-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                    {t(b.key)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">{t('size')}</label>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_OPTIONS.map(s => (
                  <button key={s.id} onClick={() => setAspectRatio(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${aspectRatio === s.id ? 'bg-violet-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                    {t(s.key)}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

            <button onClick={handleGenerate} disabled={loading || !productDesc.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
              {loading ? <><Loader2 size={16} className="animate-spin" /> {t('generatingVideo')}</> : <><Sparkles size={16} /> {t('creativeStudio')}</>}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={40} className="animate-spin text-violet-500 mb-4" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t('creatingAdCreatives')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('thisMayTake')}</p>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center mb-4">
                <Palette size={28} className="text-violet-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-1">{t('yourCreativesHere')}</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">{t('fillBriefDesc')}</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-4">
              {generatedCopy && (
                <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1">{t('aiGeneratedCopy')}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{generatedCopy.headline}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{generatedCopy.subheadline}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{results.length} {t('creativesGenerated')}</h3>
                <button onClick={handleGenerate} className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700">
                  <RotateCcw size={13} /> {t('regenerate')}
                </button>
              </div>

              <div className={`grid gap-4 ${results.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-2'}`}>
                {results.map((r, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-lg">
                    {/* Image */}
                    <div className="relative group">
                      <img src={r.url} alt={`Creative ${i + 1}`} className="w-full" />
                      <button onClick={() => handleDownload(r.url, i)}
                        className="absolute top-3 end-3 w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80">
                        <Download size={16} />
                      </button>
                    </div>
                    {r.error && <p className="text-xs text-red-500 px-3 py-2">{r.error}</p>}

                    {/* Post text + actions */}
                    <div className="p-3 space-y-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('postTextLabel')}</label>
                        <textarea
                          value={postTexts[r.index] ?? ''}
                          onChange={e => setPostTexts(prev => ({ ...prev, [r.index]: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white rounded-lg text-xs resize-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition"
                          placeholder={t('postTextPlaceholder')}
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setPublishIdx(r.index)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
                        >
                          <Send size={11} /> {t('publish')}
                        </button>
                        <button
                          onClick={() => setScheduleIdx(r.index)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition"
                        >
                          <Calendar size={11} /> {t('schedule')}
                        </button>
                        {savedStatus[r.index] && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <BookmarkCheck size={11} /> {savedStatus[r.index]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Publish modal */}
      {publishIdx !== null && (() => {
        const d = getPublishData(publishIdx)
        if (!d) return null
        return (
          <PostToSocial
            isOpen
            onClose={() => setPublishIdx(null)}
            prefilledData={{ text: d.text, imageUrl: d.imageUrl }}
          />
        )
      })()}

      {/* Schedule modal */}
      {scheduleIdx !== null && (() => {
        const d = getScheduleData(scheduleIdx)
        if (!d) return null
        return (
          <SchedulePostModal
            isOpen
            onClose={() => setScheduleIdx(null)}
            postData={d}
          />
        )
      })()}
    </div>
  )
}
