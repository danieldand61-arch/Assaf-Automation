import { useState } from 'react'
import { X, Loader2, Download, Type, Sparkles, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'

const STYLES = [
  { id: 'modern', label: 'Modern', font: 'system-ui, sans-serif', weight: '700', transform: 'none' as const },
  { id: 'bold', label: 'Bold', font: 'system-ui, sans-serif', weight: '900', transform: 'uppercase' as const },
  { id: 'minimal', label: 'Minimal', font: 'system-ui, sans-serif', weight: '300', transform: 'none' as const },
  { id: 'elegant', label: 'Elegant', font: 'Georgia, serif', weight: '600', transform: 'none' as const },
  { id: 'playful', label: 'Playful', font: '"Comic Sans MS", cursive', weight: '700', transform: 'none' as const },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  sourceImage: string | null
  brandColors?: string[]
  brandName?: string
  onImageReady?: (imageUrl: string) => void
}

export function GraphicTextModal({ isOpen, onClose, sourceImage, brandColors = [], brandName = '', onImageReady }: Props) {
  const { session } = useAuth()
  const [textOnImage, setTextOnImage] = useState('')
  const [style, setStyle] = useState('modern')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const currentStyle = STYLES.find(s => s.id === style) || STYLES[0]

  const handleGenerate = async () => {
    if (!textOnImage.trim() || !sourceImage) return
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${getApiUrl()}/api/graphic/add-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ image: sourceImage, text_on_image: textOnImage, style, brand_colors: brandColors, brand_name: brandName }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to add text')
      }
      const data = await res.json()
      setResult(data.image_url)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = async () => {
    const url = result
    if (!url) return
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = blobUrl; a.download = `graphic-${Date.now()}.jpg`; a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      const a = document.createElement('a'); a.href = url; a.download = `graphic-${Date.now()}.jpg`; a.click()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Type size={18} className="text-violet-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Add Text to Image</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Result image */}
          {result && (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <img src={result} alt="" className="w-full" />
              <div className="absolute top-2 end-2 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full shadow">Text Added</div>
            </div>
          )}

          {/* Controls (before generation or redo) */}
          {!result && (
            <>
              {/* Text input */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Text to add *</label>
                <textarea value={textOnImage} onChange={e => setTextOnImage(e.target.value)}
                  placeholder="e.g. SUMMER SALE — 50% OFF"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  rows={2} />
              </div>

              {/* Style selector */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Style</label>
                <div className="flex gap-1.5 flex-wrap">
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setStyle(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition ${style === s.id
                        ? 'bg-violet-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font preview */}
              {textOnImage.trim() && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Preview</label>
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center min-h-[60px]">
                    <p className="text-center leading-snug" style={{
                      fontFamily: currentStyle.font,
                      fontWeight: currentStyle.weight,
                      textTransform: currentStyle.transform,
                      fontSize: textOnImage.length > 60 ? '0.85rem' : textOnImage.length > 30 ? '1.1rem' : '1.4rem',
                      letterSpacing: style === 'bold' ? '0.1em' : style === 'elegant' ? '0.03em' : undefined,
                      color: brandColors[0] || '#1f2937',
                    }}>
                      {textOnImage}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!result && (
              <button onClick={handleGenerate} disabled={generating || !textOnImage.trim()}
                className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
                {generating ? <><Loader2 size={14} className="animate-spin" /> Adding Text...</> : <><Type size={14} /> Add Text</>}
              </button>
            )}
            {result && (
              <>
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                  <Download size={14} /> Download
                </button>
                {onImageReady && (
                  <button onClick={() => { onImageReady(result); onClose() }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white transition"
                    style={{ background: 'linear-gradient(135deg, #4A7CFF, #7C3AED)' }}>
                    <Sparkles size={14} /> Use in Post
                  </button>
                )}
                <button onClick={() => setResult(null)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  <RefreshCw size={14} /> Redo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
