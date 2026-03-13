import { useState, useRef } from 'react'
import { X, Loader2, Download, Upload, Type, Sparkles, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'

const STYLES = [
  { id: 'modern', label: 'Modern' },
  { id: 'bold', label: 'Bold' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'elegant', label: 'Elegant' },
  { id: 'playful', label: 'Playful' },
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
  const [imgSrc, setImgSrc] = useState<string | null>(sourceImage)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleUpload = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB'); return }
    const reader = new FileReader()
    reader.onload = (e) => { setImgSrc(e.target?.result as string); setResult(null) }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    if (!textOnImage.trim() || !imgSrc) return
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${getApiUrl()}/api/graphic/add-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ image: imgSrc, text_on_image: textOnImage, style, brand_colors: brandColors, brand_name: brandName }),
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
    const url = result || imgSrc
    if (!url) return
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = blobUrl; a.download = `graphic-${Date.now()}.jpg`; a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      const a = document.createElement('a'); a.href = url!; a.download = `graphic-${Date.now()}.jpg`; a.click()
    }
  }

  const currentImage = result || imgSrc

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Type size={18} className="text-violet-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Add Text to Image</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Image preview / upload */}
          {currentImage ? (
            <div className="relative">
              <img src={currentImage} alt="" className="w-full rounded-xl border border-gray-200 dark:border-gray-700" />
              {result && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">Text Added</div>
              )}
              {!result && (
                <button onClick={() => { setImgSrc(null); setResult(null) }}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition">
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-violet-300 dark:border-violet-600 rounded-xl p-10 flex flex-col items-center gap-2 cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/10 transition">
              <Upload size={28} className="text-violet-400" />
              <span className="text-sm font-medium text-violet-500">Upload an image to add text on</span>
              <span className="text-[10px] text-gray-400">Or use "Add Text" from a generated post image</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />

          {/* Text + Style controls (only if we have an image and no result yet) */}
          {imgSrc && !result && (
            <>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Text to add *</label>
                <textarea value={textOnImage} onChange={e => setTextOnImage(e.target.value)}
                  placeholder="e.g. SUMMER SALE — 50% OFF"
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  rows={2} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Typography Style</label>
                <div className="flex gap-1.5 flex-wrap">
                  {STYLES.map(s => (
                    <button key={s.id} onClick={() => setStyle(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${style === s.id
                        ? 'bg-violet-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {imgSrc && !result && (
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
                <button onClick={() => { setResult(null) }}
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
