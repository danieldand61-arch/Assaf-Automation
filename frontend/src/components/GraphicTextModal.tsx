import { useState, useRef } from 'react'
import { X, Loader2, Download, Upload, Type, Palette, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'

const STYLES = [
  { id: 'modern', label: 'Modern', preview: 'Clean gradients, sans-serif' },
  { id: 'bold', label: 'Bold', preview: 'High contrast, impactful' },
  { id: 'minimal', label: 'Minimal', preview: 'White space, subtle' },
  { id: 'elegant', label: 'Elegant', preview: 'Serif, dark/gold' },
  { id: 'playful', label: 'Playful', preview: 'Bright, rounded, fun' },
]

const SIZES = [
  { value: '1080x1080', label: 'Square' },
  { value: '1080x1350', label: 'Portrait' },
  { value: '1200x628', label: 'Landscape' },
  { value: '1080x1920', label: 'Story' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  brandColors?: string[]
  brandName?: string
  onImageReady?: (imageUrl: string) => void
}

export function GraphicTextModal({ isOpen, onClose, brandColors = [], brandName = '', onImageReady }: Props) {
  const { session } = useAuth()
  const [textOnImage, setTextOnImage] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('modern')
  const [size, setSize] = useState('1080x1080')
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refPreview, setRefPreview] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleUpload = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      setRefImage(url)
      setRefPreview(url)
    }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    if (!textOnImage.trim()) return
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${getApiUrl()}/api/graphic/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          text_on_image: textOnImage,
          description,
          image_size: size,
          style,
          brand_colors: brandColors,
          brand_name: brandName,
          reference_image: refImage,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Generation failed')
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
    if (!result) return
    try {
      const resp = await fetch(result)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `graphic-${Date.now()}.jpg`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      const a = document.createElement('a'); a.href = result; a.download = `graphic-${Date.now()}.jpg`; a.click()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Type size={20} className="text-violet-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Graphic with Text</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Text to display */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Text on Image *</label>
            <textarea
              value={textOnImage}
              onChange={e => setTextOnImage(e.target.value)}
              placeholder="e.g. SUMMER SALE — 50% OFF Everything"
              className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              rows={2}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Description / Context (optional)</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Fashion store summer campaign, beach vibes"
              className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Style + Size row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Style</label>
              <div className="space-y-1.5">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    className={`w-full text-left p-2 rounded-lg border transition text-xs ${style === s.id
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                    <span className="font-bold text-gray-900 dark:text-white">{s.label}</span>
                    <span className="text-gray-400 ml-1.5">{s.preview}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Size</label>
              <div className="space-y-1.5">
                {SIZES.map(s => (
                  <button key={s.value} onClick={() => setSize(s.value)}
                    className={`w-full text-left p-2 rounded-lg border transition text-xs font-medium ${size === s.value
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300'}`}>
                    {s.label} <span className="text-gray-400 font-normal">({s.value})</span>
                  </button>
                ))}
              </div>

              {/* Upload background */}
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5 mt-4">Background Image (optional)</label>
              {refPreview ? (
                <div className="relative inline-block">
                  <img src={refPreview} alt="" className="w-20 h-20 object-cover rounded-lg border dark:border-gray-600" />
                  <button onClick={() => { setRefImage(null); setRefPreview(null) }}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-3 flex items-center gap-2 cursor-pointer hover:border-violet-400 transition text-xs text-gray-400">
                  <Upload size={14} /> Upload photo
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </div>
          </div>

          {/* Brand colors hint */}
          {brandColors.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Palette size={12} />
              <span>Using brand colors:</span>
              {brandColors.slice(0, 4).map((c, i) => (
                <span key={i} className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600 inline-block" style={{ background: c }} />
              ))}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <img src={result} alt="Generated graphic" className="w-full rounded-xl border border-gray-200 dark:border-gray-700" />
              <div className="flex gap-2">
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                  <Download size={14} /> Download
                </button>
                {onImageReady && (
                  <button onClick={() => { onImageReady(result); onClose() }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition"
                    style={{ background: 'linear-gradient(135deg, #4A7CFF, #7C3AED)' }}>
                    <Sparkles size={14} /> Use in Post
                  </button>
                )}
                <button onClick={() => { setResult(null); handleGenerate() }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {/* Generate button */}
          {!result && (
            <button onClick={handleGenerate} disabled={generating || !textOnImage.trim()}
              className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
              {generating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Type size={16} /> Generate Graphic</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
