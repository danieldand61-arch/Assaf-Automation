import { useState } from 'react'
import { Loader2, Download, Sparkles, RotateCcw, Palette } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useApp } from '../contexts/AppContext'
import { getApiUrl } from '../lib/api'

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

export default function GenerateCreative() {
  const { session } = useAuth()
  const { activeAccount } = useAccount()
  const { t } = useApp()

  const bk = activeAccount?.metadata?.brand_kit || {}

  const [headline, setHeadline] = useState('')
  const [subheadline, setSubheadline] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [style, setStyle] = useState('modern')
  const [bgStyle, setBgStyle] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1080x1080')
  const [includeProduct, setIncludeProduct] = useState(true)
  const [count, setCount] = useState(2)

  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ url: string; index: number; error?: string }[]>([])
  const [error, setError] = useState('')

  const brandName = bk.business_name || activeAccount?.name || ''
  const brandColors = bk.brand_colors || activeAccount?.brand_colors || []

  const handleGenerate = async () => {
    if (!headline.trim()) { setError(t('headlineRequired')); return }
    if (!session) { setError(t('pleaseSignIn')); return }
    setError('')
    setLoading(true)
    setResults([])

    try {
      const res = await fetch(`${getApiUrl()}/api/creative/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          headline: headline.trim(),
          subheadline: subheadline.trim() || undefined,
          cta_text: ctaText.trim() || t('shopNow'),
          product_description: productDesc.trim() || undefined,
          brand_name: brandName || undefined,
          brand_colors: brandColors.length ? brandColors : undefined,
          logo_url: bk.logo_url || activeAccount?.logo_url || undefined,
          style,
          aspect_ratio: aspectRatio,
          include_product_image: includeProduct,
          background_style: bgStyle || undefined,
          count,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      setResults(data.creatives || [])
    } catch (e: any) {
      setError(e.message || 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (url: string, idx: number) => {
    try {
      let blob: Blob
      if (url.startsWith('data:')) {
        const r = await fetch(url)
        blob = await r.blob()
      } else {
        const r = await fetch(url)
        blob = await r.blob()
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `creative_${idx + 1}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { /* silent */ }
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
        {/* Form — left 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
            {/* Brand pill */}
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
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('headline')} *</label>
              <input value={headline} onChange={e => setHeadline(e.target.value)} className={fieldCls} placeholder={t('placeholderHeadline')} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('subheadline')}</label>
              <input value={subheadline} onChange={e => setSubheadline(e.target.value)} className={fieldCls} placeholder={t('placeholderSubheadline')} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('productDescription')}</label>
              <textarea value={productDesc} onChange={e => setProductDesc(e.target.value)} rows={2} className={fieldCls + ' resize-none'} placeholder={t('placeholderProduct')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('ctaButtonText')}</label>
                <input value={ctaText} onChange={e => setCtaText(e.target.value)} className={fieldCls} placeholder={t('shopNow')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('variations')}</label>
                <select value={count} onChange={e => setCount(Number(e.target.value))} className={fieldCls}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>

            {/* Style */}
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

            {/* Background */}
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

            {/* Size */}
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

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeProduct} onChange={e => setIncludeProduct(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('includeProductVisual')}</span>
            </label>

            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

            <button onClick={handleGenerate} disabled={loading || !headline.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
              {loading ? <><Loader2 size={16} className="animate-spin" /> {t('generatingVideo')}</> : <><Sparkles size={16} /> {t('creativeStudio')}</>}
            </button>
          </div>
        </div>

        {/* Results — right 3 cols */}
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{results.length} {t('creativesGenerated')}</h3>
                <button onClick={handleGenerate} className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700">
                  <RotateCcw size={13} /> {t('regenerate')}
                </button>
              </div>
              <div className={`grid gap-4 ${results.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-2'}`}>
                {results.map((r, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-lg group">
                    <div className="relative">
                      <img src={r.url} alt={`Creative ${i + 1}`} className="w-full" />
                      <button onClick={() => handleDownload(r.url, i)}
                        className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80">
                        <Download size={16} />
                      </button>
                    </div>
                    {r.error && <p className="text-xs text-red-500 px-3 py-2">{r.error}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
