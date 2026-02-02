import { useState } from 'react'
import { Download, RefreshCw, Edit, Smartphone, Monitor, Edit3, Send, BookmarkPlus } from 'lucide-react'
import { useContentStore } from '../store/contentStore'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { PostEditModal } from './PostEditModal'
import { ImageEditModal } from './ImageEditModal'
import { PostToSocial } from './PostToSocial'
import { getApiUrl } from '../lib/api'

interface PreviewSectionProps {
  onReset: () => void
  content?: any // Optional: if provided, use this instead of global store
}

export function PreviewSection({ onReset, content }: PreviewSectionProps) {
  const { generatedContent: globalContent, updateVariation, updateImage } = useContentStore()
  
  // Use provided content or fall back to global store
  const generatedContent = content || globalContent
  const { t } = useApp()
  const { session } = useAuth()
  const [selectedVariation, setSelectedVariation] = useState(0)
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile')
  const [isEditingText, setIsEditingText] = useState(false)
  const [isEditingImage, setIsEditingImage] = useState(false)
  const [isPostingToSocial, setIsPostingToSocial] = useState(false)
  const [savingToLibrary, setSavingToLibrary] = useState(false)

  if (!generatedContent) return null

  const variation = generatedContent.variations[selectedVariation]
  // Get image for current variation (same index)
  const image = generatedContent.images[selectedVariation] || generatedContent.images[0]
  
  // DEBUG: Log image data
  console.log('🖼️ DEBUG: Selected variation:', selectedVariation)
  console.log('🖼️ DEBUG: Total images:', generatedContent.images.length)
  console.log('🖼️ DEBUG: Current image:', image)

  const handleDownloadPost = async () => {
    try {
      const zip = new JSZip()
      
      // Add post text as TXT file
      const postText = `${variation.text}\n\n${variation.hashtags.map((tag: string) => `#${tag}`).join(' ')}\n\n${variation.call_to_action}`
      zip.file('post.txt', postText)
      
      // Add image
      if (image && image.url) {
        // Convert data URL to blob
        const base64Data = image.url.split(',')[1]
        const mimeType = image.url.match(/data:(.*?);/)?.[1] || 'image/jpeg'
        const extension = mimeType.split('/')[1] || 'jpg'
        
        // Decode base64 to binary
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        zip.file(`image.${extension}`, bytes, { binary: true })
      }
      
      // Generate ZIP and download
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `post-variation-${selectedVariation + 1}.zip`)
      
      console.log('✅ ZIP downloaded successfully!')
    } catch (error) {
      console.error('❌ Download error:', error)
      alert(t('downloadError'))
    }
  }

  const handleTextSave = (text: string, hashtags: string[], cta: string) => {
    updateVariation(selectedVariation, text, hashtags, cta)
  }

  const handleImageUpdate = (newImageUrl: string) => {
    updateImage(selectedVariation, newImageUrl)
  }

  const handleSaveToLibrary = async () => {
    if (!session) {
      alert('Please sign in to save posts')
      return
    }

    setSavingToLibrary(true)
    
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/saved-posts/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          text: variation.text,
          hashtags: variation.hashtags,
          call_to_action: variation.call_to_action,
          image_url: image.url,
          source_url: generatedContent?.request_params?.websiteUrl,
          platforms: generatedContent?.request_params?.platforms || []
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save post')
      }

      alert('Post saved to library!')
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save post. Please try again.')
    } finally {
      setSavingToLibrary(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 flex justify-between items-center flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('newGeneration')}
          </button>
          <button
            onClick={handleDownloadPost}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('downloadPost')}
          </button>
          <button
            onClick={handleSaveToLibrary}
            disabled={savingToLibrary}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <BookmarkPlus className="w-4 h-4" />
            {savingToLibrary ? 'Saving...' : 'Save to Library'}
          </button>
          <button
            onClick={() => setIsPostingToSocial(true)}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Post to Social Media
          </button>
        </div>
        
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('mobile')}
            className={`px-3 py-2 rounded-md transition ${
              viewMode === 'mobile' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Smartphone className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <button
            onClick={() => setViewMode('desktop')}
            className={`px-3 py-2 rounded-md transition ${
              viewMode === 'desktop' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Monitor className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Left: Variations List */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('postVariations')}</h3>
          
          {generatedContent.variations.map((v: any, idx: number) => (
            <div
              key={idx}
              onClick={() => setSelectedVariation(idx)}
              className={`bg-white dark:bg-gray-800 rounded-xl p-5 cursor-pointer transition border-2 ${
                selectedVariation === idx
                  ? 'border-blue-500 dark:border-blue-400 shadow-lg'
                  : 'border-transparent shadow-md hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('variation')} {idx + 1}</span>
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs font-semibold">
                  {t('engagement')}: {Math.round(v.engagement_score * 100)}%
                </span>
              </div>
              
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">{v.text}</p>
              
              {selectedVariation === idx && (
                <button
                  onClick={() => setIsEditingText(true)}
                  className="mb-3 px-4 py-2 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Text
                </button>
              )}
              
              <div className="flex flex-wrap gap-1 mb-3">
                {v.hashtags.slice(0, 5).map((tag: string, i: number) => (
                  <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded">
                    #{tag}
                  </span>
                ))}
                {v.hashtags.length > 5 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">+{v.hashtags.length - 5} {t('more')}</span>
                )}
              </div>
              
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{v.char_count} {t('characters')}</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">{v.call_to_action}</span>
              </div>
            </div>
          ))}

          {/* Brand Info */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl p-5">
            <h4 className="font-bold text-gray-800 dark:text-white mb-3">{t('brandAnalysis')}</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">{t('voice')}: </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{generatedContent.brand_voice}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">{t('colors')}: </span>
                <div className="flex gap-2 mt-1">
                  {generatedContent.brand_colors.map((color: string, i: number) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-700 shadow"
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
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('preview')}</h3>
          
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden transition-all ${
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
                <button 
                  onClick={() => setIsEditingImage(true)}
                  className="absolute top-4 right-4 ltr:right-4 rtl:left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur px-4 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300"
                >
                  <Edit className="w-5 h-5" />
                  Edit Image
                </button>
              </div>
            )}
            
            {/* Post Content */}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full" />
                <div>
                  <div className="font-bold text-gray-800 dark:text-white">Your Brand</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('justNow')}</div>
                </div>
              </div>
              
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">
                {variation.text}
              </p>
              
              <div className="flex flex-wrap gap-1 mb-4">
                {variation.hashtags.map((tag: string, i: number) => (
                  <span key={i} className="text-sm text-blue-600 dark:text-blue-400">
                    #{tag}
                  </span>
                ))}
              </div>
              
              <div className="border-t dark:border-gray-700 pt-3 flex justify-around text-gray-600 dark:text-gray-400 text-sm">
                <button className="hover:text-blue-600 dark:hover:text-blue-400 transition">❤️ Like</button>
                <button className="hover:text-blue-600 dark:hover:text-blue-400 transition">💬 Comment</button>
                <button className="hover:text-blue-600 dark:hover:text-blue-400 transition">📤 Share</button>
              </div>
            </div>
          </div>

          {/* Images Gallery */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md">
            <h4 className="font-bold text-gray-800 dark:text-white mb-3">{t('generatedImages')} ({generatedContent.images.length})</h4>
            <div className="grid grid-cols-2 gap-3">
              {generatedContent.images.map((img: any, idx: number) => (
                <div 
                  key={idx} 
                  className={`relative group cursor-pointer border-2 rounded-lg ${
                    idx === selectedVariation ? 'border-blue-500' : 'border-transparent'
                  }`}
                  onClick={() => setSelectedVariation(idx)}
                >
                  <img
                    src={img.url}
                    alt={`Variation ${idx + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center">
                    <div className="text-white text-xs text-center">
                      <div className="font-bold">{t('variation')} {idx + 1}</div>
                      <div>{img.dimensions}</div>
                    </div>
                  </div>
                  {idx === selectedVariation && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                      {t('active')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PostEditModal
        isOpen={isEditingText}
        onClose={() => setIsEditingText(false)}
        initialText={variation.text}
        initialHashtags={variation.hashtags}
        initialCTA={variation.call_to_action}
        onSave={handleTextSave}
        language={generatedContent.request_params?.language || 'en'}
      />

      <ImageEditModal
        isOpen={isEditingImage}
        onClose={() => setIsEditingImage(false)}
        currentImage={image.url}
        websiteData={generatedContent.website_data || {}}
        postText={variation.text}
        platform={generatedContent.request_params?.platforms?.[0] || 'instagram'}
        imageSize={generatedContent.request_params?.image_size || '1080x1080'}
        includeLogo={generatedContent.request_params?.include_logo || false}
        onImageUpdate={handleImageUpdate}
      />

      <PostToSocial
        isOpen={isPostingToSocial}
        onClose={() => setIsPostingToSocial(false)}
        prefilledData={{
          text: `${variation.text}\n\n${variation.hashtags.map((tag: string) => `#${tag}`).join(' ')}\n\n${variation.call_to_action}`,
          imageUrl: image.url
        }}
      />
    </div>
  )
}

