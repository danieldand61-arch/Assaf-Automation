import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Player } from '@remotion/player'
import { ProductVideo } from '../remotion/ProductVideo'
import { getApiUrl } from '../lib/api'

const API_URL = getApiUrl()

interface VideoTask {
  task_id: string
  status: string
  video_urls?: string[]
  consumed_credits?: number
  error_message?: string
  created_at?: string
  estimated_credits?: number
}

export default function VideoGeneration() {
  const { session } = useAuth()
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'template'>('text')
  
  // Text-to-Video state
  const [textPrompt, setTextPrompt] = useState('')
  const [textAspectRatio, setTextAspectRatio] = useState('16:9')
  const [textDuration, setTextDuration] = useState('5')
  const [textSound, setTextSound] = useState(false)
  
  // Image-to-Video state
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([''])
  const [imageDuration, setImageDuration] = useState('5')
  const [imageSound, setImageSound] = useState(false)
  
  // Template Video state
  const [templateTitle, setTemplateTitle] = useState('iPhone 15 Pro')
  const [templateDescription, setTemplateDescription] = useState('Titanium design with A17 Pro chip')
  const [templatePrice, setTemplatePrice] = useState(999)
  const [templateImageUrl, setTemplateImageUrl] = useState('https://via.placeholder.com/500x500/4A90E2/ffffff?text=Product')
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentTask, setCurrentTask] = useState<VideoTask | null>(null)
  const [error, setError] = useState('')

  const calculateCredits = (duration: string, sound: boolean) => {
    const base = duration === '5' ? 500 : 1000
    return sound ? base * 2 : base
  }

  const handleTextToVideo = async () => {
    if (!textPrompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setIsGenerating(true)
    setError('')
    setCurrentTask(null)

    try {
      const response = await fetch(`${API_URL}/api/video-gen/text-to-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          prompt: textPrompt,
          aspect_ratio: textAspectRatio,
          duration: textDuration,
          sound: textSound
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to generate video')
      }

      const data = await response.json()
      
      setCurrentTask({
        task_id: data.task_id,
        status: 'IN_PROGRESS',
        estimated_credits: data.estimated_credits
      })

      // Start polling status
      pollStatus(data.task_id)

    } catch (err: any) {
      setError(err.message)
      setIsGenerating(false)
    }
  }

  const handleImageToVideo = async () => {
    if (!imagePrompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    const validUrls = imageUrls.filter(url => url.trim())
    if (validUrls.length === 0) {
      setError('Please add at least one image URL')
      return
    }

    setIsGenerating(true)
    setError('')
    setCurrentTask(null)

    try {
      const response = await fetch(`${API_URL}/api/video-gen/image-to-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          image_urls: validUrls,
          duration: imageDuration,
          sound: imageSound
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to generate video')
      }

      const data = await response.json()
      
      setCurrentTask({
        task_id: data.task_id,
        status: 'IN_PROGRESS',
        estimated_credits: data.estimated_credits
      })

      // Start polling status
      pollStatus(data.task_id)

    } catch (err: any) {
      setError(err.message)
      setIsGenerating(false)
    }
  }

  const pollStatus = async (taskId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/video-gen/status/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        })

        if (!response.ok) throw new Error('Failed to get status')

        const data = await response.json()
        
        setCurrentTask(prev => ({
          ...prev!,
          ...data
        }))

        if (data.status === 'IN_PROGRESS') {
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          setIsGenerating(false)
        }

      } catch (err: any) {
        setError(`Status check failed: ${err.message}`)
        setIsGenerating(false)
      }
    }

    poll()
  }

  const addImageUrl = () => {
    setImageUrls([...imageUrls, ''])
  }

  const updateImageUrl = (index: number, value: string) => {
    const newUrls = [...imageUrls]
    newUrls[index] = value
    setImageUrls(newUrls)
  }

  const removeImageUrl = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index))
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🎬 AI Video Generation
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create stunning videos with Kling 2.6 AI - from text or images
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('text')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'text'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                📝 Text to Video
              </button>
              <button
                onClick={() => setActiveTab('image')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'image'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🖼️ Image to Video
              </button>
              <button
                onClick={() => setActiveTab('template')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'template'
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🎨 Video Templates
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Text to Video */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt (max 1000 characters)
                  </label>
                  <textarea
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Describe your video scene... (e.g., 'A drone shot flying over a neon-lit city at night')"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {textPrompt.length}/1000 characters
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Aspect Ratio
                    </label>
                    <select
                      value={textAspectRatio}
                      onChange={(e) => setTextAspectRatio(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="16:9">16:9 (Landscape)</option>
                      <option value="9:16">9:16 (Portrait)</option>
                      <option value="1:1">1:1 (Square)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duration
                    </label>
                    <select
                      value={textDuration}
                      onChange={(e) => setTextDuration(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Audio
                    </label>
                    <label className="flex items-center h-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={textSound}
                        onChange={(e) => setTextSound(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Include sound (2x cost)</span>
                    </label>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                      Estimated Cost:
                    </span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {calculateCredits(textDuration, textSound)} credits
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleTextToVideo}
                  disabled={isGenerating || !textPrompt.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating...' : '🎬 Generate Video'}
                </button>
              </div>
            )}

            {/* Image to Video */}
            {activeTab === 'image' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt (max 1000 characters)
                  </label>
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Describe how to animate the image... (e.g., 'Camera slowly pans right while zooming in')"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {imagePrompt.length}/1000 characters
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reference Images
                  </label>
                  {imageUrls.map((url, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => updateImageUrl(index, e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      {imageUrls.length > 1 && (
                        <button
                          onClick={() => removeImageUrl(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addImageUrl}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Add another image
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duration
                    </label>
                    <select
                      value={imageDuration}
                      onChange={(e) => setImageDuration(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="5">5 seconds</option>
                      <option value="10">10 seconds</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Audio
                    </label>
                    <label className="flex items-center h-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={imageSound}
                        onChange={(e) => setImageSound(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Include sound (2x cost)</span>
                    </label>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                      Estimated Cost:
                    </span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {calculateCredits(imageDuration, imageSound)} credits
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleImageToVideo}
                  disabled={isGenerating || !imagePrompt.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating...' : '🎬 Generate Video'}
                </button>
              </div>
            )}

            {/* Video Templates */}
            {activeTab === 'template' && (
              <div className="space-y-6">
                {/* Live Preview */}
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 px-4 pt-4 mb-2">
                    Live Preview
                  </h3>
                  <div className="flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
                    <Player
                      component={ProductVideo}
                      inputProps={{
                        title: templateTitle,
                        description: templateDescription,
                        price: templatePrice,
                        imageUrl: templateImageUrl
                      }}
                      durationInFrames={150}
                      fps={30}
                      compositionWidth={1920}
                      compositionHeight={1080}
                      style={{
                        width: '100%',
                        maxWidth: '800px',
                      }}
                      controls
                    />
                  </div>
                </div>

                {/* Form */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Product Title
                    </label>
                    <input
                      type="text"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      placeholder="e.g., iPhone 15 Pro"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Price ($)
                    </label>
                    <input
                      type="number"
                      value={templatePrice}
                      onChange={(e) => setTemplatePrice(Number(e.target.value))}
                      placeholder="999"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    rows={3}
                    placeholder="Amazing product description that highlights key features"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Product Image URL
                  </label>
                  <input
                    type="url"
                    value={templateImageUrl}
                    onChange={(e) => setTemplateImageUrl(e.target.value)}
                    placeholder="https://example.com/product-image.jpg"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You can use placeholder: https://via.placeholder.com/500x500
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-medium text-green-900 dark:text-green-300">
                        💡 Live Preview Active
                      </span>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                        Changes update in real-time. Press play to see the animation!
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  disabled
                  className="w-full bg-gray-400 cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium"
                >
                  🎬 Render Full Video (Coming Soon - requires backend setup)
                </button>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                    🚀 Template Features:
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                    <li>• Professional animations (fade in, slide, spring effects)</li>
                    <li>• 100% customizable (title, description, price, image)</li>
                    <li>• Instant preview - see changes in real-time</li>
                    <li>• Perfect for e-commerce product videos</li>
                    <li>• Export to MP4 (backend integration required)</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-900 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Current Task Status */}
        {currentTask && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Video Generation Status
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Task ID:</span>
                <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {currentTask.task_id}
                </code>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`font-medium ${
                  currentTask.status === 'SUCCESS' ? 'text-green-600 dark:text-green-400' :
                  currentTask.status === 'FAILED' ? 'text-red-600 dark:text-red-400' :
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  {currentTask.status}
                </span>
              </div>

              {currentTask.consumed_credits && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Credits Used:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {currentTask.consumed_credits}
                  </span>
                </div>
              )}

              {currentTask.error_message && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                  <p className="text-sm text-red-900 dark:text-red-300">
                    {currentTask.error_message}
                  </p>
                </div>
              )}

              {currentTask.status === 'IN_PROGRESS' && (
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Video is being generated... This may take 1-2 minutes.</span>
                </div>
              )}

              {currentTask.video_urls && currentTask.video_urls.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Generated Videos:
                  </h4>
                  {currentTask.video_urls.map((url, index) => (
                    <div key={index} className="mb-3">
                      <video
                        src={url}
                        controls
                        className="w-full rounded-lg"
                      />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        🔗 Open in new tab
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-3">
            💡 Tips for Best Results
          </h3>
          <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-400">
            <li>• Be specific and descriptive in your prompts</li>
            <li>• Mention camera movements (pan, zoom, tilt) for dynamic videos</li>
            <li>• Include lighting and mood descriptions (e.g., "golden hour", "neon lights")</li>
            <li>• For image-to-video: describe how the image should animate</li>
            <li>• Audio generation works best with ambient scenes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
