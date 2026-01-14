import { useState, useRef } from 'react'
import { X, RefreshCw, Upload, History, Loader2, Image as ImageIcon } from 'lucide-react'

interface ImageEditModalProps {
  isOpen: boolean
  onClose: () => void
  currentImage: string
  websiteData: any
  postText: string
  platform: string
  imageSize: string
  includeLogo: boolean
  onImageUpdate: (newImageUrl: string) => void
}

export function ImageEditModal({
  isOpen,
  onClose,
  currentImage,
  websiteData,
  postText,
  platform,
  imageSize,
  includeLogo,
  onImageUpdate
}: ImageEditModalProps) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [variations, setVariations] = useState<string[]>([currentImage])
  const [selectedVariation, setSelectedVariation] = useState(0)
  const [history, setHistory] = useState<string[]>([currentImage])
  const [customPrompt, setCustomPrompt] = useState('')
  const [useCustomPrompt, setUseCustomPrompt] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      // Generate 3 variations
      const newVariations: string[] = []
      
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${apiUrl}/api/content/regenerate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website_data: websiteData,
            post_text: postText,
            platform,
            image_size: imageSize,
            include_logo: includeLogo,
            custom_prompt: useCustomPrompt && customPrompt ? customPrompt : null
          })
        })
        
        if (!response.ok) throw new Error('Regeneration failed')
        
        const data = await response.json()
        if (data.image?.url) {
          newVariations.push(data.image.url)
        }
      }
      
      if (newVariations.length > 0) {
        setVariations(newVariations)
        setSelectedVariation(0)
        setHistory([...history, ...newVariations])
      }
    } catch (error) {
      console.error('Regeneration error:', error)
      alert('Image regeneration failed. Please try again.')
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setVariations([dataUrl])
      setSelectedVariation(0)
      setHistory([...history, dataUrl])
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    onImageUpdate(variations[selectedVariation])
    onClose()
  }

  const handleHistorySelect = (imageUrl: string) => {
    setVariations([imageUrl])
    setSelectedVariation(0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Edit Image</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Custom Prompt Section */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-gray-800 dark:text-white">AI Image Prompt</h3>
            </div>
            
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomPrompt}
                onChange={(e) => setUseCustomPrompt(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Use custom prompt
              </span>
            </label>

            {useCustomPrompt && (
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what you want in the image... (e.g., 'Modern office with laptop, coffee cup, sunrise through window, professional atmosphere')"
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition resize-none text-sm"
                rows={3}
              />
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating 3 variations...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Regenerate (3x)
                </>
              )}
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Own Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left: Current Variations */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-semibold text-gray-800 dark:text-white">
                {variations.length > 1 ? 'Generated Variations' : 'Current Image'}
              </h3>
              
              {/* Main Preview */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden aspect-square">
                <img
                  src={variations[selectedVariation]}
                  alt="Selected variation"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Variations Grid */}
              {variations.length > 1 && (
                <div className="grid grid-cols-3 gap-3">
                  {variations.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedVariation(idx)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                        selectedVariation === idx
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Variation ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {selectedVariation === idx && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded font-medium">
                            Selected
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                <ImageIcon className="w-5 h-5 inline mr-2 text-blue-600 dark:text-blue-400" />
                <strong>Tip:</strong> Click "Regenerate" to create 3 new AI variations, or upload your own image for full control.
              </div>
            </div>

            {/* Right: History */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="font-semibold text-gray-800 dark:text-white">Version History</h3>
              </div>
              
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {history.slice().reverse().map((img, idx) => {
                  const actualIndex = history.length - 1 - idx
                  return (
                    <button
                      key={actualIndex}
                      onClick={() => handleHistorySelect(img)}
                      className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition group relative"
                    >
                      <img
                        src={img}
                        alt={`History ${actualIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition">
                          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs px-3 py-1 rounded font-medium">
                            Use This
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 bg-gray-900/80 text-white text-xs px-2 py-1 rounded">
                        v{actualIndex + 1}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isRegenerating}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            Use Selected Image
          </button>
        </div>
      </div>
    </div>
  )
}
