import { useState, useEffect } from 'react'
import { X, Wand2, Zap, Smile, SmilePlus, Type, Loader2 } from 'lucide-react'

interface PostEditModalProps {
  isOpen: boolean
  onClose: () => void
  initialText: string
  initialHashtags: string[]
  initialCTA: string
  onSave: (text: string, hashtags: string[], cta: string) => void
  language: string
}

export function PostEditModal({ 
  isOpen, 
  onClose, 
  initialText, 
  initialHashtags, 
  initialCTA,
  onSave,
  language 
}: PostEditModalProps) {
  const [text, setText] = useState(initialText)
  const [hashtags, setHashtags] = useState<string[]>(initialHashtags)
  const [cta, setCTA] = useState(initialCTA)
  const [newHashtag, setNewHashtag] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingAction, setProcessingAction] = useState('')

  useEffect(() => {
    setText(initialText)
    setHashtags(initialHashtags)
    setCTA(initialCTA)
  }, [initialText, initialHashtags, initialCTA])

  if (!isOpen) return null

  const platformLimits = {
    'Instagram': 2200,
    'Facebook': 63206,
    'Twitter/X': 280,  // Базовый лимит (Premium: 25000)
    'LinkedIn': 3000
  }

  const handleAIAction = async (action: string, tone?: string) => {
    setIsProcessing(true)
    setProcessingAction(action)
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/content/edit-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          action,
          tone,
          language
        })
      })
      
      if (!response.ok) throw new Error('AI action failed')
      
      const data = await response.json()
      setText(data.edited)
    } catch (error) {
      console.error('AI action error:', error)
      alert('AI editing failed. Please try again.')
    } finally {
      setIsProcessing(false)
      setProcessingAction('')
    }
  }

  const addHashtag = () => {
    if (newHashtag && !hashtags.includes(newHashtag)) {
      setHashtags([...hashtags, newHashtag.replace('#', '')])
      setNewHashtag('')
    }
  }

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag))
  }

  const handleSave = () => {
    onSave(text, hashtags, cta)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Edit Post</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* AI Quick Actions */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-gray-800 dark:text-white">AI Actions</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAIAction('shorten')}
                disabled={isProcessing}
                className="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {processingAction === 'shorten' ? 'Processing...' : 'Shorten'}
              </button>
              <button
                onClick={() => handleAIAction('lengthen')}
                disabled={isProcessing}
                className="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
              >
                <Type className="w-4 h-4" />
                {processingAction === 'lengthen' ? 'Processing...' : 'Expand'}
              </button>
              <button
                onClick={() => handleAIAction('add_emojis')}
                disabled={isProcessing}
                className="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
              >
                <SmilePlus className="w-4 h-4" />
                {processingAction === 'add_emojis' ? 'Processing...' : 'Add Emojis'}
              </button>
              <button
                onClick={() => handleAIAction('remove_emojis')}
                disabled={isProcessing}
                className="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
              >
                <Smile className="w-4 h-4" />
                {processingAction === 'remove_emojis' ? 'Processing...' : 'Remove Emojis'}
              </button>
              <select
                onChange={(e) => e.target.value && handleAIAction('change_tone', e.target.value)}
                disabled={isProcessing}
                className="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                <option value="">Change Tone...</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="funny">Funny</option>
                <option value="inspirational">Inspirational</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Left: Editor */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Post Text
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition resize-none"
                  rows={10}
                  placeholder="Write your post..."
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {text.length} characters
                </div>
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Hashtags
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
                    placeholder="Add hashtag..."
                    className="flex-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition text-sm"
                  />
                  <button
                    onClick={addHashtag}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition text-sm"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      #{tag}
                      <button
                        onClick={() => removeHashtag(tag)}
                        className="hover:text-red-600 dark:hover:text-red-400 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Call-to-Action
                </label>
                <input
                  type="text"
                  value={cta}
                  onChange={(e) => setCTA(e.target.value)}
                  placeholder="Shop Now, Learn More..."
                  className="w-full px-4 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition text-sm"
                />
              </div>
            </div>

            {/* Right: Preview & Stats */}
            <div className="space-y-4">
              
              {/* Platform Character Limits */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 dark:text-white mb-3">Platform Limits</h4>
                <div className="space-y-2">
                  {Object.entries(platformLimits).map(([platform, limit]) => {
                    const percentage = (text.length / limit) * 100
                    const isOver = text.length > limit
                    return (
                      <div key={platform}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">{platform}</span>
                          <span className={`font-medium ${isOver ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {text.length} / {limit}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full transition-all ${isOver ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Live Preview */}
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Preview
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full" />
                    <div>
                      <div className="font-bold text-gray-800 dark:text-white text-sm">Your Brand</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Just now</div>
                    </div>
                  </div>
                  
                  <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap mb-3">
                    {text || 'Your post text will appear here...'}
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {hashtags.map((tag, i) => (
                      <span key={i} className="text-xs text-blue-600 dark:text-blue-400">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {cta && (
                    <div className="mt-3 pt-3 border-t dark:border-gray-700">
                      <button className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {cta}
                      </button>
                    </div>
                  )}
                </div>
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
            disabled={isProcessing}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
