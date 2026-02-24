import { useState, useEffect } from 'react'
import { getApiUrl } from '../lib/api'
import { X, Calendar, Clock, Send, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface SchedulePostModalProps {
  isOpen: boolean
  onClose: () => void
  postData: {
    text: string
    hashtags: string[]
    cta: string
    imageUrl: string
  }
  platforms?: string[]  // Optional, can be selected in modal
}

interface Connection {
  id: string
  platform: string
  platform_username: string
  is_connected: boolean
}

// Platform icons and colors
const PLATFORM_CONFIG = {
  facebook: { name: 'Facebook', color: 'bg-blue-600', icon: '📘' },
  instagram: { name: 'Instagram', color: 'bg-pink-600', icon: '📷' },
  linkedin: { name: 'LinkedIn', color: 'bg-blue-700', icon: '💼' },
  twitter: { name: 'X (Twitter)', color: 'bg-gray-900', icon: '🐦' },
  tiktok: { name: 'TikTok', color: 'bg-gray-800', icon: '🎵' }
}

export function SchedulePostModal({ 
  isOpen, 
  onClose, 
  postData,
  platforms: initialPlatforms = []
}: SchedulePostModalProps) {
  const { session } = useAuth()
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  
  // Editable post data
  const [editableText, setEditableText] = useState(postData.text)
  const [editableHashtags, setEditableHashtags] = useState(postData.hashtags.join(' '))
  
  // Connected platforms and selection
  const [connectedPlatforms, setConnectedPlatforms] = useState<Connection[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialPlatforms)
  const [loadingConnections, setLoadingConnections] = useState(true)
  
  // Update editable fields when postData changes
  useEffect(() => {
    setEditableText(postData.text)
    setEditableHashtags(postData.hashtags.join(' '))
  }, [postData])

  // Fetch connected platforms
  useEffect(() => {
    if (isOpen && session) {
      fetchConnections()
    }
  }, [isOpen, session])

  const fetchConnections = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/social/connections`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch connections')
      
      const data = await response.json()
      let connected = (data.connections || []).filter((c: Connection) => c.is_connected)
      
      // Filter out TikTok for image/text posts (TikTok only accepts videos)
      // Only show TikTok if post has video content
      const hasVideo = postData.imageUrl?.includes('video') || postData.imageUrl?.includes('.mp4')
      if (!hasVideo) {
        connected = connected.filter((c: Connection) => c.platform !== 'tiktok')
      }
      
      setConnectedPlatforms(connected)
      
      // Only pre-select platforms if they were passed as props
      if (initialPlatforms.length > 0 && selectedPlatforms.length === 0) {
        setSelectedPlatforms(initialPlatforms)
      }
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoadingConnections(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  if (!isOpen) return null

  const getUpdatedPostData = () => {
    // Parse hashtags from string
    const hashtagArray = editableHashtags
      .split(/[\s,]+/)
      .map(tag => tag.replace(/^#/, '').trim())
      .filter(tag => tag.length > 0)
    
    return {
      ...postData,
      text: editableText,
      hashtags: hashtagArray
    }
  }

  const handleSchedule = async () => {
    if (!session) {
      alert('Please sign in to schedule posts')
      return
    }

    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform')
      return
    }

    setIsPosting(true)
    
    try {
      const apiUrl = getApiUrl()
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const updatedPostData = getUpdatedPostData()
      
      if (scheduleType === 'now') {
        // Post immediately
        const response = await fetch(`${apiUrl}/api/scheduling/publish-now`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            post_data: updatedPostData,
            platforms: selectedPlatforms,
            scheduled_time: new Date().toISOString(),
            timezone: userTimezone
          })
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || 'Publishing failed')
        }
        
        alert('✅ Post is being published! It will appear on your connected platforms shortly.')
      } else {
        // Schedule for later
        if (!scheduledDate || !scheduledTime) {
          alert('Please select both date and time')
          return
        }
        
        const scheduleDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
        
        const response = await fetch(`${apiUrl}/api/scheduling/schedule`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            post_data: updatedPostData,
            platforms: selectedPlatforms,
            scheduled_time: scheduleDateTime.toISOString(),
            timezone: userTimezone
          })
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || 'Scheduling failed')
        }
        
        alert(`✅ Post scheduled for ${scheduleDateTime.toLocaleString()}!`)
      }
      
      onClose()
    } catch (error) {
      console.error('Scheduling error:', error)
      alert(`❌ Failed to schedule post: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsPosting(false)
    }
  }

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Schedule Post</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              When do you want to post?
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setScheduleType('now')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  scheduleType === 'now'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Send className="w-5 h-5" />
                Post Now
              </button>
              <button
                onClick={() => setScheduleType('later')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  scheduleType === 'later'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Schedule for Later
              </button>
            </div>
          </div>

          {/* Date & Time Picker (if scheduling for later) */}
          {scheduleType === 'later' && (
            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={today}
                    className="w-full px-4 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition"
                    required
                  />
                </div>
              </div>
              
              {scheduledDate && scheduledTime && (
                <div className="text-sm text-purple-700 dark:text-purple-300">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Will be posted on: {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Platform Selection */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-3">
              Select Platforms to Post:
            </h4>
            
            {loadingConnections ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : connectedPlatforms.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No connected platforms. Please connect platforms in Settings first.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {connectedPlatforms.map((connection) => {
                  const config = PLATFORM_CONFIG[connection.platform as keyof typeof PLATFORM_CONFIG]
                  const isSelected = selectedPlatforms.includes(connection.platform)
                  
                  return (
                    <label
                      key={connection.platform}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePlatform(connection.platform)}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-2xl">{config?.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {config?.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          @{connection.platform_username}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            
            {/* TikTok Notice for image posts */}
            {!postData.imageUrl?.includes('video') && !postData.imageUrl?.includes('.mp4') && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span><strong>Note:</strong> TikTok only accepts video content. Use Video Dubbing feature to create TikTok videos.</span>
                </p>
              </div>
            )}
          </div>

          {/* Edit Post Content */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-4">
            <h4 className="font-semibold text-gray-800 dark:text-white">Edit Post Content:</h4>
            
            {/* Media Preview */}
            {postData.imageUrl && (
              <div className="mb-3 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600">
                {postData.imageUrl.includes('video') || postData.imageUrl.includes('.mp4') ? (
                  <video 
                    src={postData.imageUrl} 
                    controls
                    className="w-full max-h-64 bg-black"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img 
                    src={postData.imageUrl} 
                    alt="Post" 
                    className="w-full h-48 object-cover"
                  />
                )}
              </div>
            )}
            
            {/* Editable Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Post Text:
              </label>
              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition resize-none"
                placeholder="Enter your post text..."
              />
            </div>
            
            {/* Editable Hashtags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hashtags (separate with spaces):
              </label>
              <input
                type="text"
                value={editableHashtags}
                onChange={(e) => setEditableHashtags(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition"
                placeholder="#AI #VideoTranslation #Dubbing"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter hashtags with or without # symbol
              </p>
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
            onClick={handleSchedule}
            disabled={
              isPosting || 
              selectedPlatforms.length === 0 ||
              (scheduleType === 'later' && (!scheduledDate || !scheduledTime))
            }
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {isPosting && <Loader2 className="w-4 h-4 animate-spin" />}
            {scheduleType === 'now' ? 'Post Now' : 'Schedule Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
