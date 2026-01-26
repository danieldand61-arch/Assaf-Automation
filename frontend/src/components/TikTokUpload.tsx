import { useState } from 'react'
import { Upload, Video, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface TikTokUploadProps {
  isOpen: boolean
  onClose: () => void
}

export function TikTokUpload({ isOpen, onClose }: TikTokUploadProps) {
  const { session } = useAuth()
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState('PUBLIC_TO_EVERYONE')
  const [disableDuet, setDisableDuet] = useState(false)
  const [disableComment, setDisableComment] = useState(false)
  const [disableStitch, setDisableStitch] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  if (!isOpen) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid video file (MP4, MOV, WEBM, or AVI)')
        return
      }

      // Validate file size (500MB max)
      const maxSize = 500 * 1024 * 1024
      if (file.size > maxSize) {
        alert('Video file is too large. Maximum size is 500MB.')
        return
      }

      setVideoFile(file)
      setUploadStatus('idle')
      setErrorMessage('')
    }
  }

  const handleUpload = async () => {
    if (!videoFile || !title.trim()) {
      alert('Please select a video and enter a title')
      return
    }

    if (!session) {
      alert('Please sign in to upload videos')
      return
    }

    setUploading(true)
    setUploadStatus('uploading')
    setUploadProgress(0)
    setErrorMessage('')

    try {
      const apiUrl = getApiUrl()
      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('title', title)
      formData.append('privacy_level', privacyLevel)
      formData.append('disable_duet', String(disableDuet))
      formData.append('disable_comment', String(disableComment))
      formData.append('disable_stitch', String(disableStitch))

      // Simulate progress (actual upload happens on server)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      const response = await fetch(`${apiUrl}/api/tiktok/upload-video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const data = await response.json()
      console.log('Upload successful:', data)
      setUploadStatus('success')
      
      setTimeout(() => {
        onClose()
        // Reset form
        setVideoFile(null)
        setTitle('')
        setUploadStatus('idle')
        setUploadProgress(0)
      }, 3000)

    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Video className="w-6 h-6 text-pink-600" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Upload to TikTok</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Video File *
            </label>
            
            {!videoFile ? (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-pink-500 dark:hover:border-pink-400 transition bg-gray-50 dark:bg-gray-700/50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    MP4, MOV, WEBM, or AVI (MAX 500MB)
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Video className="w-8 h-8 text-pink-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{videoFile.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(videoFile.size)}</p>
                  </div>
                </div>
                {uploadStatus === 'idle' && (
                  <button
                    onClick={() => setVideoFile(null)}
                    className="p-2 hover:bg-pink-100 dark:hover:bg-pink-800/50 rounded-lg transition"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Video Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your video title..."
              maxLength={150}
              disabled={uploading}
              className="w-full px-4 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-pink-500 dark:focus:border-pink-400 focus:outline-none transition"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {title.length}/150 characters
            </p>
          </div>

          {/* Privacy Level */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Privacy Level
            </label>
            <select
              value={privacyLevel}
              onChange={(e) => setPrivacyLevel(e.target.value)}
              disabled={uploading}
              className="w-full px-4 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-pink-500 dark:focus:border-pink-400 focus:outline-none transition"
            >
              <option value="PUBLIC_TO_EVERYONE">Public</option>
              <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
              <option value="SELF_ONLY">Private</option>
            </select>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={disableDuet}
                onChange={(e) => setDisableDuet(e.target.checked)}
                disabled={uploading}
                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Disable Duet</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={disableComment}
                onChange={(e) => setDisableComment(e.target.checked)}
                disabled={uploading}
                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Disable Comments</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={disableStitch}
                onChange={(e) => setDisableStitch(e.target.checked)}
                disabled={uploading}
                className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Disable Stitch</span>
            </label>
          </div>

          {/* Upload Progress */}
          {uploadStatus === 'uploading' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Uploading...</span>
                <span className="text-gray-700 dark:text-gray-300">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-pink-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Message */}
          {uploadStatus === 'success' && (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-200">Video uploaded successfully!</p>
                <p className="text-sm text-green-700 dark:text-green-300">TikTok is processing your video now.</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadStatus === 'error' && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-200">Upload failed</p>
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
            onClick={handleUpload}
            disabled={!videoFile || !title.trim() || uploading || uploadStatus === 'success'}
            className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadStatus === 'success' ? 'Uploaded!' : 'Upload to TikTok'}
          </button>
        </div>
      </div>
    </div>
  )
}
