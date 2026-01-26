import { useState, useEffect } from 'react'
import { Upload, Image as ImageIcon, Video, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface Connection {
  id: string
  platform: string
  platform_username: string
  is_connected: boolean
}

interface PostToSocialProps {
  isOpen: boolean
  onClose: () => void
}

const PLATFORM_INFO = {
  facebook: { name: 'Facebook', icon: '📘', color: 'bg-blue-600', supports: ['text', 'image'] },
  instagram: { name: 'Instagram', icon: '📸', color: 'bg-pink-600', supports: ['text', 'image'] },
  linkedin: { name: 'LinkedIn', icon: '💼', color: 'bg-blue-700', supports: ['text', 'image'] },
  twitter: { name: 'X (Twitter)', icon: '🐦', color: 'bg-gray-900', supports: ['text', 'image'] },
  tiktok: { name: 'TikTok', icon: '🎵', color: 'bg-black', supports: ['video'] }
}

export function PostToSocial({ isOpen, onClose }: PostToSocialProps) {
  const { session } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [contentType, setContentType] = useState<'text-image' | 'video'>('text-image')
  const [postText, setPostText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [results, setResults] = useState<{[key: string]: 'success' | 'failed'}>({})

  useEffect(() => {
    if (isOpen) {
      fetchConnections()
    }
  }, [isOpen])

  const fetchConnections = async () => {
    if (!session) return

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/social/connections`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const connected = data.connections.filter((c: Connection) => c.is_connected)
        setConnections(connected)
        
        // Auto-select all connected platforms
        setSelectedPlatforms(connected.map((c: Connection) => c.platform))
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error)
    }
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image (JPG, PNG, GIF, WEBP)')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Image too large. Maximum size is 10MB.')
        return
      }
      setImageFile(file)
    }
  }

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm']
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid video (MP4, MOV, WEBM)')
        return
      }
      if (file.size > 500 * 1024 * 1024) {
        alert('Video too large. Maximum size is 500MB.')
        return
      }
      setVideoFile(file)
    }
  }

  const handlePost = async () => {
    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform')
      return
    }

    if (!postText.trim() && contentType === 'text-image') {
      alert('Please enter some text')
      return
    }

    if (contentType === 'video' && !videoFile) {
      alert('Please select a video file')
      return
    }

    if (!session) {
      alert('Please sign in to post')
      return
    }

    setUploading(true)
    setUploadStatus('uploading')
    setErrorMessage('')
    setResults({})

    try {
      const apiUrl = getApiUrl()
      
      // Post to each selected platform
      const postResults: {[key: string]: 'success' | 'failed'} = {}

      for (const platform of selectedPlatforms) {
        try {
          if (platform === 'tiktok' && contentType === 'video' && videoFile) {
            // Upload video to TikTok
            const formData = new FormData()
            formData.append('video', videoFile)
            formData.append('title', postText || 'Video post')
            formData.append('privacy_level', 'PUBLIC_TO_EVERYONE')

            const response = await fetch(`${apiUrl}/api/tiktok/upload-video`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              },
              body: formData
            })

            if (response.ok) {
              postResults[platform] = 'success'
            } else {
              postResults[platform] = 'failed'
            }
          } else if (contentType === 'text-image') {
            // Post text/image to other platforms
            const formData = new FormData()
            formData.append('text', postText)
            formData.append('platforms', JSON.stringify([platform]))
            if (imageFile) {
              formData.append('image', imageFile)
            }

            const response = await fetch(`${apiUrl}/api/social/post`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              },
              body: formData
            })

            if (response.ok) {
              postResults[platform] = 'success'
            } else {
              postResults[platform] = 'failed'
            }
          }
        } catch (error) {
          console.error(`Failed to post to ${platform}:`, error)
          postResults[platform] = 'failed'
        }
      }

      setResults(postResults)
      
      const allSuccess = Object.values(postResults).every(r => r === 'success')
      if (allSuccess) {
        setUploadStatus('success')
        setTimeout(() => {
          onClose()
          resetForm()
        }, 3000)
      } else {
        setUploadStatus('error')
        setErrorMessage('Some posts failed. Check results above.')
      }

    } catch (error) {
      console.error('Posting error:', error)
      setUploadStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to post')
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setPostText('')
    setImageFile(null)
    setVideoFile(null)
    setUploadStatus('idle')
    setResults({})
  }

  if (!isOpen) return null

  const videoPlatforms = connections.filter(c => 
    PLATFORM_INFO[c.platform as keyof typeof PLATFORM_INFO]?.supports.includes('video')
  )

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Post to Social Media</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* No Connections Warning */}
          {connections.length === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200">
                No social media accounts connected. Please connect at least one platform first.
              </p>
            </div>
          )}

          {/* Content Type Selector */}
          {videoPlatforms.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Content Type
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setContentType('text-image')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                    contentType === 'text-image'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <ImageIcon className="w-5 h-5" />
                  Text + Image
                </button>
                <button
                  onClick={() => setContentType('video')}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                    contentType === 'video'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Video className="w-5 h-5" />
                  Video
                </button>
              </div>
            </div>
          )}

          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Select Platforms
            </label>
            <div className="grid grid-cols-2 gap-3">
              {connections
                .filter(conn => {
                  const info = PLATFORM_INFO[conn.platform as keyof typeof PLATFORM_INFO]
                  return contentType === 'video' 
                    ? info?.supports.includes('video')
                    : info?.supports.includes('text')
                })
                .map(conn => {
                  const info = PLATFORM_INFO[conn.platform as keyof typeof PLATFORM_INFO]
                  if (!info) return null

                  const isSelected = selectedPlatforms.includes(conn.platform)
                  const result = results[conn.platform]

                  return (
                    <button
                      key={conn.id}
                      onClick={() => togglePlatform(conn.platform)}
                      disabled={uploading}
                      className={`
                        p-4 rounded-lg border-2 transition text-left
                        ${isSelected 
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                        }
                        ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{info.icon}</span>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {info.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              @{conn.platform_username}
                            </div>
                          </div>
                        </div>
                        {result && (
                          <div>
                            {result === 'success' ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>

          {/* Post Content */}
          {contentType === 'text-image' ? (
            <>
              {/* Post Text */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Post Text *
                </label>
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  disabled={uploading}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {postText.length} characters
                </p>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Image (Optional)
                </label>
                
                {!imageFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition bg-gray-50 dark:bg-gray-700/50">
                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Click to upload image
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageSelect}
                      disabled={uploading}
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img 
                      src={URL.createObjectURL(imageFile)} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    {!uploading && (
                      <button
                        onClick={() => setImageFile(null)}
                        className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Video Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Video Title *
                </label>
                <input
                  type="text"
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Enter video title..."
                  disabled={uploading}
                  className="w-full px-4 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition"
                />
              </div>

              {/* Video Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Video File *
                </label>
                
                {!videoFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 transition bg-gray-50 dark:bg-gray-700/50">
                    <Video className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Click to upload video (MAX 500MB)
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/mp4,video/quicktime,video/webm"
                      onChange={handleVideoSelect}
                      disabled={uploading}
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Video className="w-8 h-8 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{videoFile.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    {!uploading && (
                      <button
                        onClick={() => setVideoFile(null)}
                        className="p-2 hover:bg-purple-100 dark:hover:bg-purple-800/50 rounded-lg transition"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Success/Error Messages */}
          {uploadStatus === 'success' && (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-200">Posted successfully!</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your content is now live on selected platforms.
                </p>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-200">Some posts failed</p>
                <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={
              uploading || 
              selectedPlatforms.length === 0 ||
              (contentType === 'text-image' && !postText.trim()) ||
              (contentType === 'video' && (!videoFile || !postText.trim()))
            }
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadStatus === 'success' ? 'Posted!' : 'Post to Social Media'}
          </button>
        </div>
      </div>
    </div>
  )
}
