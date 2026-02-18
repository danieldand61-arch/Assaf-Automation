import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme } from '../styles/joyo-theme'
import { getApiUrl } from '../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // headers
  html = html.replace(/^### (.+)$/gm, '<strong style="font-size:14px">$1</strong>')
  html = html.replace(/^## (.+)$/gm, '<strong style="font-size:15px">$1</strong>')
  html = html.replace(/^# (.+)$/gm, '<strong style="font-size:16px">$1</strong>')
  // bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.1);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
  // bullet lists
  html = html.replace(/^[-•]\s+(.+)$/gm, '<span style="display:block;padding-left:12px">• $1</span>')
  // numbered lists
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<span style="display:block;padding-left:12px">$1. $2</span>')
  return html
}

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const { session } = useAuth()

  const { theme } = useTheme()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const JoyoTheme = getJoyoTheme(theme)
  const apiUrl = getApiUrl()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const ensureChat = async (): Promise<string | null> => {
    if (chatId) return chatId

    try {
      const res = await fetch(`${apiUrl}/api/chats/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`
        },
        body: JSON.stringify({ title: 'Quick Chat' })
      })
      if (!res.ok) throw new Error('Failed to create chat')
      const data = await res.json()
      const id = data.chat?.id || data.id
      setChatId(id)
      return id
    } catch (e) {
      console.error('Failed to create chat:', e)
      return null
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !session) return

    const userMessage: Message = { role: 'user', content: input }
    const text = input
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const id = await ensureChat()
      if (!id) throw new Error('No chat session')

      const response = await fetch(`${apiUrl}/api/chats/${id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ content: text })
      })

      if (!response.ok) throw new Error(`Chat request failed: ${response.status}`)

      const data = await response.json()
      const reply = data.assistant_message?.content || data.response || 'No response'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  // Dark theme: use explicit light/dark colors for message bubbles
  const isDark = theme === 'dark'
  const userBubbleBg = JoyoTheme.accent
  const assistantBubbleBg = isDark ? '#2A2D3E' : '#F0F1F5'
  const assistantTextColor = isDark ? '#E8EAF0' : '#1A1D2B'
  const inputBg = isDark ? '#1A1D2B' : '#FFFFFF'
  const inputColor = isDark ? '#E8EAF0' : '#151821'

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: JoyoTheme.gradient1,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(74,124,255,0.4)',
            transition: 'transform 0.2s',
            zIndex: 1000
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageSquare size={26} color="white" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 380,
            height: 550,
            background: JoyoTheme.card,
            borderRadius: 16,
            boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              background: JoyoTheme.gradient1,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageSquare size={20} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>AI Assistant</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Ask me anything</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: JoyoTheme.surfaceSecondary
            }}
          >
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: JoyoTheme.textSecondary,
                fontSize: 13,
                marginTop: 40
              }}>
                Hi! How can I help you today?
              </div>
            )}
            {messages.map((msg, i) => {
              const bubbleStyle = {
                alignSelf: msg.role === 'user' ? 'flex-end' as const : 'flex-start' as const,
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: 12,
                background: msg.role === 'user' ? userBubbleBg : assistantBubbleBg,
                color: msg.role === 'user' ? '#FFFFFF' : assistantTextColor,
                fontSize: 13,
                lineHeight: 1.6,
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                wordBreak: 'break-word' as const
              }
              return msg.role === 'assistant' ? (
                <div key={i} style={bubbleStyle} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              ) : (
                <div key={i} style={bubbleStyle}>{msg.content}</div>
              )
            })}
            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: assistantBubbleBg }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: JoyoTheme.accent }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '14px',
              borderTop: `1px solid ${JoyoTheme.border}`,
              display: 'flex',
              gap: 8,
              background: JoyoTheme.card
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type your message..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: `1px solid ${JoyoTheme.border}`,
                background: inputBg,
                color: inputColor,
                fontSize: 13,
                outline: 'none'
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: 'none',
                background: input.trim() && !loading ? JoyoTheme.accent : JoyoTheme.border,
                color: 'white',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
