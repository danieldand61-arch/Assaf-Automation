import { useState } from 'react'
import { MessageSquare, X, Send, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAccount } from '../contexts/AccountContext'
import { useTheme } from '../contexts/ThemeContext'
import { getJoyoTheme } from '../styles/joyo-theme'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { session } = useAuth()
  const { activeAccount } = useAccount()
  const { theme } = useTheme()
  
  const JoyoTheme = getJoyoTheme(theme)

  const handleSend = async () => {
    if (!input.trim() || loading || !session) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://assaf-automation-production.up.railway.app'
      
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: input,
          account_id: activeAccount?.id,
          history: messages.slice(-10)
        })
      })

      if (!response.ok) throw new Error('Chat request failed')

      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
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
            boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
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
                👋 Hi! How can I help you today?
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? JoyoTheme.accent : 'white',
                  color: msg.role === 'user' ? 'white' : JoyoTheme.text,
                  fontSize: 13,
                  lineHeight: 1.5,
                  boxShadow: msg.role === 'user' ? 'none' : '0 2px 8px rgba(0,0,0,0.08)'
                }}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4 }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: JoyoTheme.accent }} />
              </div>
            )}
          </div>

          {/* Input */}
          <div
            style={{
              padding: '14px',
              borderTop: `1px solid ${JoyoTheme.border}`,
              display: 'flex',
              gap: 8
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: `1px solid ${JoyoTheme.border}`,
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
