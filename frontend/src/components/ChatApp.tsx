import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../lib/api'
import { Plus, MessageSquare, Trash2, Send, Loader2, X } from 'lucide-react'
import { InputSection } from './InputSection'
import { PreviewSection } from './PreviewSection'
import { LoadingState } from './LoadingState'
import { VideoTranslation } from './VideoTranslation'
import { useContentStore } from '../store/contentStore'
import Header from './Header'

interface Chat {
  id: string
  title: string
  created_at: string
  last_message_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

type ActiveTool = null | 'post_generation' | 'video_dubbing'

export function ChatApp() {
  const { session } = useAuth()
  const { generatedContent, setGeneratedContent } = useContentStore()
  
  const [showChat, setShowChat] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (session && activeChat) {
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

  const createFirstChat = async () => {
    if (!session) return null
    
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
      
      setChats([newChat])
      setActiveChat(newChat)
      setShowChat(true)
      
      return newChat
    } catch (error) {
      console.error('Error creating chat:', error)
      return null
    }
  }

  const handleGetStarted = async () => {
    await createFirstChat()
  }

  const createNewChat = async () => {
    const chat = await createFirstChat()
    if (chat) {
      setMessages([])
      setGeneratedContent(null)
      setActiveTool(null)
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
      
      const remainingChats = chats.filter(c => c.id !== chatId)
      setChats(remainingChats)
      
      if (activeChat?.id === chatId) {
        if (remainingChats.length > 0) {
          setActiveChat(remainingChats[0])
        } else {
          setActiveChat(null)
          setShowChat(false)
          setMessages([])
        }
      }
      
      await loadChats()
    } catch (error) {
      console.error('Error deleting chat:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || !activeChat) return

    const userMessage = inputMessage
    setInputMessage('')
    setIsLoading(true)

    try {
      const apiUrl = getApiUrl()
      
      const tempUserMsg: Message = {
        id: 'temp-' + Date.now(),
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, tempUserMsg])

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
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMsg.id),
        data.user_message,
        data.assistant_message
      ])
      
      loadChats()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToolClick = (tool: ActiveTool) => {
    setActiveTool(tool)
    setGeneratedContent(null)
  }

  const handleCloseTool = () => {
    setActiveTool(null)
    setGeneratedContent(null)
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
      
      if (!data || !data.variations || data.variations.length === 0) {
        throw new Error('No content generated')
      }
      
      setGeneratedContent({
        ...data,
        website_data: data.website_data,
        request_params: formData
      })
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate content')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReset = () => {
    setGeneratedContent(null)
  }

  // Landing Page
  if (!showChat) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-full inline-block mb-6">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
              Create Stunning Social Posts
            </h1>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
              in Seconds, Not Hours
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-3xl mx-auto">
              Transform any website into engaging social media content with AI. Generate posts, images, and captions tailored for Instagram, Facebook, LinkedIn, and more.
            </p>
          </div>
          
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Content
          </button>
          
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            ✨ No credit card required • 🚀 Start generating in 30 seconds
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full inline-block mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI-Powered Generation</h3>
              <p className="text-gray-600 dark:text-gray-400">Our AI analyzes websites and creates engaging posts with captions, hashtags, and images in one go.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full inline-block mb-4">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Multi-Platform Support</h3>
              <p className="text-gray-600 dark:text-gray-400">Create content optimized for Facebook, Instagram, LinkedIn, Twitter, and more.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <div className="bg-pink-100 dark:bg-pink-900/30 p-4 rounded-full inline-block mb-4">
                <svg className="w-8 h-8 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Custom Image Generation</h3>
              <p className="text-gray-600 dark:text-gray-400">AI creates unique images in any aspect ratio focusing on landscape, portrait, or your specs.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Chat Interface
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                setActiveChat(chat)
                setActiveTool(null)
                setGeneratedContent(null)
              }}
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
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <Header />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

          {/* Active Tool Content */}
          {activeTool === 'post_generation' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-2 border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Generate Post</h3>
                <button
                  onClick={handleCloseTool}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {isGenerating ? (
                <LoadingState />
              ) : generatedContent ? (
                <PreviewSection onReset={handleReset} />
              ) : (
                <InputSection onGenerate={handleGenerate} />
              )}
            </div>
          )}

          {activeTool === 'video_dubbing' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-2 border-pink-200 dark:border-pink-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Video Dubbing</h3>
                <button
                  onClick={handleCloseTool}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <VideoTranslation />
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 mb-3">
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
            
            {/* Tool Buttons - Inactive until clicked */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleToolClick('video_dubbing')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  activeTool === 'video_dubbing'
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-pink-100 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                AI Dubbing
              </button>
              <button
                onClick={() => handleToolClick('post_generation')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  activeTool === 'post_generation'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Generate Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
