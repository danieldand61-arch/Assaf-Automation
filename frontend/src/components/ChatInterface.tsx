import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Send, Plus, MessageSquare, Loader2, Trash2, Video, Image, FileText } from 'lucide-react'
import { VideoTranslation } from '../components/VideoTranslation'
import { InputSection } from '../components/InputSection'
import { PreviewSection } from '../components/PreviewSection'
import { LoadingState } from '../components/LoadingState'
import { useContentStore } from '../store/contentStore'

interface Chat {
  id: string
  title: string
  created_at: string
  last_message_at: string
  message_count: number
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  action_type?: string
  action_data?: any
  created_at: string
}

type ActiveFeature = null | 'video_dubbing' | 'post_generation'

export function ChatInterface() {
  const { session } = useAuth()
  const { generatedContent, setGeneratedContent } = useContentStore()
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [activeFeature, setActiveFeature] = useState<ActiveFeature>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (session) {
      loadChats()
    }
  }, [session])

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id)
    }
  }, [activeChat])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChats = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/chats/list`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load chats')
      
      const data = await response.json()
      setChats(data.chats || [])
      
      // Auto-select first chat or create new one
      if (data.chats?.length > 0 && !activeChat) {
        setActiveChat(data.chats[0])
      } else if (data.chats?.length === 0) {
        createNewChat()
      }
    } catch (error) {
      console.error('Error loading chats:', error)
    }
  }

  const loadMessages = async (chatId: string) => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load messages')
      
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const createNewChat = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/chats/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ title: 'New Chat' })
      })
      
      if (!response.ok) throw new Error('Failed to create chat')
      
      const data = await response.json()
      const newChat = data.chat
      
      setChats([newChat, ...chats])
      setActiveChat(newChat)
      setMessages([])
      setActiveFeature(null)
    } catch (error) {
      console.error('Error creating chat:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || !activeChat) return

    setIsLoading(true)
    const userMessage = inputMessage
    setInputMessage('')

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(`${apiUrl}/api/chats/${activeChat.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ content: userMessage })
      })
      
      if (!response.ok) throw new Error('Failed to send message')
      
      const data = await response.json()
      
      // Add both user and assistant messages
      setMessages([...messages, data.user_message, data.assistant_message])
      
      // Reload chats to update last_message_at
      loadChats()
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteChat = async (chatId: string) => {
    if (!confirm('Delete this chat?')) return

    try {
      const apiUrl = getApiUrl()
      await fetch(`${apiUrl}/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      setChats(chats.filter(c => c.id !== chatId))
      
      if (activeChat?.id === chatId) {
        const remainingChats = chats.filter(c => c.id !== chatId)
        if (remainingChats.length > 0) {
          setActiveChat(remainingChats[0])
        } else {
          createNewChat()
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
    }
  }

  const handleFeatureClick = (feature: ActiveFeature) => {
    setActiveFeature(feature)
  }

  const closeFeature = () => {
    setActiveFeature(null)
    // Reload messages to show any generated content
    if (activeChat) {
      loadMessages(activeChat.id)
    }
  }

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true)
    
    const apiUrl = getApiUrl()
    
    try {
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }
      
      const data = await response.json()
      setGeneratedContent(data)
      
      // Save to chat history
      if (activeChat) {
        await fetch(`${apiUrl}/api/chats/${activeChat.id}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            content: `Generated post: ${data.text.substring(0, 100)}...`,
            action_type: 'post_generation',
            action_data: data
          })
        })
        
        await loadMessages(activeChat.id)
      }
      
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate content')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition mb-1 ${
                activeChat?.id === chat.id
                  ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {chat.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {chat.message_count} messages
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteChat(chat.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
              >
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {activeChat?.title || 'AI Assistant'}
            </h1>
          </div>
          
          {/* Feature close button */}
          {activeFeature && (
            <button
              onClick={closeFeature}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition"
            >
              Back to Chat
            </button>
          )}
        </div>

        {/* Feature View or Chat Messages */}
        {activeFeature ? (
          <div className="flex-1 overflow-y-auto p-6">
            {activeFeature === 'video_dubbing' && <VideoTranslation />}
            {activeFeature === 'post_generation' && (
              <>
                {isGenerating ? (
                  <LoadingState />
                ) : generatedContent ? (
                  <PreviewSection content={generatedContent} />
                ) : (
                  <InputSection onGenerate={handleGenerate} />
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-full mb-6">
                    <MessageSquare className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Welcome to AI Assistant
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                    I can help you create content, translate videos, and manage your social media.
                    Choose an action below or just chat with me!
                  </p>
                  
                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
                    <button
                      onClick={() => handleFeatureClick('post_generation')}
                      className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition border-2 border-transparent hover:border-purple-500"
                    >
                      <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full">
                        <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Generate Post</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create social media content</p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleFeatureClick('video_dubbing')}
                      className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition border-2 border-transparent hover:border-pink-500"
                    >
                      <div className="bg-pink-100 dark:bg-pink-900/30 p-4 rounded-full">
                        <Video className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">AI Dubbing</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Translate videos with AI</p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-3xl px-6 py-4 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        
                        {/* Show action buttons in assistant messages */}
                        {message.role === 'assistant' && (
                          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                              onClick={() => handleFeatureClick('post_generation')}
                              className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition text-sm"
                            >
                              <FileText className="w-4 h-4" />
                              Generate Post
                            </button>
                            <button
                              onClick={() => handleFeatureClick('video_dubbing')}
                              className="flex items-center gap-2 px-3 py-2 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-200 dark:hover:bg-pink-900/50 transition text-sm"
                            >
                              <Video className="w-4 h-4" />
                              AI Dubbing
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl shadow-md">
                        <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Quick Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleFeatureClick('post_generation')}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    Generate Post
                  </button>
                  <button
                    onClick={() => handleFeatureClick('video_dubbing')}
                    className="flex items-center gap-2 px-3 py-2 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-200 dark:hover:bg-pink-900/50 transition text-sm"
                  >
                    <Video className="w-4 h-4" />
                    AI Dubbing
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
