import { useState } from 'react'
import { getApiUrl } from '../lib/api'
import { X, Calendar, Clock, Send, Loader2 } from 'lucide-react'

interface SchedulePostModalProps {
  isOpen: boolean
  onClose: () => void
  postData: {
    text: string
    hashtags: string[]
    cta: string
    imageUrl: string
  }
  platforms: string[]
}

export function SchedulePostModal({ 
  isOpen, 
  onClose, 
  postData,
  platforms 
}: SchedulePostModalProps) {
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isPosting, setIsPosting] = useState(false)

  if (!isOpen) return null

  const handleSchedule = async () => {
    setIsPosting(true)
    
    try {
      const apiUrl = getApiUrl()
      
      if (scheduleType === 'now') {
        // Post immediately (mock for now)
        console.log('📤 Posting immediately to:', platforms)
        alert('✅ Post published successfully! (Mock - actual publishing not implemented yet)')
      } else {
        // Schedule for later
        const scheduleDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
        
        const response = await fetch(`${apiUrl}/api/scheduling/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_data: postData,
            platforms,
            scheduled_time: scheduleDateTime.toISOString()
          })
        })
        
        if (!response.ok) throw new Error('Scheduling failed')
        
        alert(`✅ Post scheduled for ${scheduleDateTime.toLocaleString()}!`)
      }
      
      onClose()
    } catch (error) {
      console.error('Scheduling error:', error)
      alert('❌ Failed to schedule post. Please try again.')
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

          {/* Platforms Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Publishing to:</h4>
            <div className="flex flex-wrap gap-2">
              {platforms.map((platform) => (
                <span
                  key={platform}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium capitalize"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>

          {/* Post Preview */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Post Preview:</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
              {postData.text}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {postData.hashtags.slice(0, 5).map((tag, i) => (
                <span key={i} className="text-xs text-blue-600 dark:text-blue-400">
                  #{tag}
                </span>
              ))}
              {postData.hashtags.length > 5 && (
                <span className="text-xs text-gray-500">+{postData.hashtags.length - 5} more</span>
              )}
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
            disabled={isPosting || (scheduleType === 'later' && (!scheduledDate || !scheduledTime))}
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
