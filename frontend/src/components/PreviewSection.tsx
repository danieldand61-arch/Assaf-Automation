import { useState } from 'react'
import { Download, RefreshCw, Edit, Smartphone, Monitor } from 'lucide-react'
import { useContentStore } from '../store/contentStore'

interface PreviewSectionProps {
  onReset: () => void
}

export function PreviewSection({ onReset }: PreviewSectionProps) {
  const { generatedContent } = useContentStore()
  const [selectedVariation, setSelectedVariation] = useState(0)
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile')

  if (!generatedContent) return null

  const variation = generatedContent.variations[selectedVariation]
  const image = generatedContent.images[0]

  const handleDownloadAll = () => {
    alert('Download ZIP with content (TODO: implement)')
  }

  return (
    <div className="space-y-6">
      
      {/* Controls */}
      <div className="bg-white rounded-xl shadow-md p-4 flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            New Generation
          </button>
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download All
          </button>
        </div>
        
        <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('mobile')}
            className={`px-3 py-2 rounded-md transition ${
              viewMode === 'mobile' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
            }`}
          >
            <Smartphone className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('desktop')}
            className={`px-3 py-2 rounded-md transition ${
              viewMode === 'desktop' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
            }`}
          >
            <Monitor className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Left: Variations List */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800">Post Variations</h3>
          
          {generatedContent.variations.map((v, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedVariation(idx)}
              className={`bg-white rounded-xl p-5 cursor-pointer transition border-2 ${
                selectedVariation === idx
                  ? 'border-blue-500 shadow-lg'
                  : 'border-transparent shadow-md hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-sm font-bold text-gray-500">Variation {idx + 1}</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                  Engagement: {Math.round(v.engagement_score * 100)}%
                </span>
              </div>
              
              <p className="text-gray-800 whitespace-pre-wrap mb-3">{v.text}</p>
              
              <div className="flex flex-wrap gap-1 mb-3">
                {v.hashtags.slice(0, 5).map((tag, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                    #{tag}
                  </span>
                ))}
                {v.hashtags.length > 5 && (
                  <span className="text-xs text-gray-500">+{v.hashtags.length - 5} more</span>
                )}
              </div>
              
              <div className="flex justify-between text-xs text-gray-500">
                <span>{v.char_count} characters</span>
                <span className="font-medium text-blue-600">{v.call_to_action}</span>
              </div>
            </div>
          ))}

          {/* Brand Info */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-5">
            <h4 className="font-bold text-gray-800 mb-3">Brand Analysis</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Voice: </span>
                <span className="font-medium">{generatedContent.brand_voice}</span>
              </div>
              <div>
                <span className="text-gray-600">Colors: </span>
                <div className="flex gap-2 mt-1">
                  {generatedContent.brand_colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800">Preview</h3>
          
          <div className={`bg-white rounded-xl shadow-xl overflow-hidden transition-all ${
            viewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'
          }`}>
            {/* Image */}
            {image && (
              <div className="relative">
                <img
                  src={image.url}
                  alt="Generated post"
                  className="w-full h-auto"
                />
                <button className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-full hover:bg-white transition">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Post Content */}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full" />
                <div>
                  <div className="font-bold text-gray-800">Your Brand</div>
                  <div className="text-xs text-gray-500">Just now</div>
                </div>
              </div>
              
              <p className="text-gray-800 whitespace-pre-wrap mb-3">
                {variation.text}
              </p>
              
              <div className="flex flex-wrap gap-1 mb-4">
                {variation.hashtags.map((tag, i) => (
                  <span key={i} className="text-sm text-blue-600">
                    #{tag}
                  </span>
                ))}
              </div>
              
              <div className="border-t pt-3 flex justify-around text-gray-600 text-sm">
                <button className="hover:text-blue-600 transition">❤️ Like</button>
                <button className="hover:text-blue-600 transition">💬 Comment</button>
                <button className="hover:text-blue-600 transition">📤 Share</button>
              </div>
            </div>
          </div>

          {/* Images Gallery */}
          <div className="bg-white rounded-xl p-5 shadow-md">
            <h4 className="font-bold text-gray-800 mb-3">Generated Images</h4>
            <div className="grid grid-cols-2 gap-3">
              {generatedContent.images.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img.url}
                    alt={img.size}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center">
                    <div className="text-white text-xs text-center">
                      <div className="font-bold">{img.size}</div>
                      <div>{img.dimensions}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

