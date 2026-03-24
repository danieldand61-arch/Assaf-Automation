import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, AlertTriangle, Trash2, Plus, MessageSquare, ChevronLeft, ChevronRight, BarChart3, Rocket, Target, Palette, Zap, ImagePlus, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useApp } from '../contexts/AppContext'
import { getJoyoTheme } from '../styles/joyo-theme'
import { getApiUrl } from '../lib/api'

interface Message { role: 'user' | 'assistant'; content: string; image?: string }
interface ChatItem { id: string; title: string; created_at: string; updated_at: string; message_count?: number }

const QUICK_ACTIONS_BASE = [
  { icon: BarChart3, titleKey: 'qaAnalyzeCac' as const, descKey: 'qaAnalyzeCacDesc' as const, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', prompt: 'Analyze my Customer Acquisition Cost (CAC)' },
  { icon: Target, titleKey: 'qaRetargeting' as const, descKey: 'qaRetargetingDesc' as const, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', prompt: 'Develop a Re-targeting Roadmap' },
  { icon: Palette, titleKey: 'qaBrandTone' as const, descKey: 'qaBrandToneDesc' as const, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', prompt: 'Audit my Brand Tone Consistency' },
  { icon: Zap, titleKey: 'qaFlywheel' as const, descKey: 'qaFlywheelDesc' as const, color: '#10B981', bg: 'rgba(16,185,129,0.1)', prompt: 'Build a Growth Flywheel strategy' },
]

function isRTL(text: string): boolean {
  const hebrewRange = /[\u0590-\u05FF\uFB1D-\uFB4F]/
  return hebrewRange.test(text.slice(0, 100))
}

function renderMarkdown(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:700;margin:16px 0 6px;color:inherit">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:18px 0 8px;color:inherit">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-size:16px;font-weight:800;margin:20px 0 8px;color:inherit">$1</h2>')
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.08);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
  html = html.replace(/^[-•]\s+(.+)$/gm, '<div style="padding-left:16px;margin:3px 0">• $1</div>')
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="padding-left:16px;margin:3px 0">$1. $2</div>')
  html = html.replace(/\n\n+/g, '<div style="margin:12px 0"></div>')
  html = html.replace(/\n/g, '<br/>')
  return html
}

export default function AIAdvisor() {
  const { session, user } = useAuth()
  const { theme } = useTheme()
  const { t } = useApp()
  const th = getJoyoTheme(theme)
  const api = getApiUrl()
  const isDark = theme === 'dark'

  const [chats, setChats] = useState<ChatItem[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingChats, setLoadingChats] = useState(true)
  const [hasAds, setHasAds] = useState<boolean | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const headers = session ? { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } : {}

  const quickActions = QUICK_ACTIONS_BASE.map(a => ({ ...a, title: t(a.titleKey), desc: t(a.descKey) }))

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!session) return
    fetchChats()
    checkAds()
  }, [session])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  const fetchChats = async () => {
    try {
      const res = await fetch(`${api}/api/chats/list`, { headers: headers as any })
      if (res.ok) { const data = await res.json(); setChats(data.chats || []) }
    } catch { /* silent */ }
    finally { setLoadingChats(false) }
  }

  const checkAds = async () => {
    try {
      const res = await fetch(`${api}/api/analytics/sync-status`, { headers: headers as any })
      if (res.ok) { const d = await res.json(); setHasAds(d.syncs?.length > 0) }
      else setHasAds(false)
    } catch { setHasAds(false) }
  }

  const loadChat = async (chatId: string) => {
    setActiveChatId(chatId)
    setMessages([])
    try {
      const res = await fetch(`${api}/api/chats/${chatId}/messages`, { headers: headers as any })
      if (res.ok) {
        const data = await res.json()
        setMessages((data.messages || [])
          .filter((m: any) => m.role !== 'system')
          .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })))
      }
    } catch { /* silent */ }
  }

  const createNewChat = () => { setActiveChatId(null); setMessages([]); setInput('') }

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('deleteChat'))) return
    try {
      await fetch(`${api}/api/chats/${chatId}`, { method: 'DELETE', headers: headers as any })
      setChats(prev => prev.filter(c => c.id !== chatId))
      if (activeChatId === chatId) createNewChat()
    } catch { /* silent */ }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) { alert(t('imageUnder10mb')); return }
    const reader = new FileReader()
    reader.onload = () => setAttachedImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = () => setAttachedImage(reader.result as string)
        reader.readAsDataURL(file)
        break
      }
    }
  }

  const sendMessage = async (text: string) => {
    if ((!text.trim() && !attachedImage) || loading || !session) return
    const imageToSend = attachedImage
    setMessages(prev => [...prev, { role: 'user', content: text.trim() || t('screenshot'), image: imageToSend || undefined }])
    setInput('')
    setAttachedImage(null)
    setLoading(true)
    try {
      let cid = activeChatId
      if (!cid) {
        const createRes = await fetch(`${api}/api/chats/create`, {
          method: 'POST', headers: headers as any,
          body: JSON.stringify({ title: text.slice(0, 50) || t('screenshotAnalysis') }),
        })
        if (!createRes.ok) throw new Error(`Create chat failed: ${createRes.status}`)
        const createData = await createRes.json()
        cid = createData.chat?.id || createData.chat_id || createData.id
        if (!cid) throw new Error('No chat ID returned')
        setActiveChatId(cid)
        fetchChats()
      }
      const body: any = { content: text.trim() || t('analyzeScreenshot'), mode: 'advisor' }
      if (imageToSend) body.image = imageToSend
      const msgRes = await fetch(`${api}/api/chats/${cid}/message`, {
        method: 'POST', headers: headers as any,
        body: JSON.stringify(body),
      })
      if (!msgRes.ok) throw new Error(`Message failed: ${msgRes.status}`)
      const msgData = await msgRes.json()
      const reply = msgData.assistant_message?.content || msgData.response || msgData.message || t('noResponseReceived')
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message || 'Connection failed.'}` }])
    } finally { setLoading(false) }
  }

  const activeChat = chats.find(c => c.id === activeChatId)
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', maxWidth: 1400, margin: '0 auto', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarOpen ? 272 : 0, minWidth: sidebarOpen ? 272 : 0,
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
        background: isDark ? '#1A1D2B' : '#FFFFFF',
        borderRight: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${isDark ? '#2A2D3E' : '#F0F2F5'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: th.gradient1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: th.text, letterSpacing: -0.3 }}>{t('aiAdvisor')}</div>
              <div style={{ fontSize: 11, color: th.textMuted, fontWeight: 500 }}>{t('strategicSuite')}</div>
            </div>
          </div>

          <button onClick={createNewChat} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 14px', borderRadius: 10, border: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`,
            background: 'transparent', color: th.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#252838' : '#F7F8FB' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Plus size={15} /> {t('newChat')}
          </button>
        </div>

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <div style={{ padding: '0 8px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: th.textMuted }}>
            {t('recentChats')}
          </div>
          {loadingChats ? (
            <div style={{ textAlign: 'center', padding: 24, color: th.textMuted, fontSize: 12 }}>
              <Loader2 size={16} className="animate-spin" style={{ display: 'inline-block' }} />
            </div>
          ) : chats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: th.textMuted, fontSize: 12 }}>{t('noChatsYet')}</div>
          ) : (
            chats.map(chat => (
              <div key={chat.id} onClick={() => loadChat(chat.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 10,
                cursor: 'pointer', marginBottom: 2, transition: 'all 0.15s',
                background: activeChatId === chat.id ? (isDark ? 'rgba(74,124,255,0.12)' : 'rgba(74,124,255,0.08)') : 'transparent',
              }}
                onMouseEnter={e => { if (activeChatId !== chat.id) e.currentTarget.style.background = isDark ? '#252838' : '#F7F8FB' }}
                onMouseLeave={e => { if (activeChatId !== chat.id) e.currentTarget.style.background = 'transparent' }}
              >
                <MessageSquare size={15} style={{ color: activeChatId === chat.id ? th.accent : th.textMuted, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 13, fontWeight: activeChatId === chat.id ? 600 : 500,
                    color: activeChatId === chat.id ? th.text : th.textSecondary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{chat.title || t('untitled')}</div>
                  <div style={{ fontSize: 10, color: th.textMuted, marginTop: 2 }}>
                    {new Date(chat.updated_at || chat.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button onClick={(e) => deleteChat(chat.id, e)} style={{
                  padding: 4, border: 'none', background: 'transparent', cursor: 'pointer',
                  borderRadius: 6, opacity: 0, transition: 'opacity 0.15s', color: th.danger,
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer — User */}
        <div style={{
          padding: '12px 16px', borderTop: `1px solid ${isDark ? '#2A2D3E' : '#F0F2F5'}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: `${th.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: th.accent, fontSize: 14, fontWeight: 700,
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: th.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
            <div style={{ fontSize: 10, color: th.textMuted }}>{t('premiumAccount')}</div>
          </div>
        </div>
      </aside>

      {/* ── Sidebar Toggle ── */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
        width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isDark ? '#1A1D2B' : '#fff', border: 'none',
        borderRight: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`,
        cursor: 'pointer', color: th.textMuted, transition: 'all 0.15s',
      }}>
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* ── Main Area ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: isDark ? '#0F1117' : '#F8FAFC', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', borderBottom: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`,
          background: isDark ? 'rgba(30,33,48,0.6)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: th.accent }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: th.text, letterSpacing: -0.3 }}>
              {activeChat?.title || t('strategicAdvisor')}
            </h2>
          </div>
          {activeChatId && (
            <span style={{ fontSize: 11, color: th.textMuted }}>
              {new Date(activeChat?.created_at || '').toLocaleDateString()}
            </span>
          )}
        </header>

        {/* Alert Banner */}
        {hasAds === false && (
          <div style={{ padding: '12px 24px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              borderRadius: 12, border: `1px solid ${isDark ? '#3D3520' : '#FEF3C7'}`,
              background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.05)',
              padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={16} style={{ color: '#F59E0B' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{t('adPlatformsDisconnected')}</div>
                  <div style={{ fontSize: 12, color: th.textSecondary }}>{t('reconnectAdsDesc')}</div>
                </div>
              </div>
              <button style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: th.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'transform 0.1s',
              }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >{t('reconnect')}</button>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {messages.length === 0 ? (
            /* ── Welcome Screen ── */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20, transform: 'rotate(3deg)',
                background: isDark ? 'rgba(74,124,255,0.15)' : 'rgba(99,102,241,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
              }}>
                <Rocket size={36} style={{ color: th.accent }} />
              </div>

              <h1 style={{
                fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, textAlign: 'center',
                color: th.text, marginBottom: 12, letterSpacing: -0.8, lineHeight: 1.15,
              }}>
                {t('strategicChallenge')}
              </h1>

              <p style={{
                fontSize: 15, color: th.textMuted, textAlign: 'center', maxWidth: 520,
                lineHeight: 1.6, marginBottom: 40,
              }}>
                {t('leverageAi')}
              </p>

              {/* Quick Action Cards */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12, width: '100%', maxWidth: 720,
              }}>
                {quickActions.map((action, i) => (
                  <button key={i} onClick={() => sendMessage(action.prompt)} style={{
                    display: 'flex', flexDirection: 'column', padding: 18, borderRadius: 16,
                    background: isDark ? '#1E2130' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `${th.accent}60`
                      e.currentTarget.style.boxShadow = `0 8px 24px ${th.accent}12`
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = isDark ? '#2A2D3E' : '#E5E9F0'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 12, transition: 'transform 0.2s',
                    }}>
                      <action.icon size={18} style={{ color: action.color }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: th.text, marginBottom: 4 }}>{action.title}</div>
                    <div style={{ fontSize: 11, color: th.textMuted, lineHeight: 1.4 }}>{action.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Messages ── */
            <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map((msg, i) => {
                const rtl = isRTL(msg.content)
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'user' ? (
                      <div style={{
                        maxWidth: '75%', borderRadius: '18px 18px 4px 18px', overflow: 'hidden',
                        background: th.accent, color: '#fff',
                      }}>
                        {msg.image && (
                          <img src={msg.image} alt="attachment" style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
                        )}
                        {msg.content && msg.content !== t('screenshot') && (
                          <div style={{
                            padding: '12px 16px', fontSize: 13, lineHeight: 1.65,
                            direction: rtl ? 'rtl' : undefined, textAlign: rtl ? 'right' : undefined,
                          }}>{msg.content}</div>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        maxWidth: '82%', padding: '12px 16px', borderRadius: '18px 18px 18px 4px',
                        background: isDark ? '#1E2130' : '#FFFFFF', color: th.text,
                        border: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`, fontSize: 13, lineHeight: 1.65,
                        direction: rtl ? 'rtl' : undefined, textAlign: rtl ? 'right' : undefined,
                      }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    )}
                  </div>
                )
              })}

              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '12px 16px', borderRadius: '18px 18px 18px 4px',
                    background: isDark ? '#1E2130' : '#FFFFFF', border: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: th.accent }} />
                    <span style={{ fontSize: 12, color: th.textMuted }}>{t('thinking')}</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input Area ── */}
        <div style={{
          padding: '16px 24px 20px',
          background: isDark
            ? 'linear-gradient(to top, #0F1117 60%, transparent)'
            : 'linear-gradient(to top, #F8FAFC 60%, transparent)',
        }}>
          <div style={{
            maxWidth: 720, margin: '0 auto',
            background: isDark ? '#1E2130' : '#FFFFFF', borderRadius: 16,
            border: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`,
            boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)',
            transition: 'box-shadow 0.2s', overflow: 'hidden',
          }}>
            {/* Image preview */}
            {attachedImage && (
              <div style={{ padding: '8px 8px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={attachedImage} alt="attachment" style={{
                    maxHeight: 120, maxWidth: 200, borderRadius: 10, objectFit: 'cover', display: 'block',
                    border: `1px solid ${isDark ? '#2A2D3E' : '#E5E9F0'}`,
                  }} />
                  <button onClick={() => setAttachedImage(null)} style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 20, height: 20, borderRadius: '50%', border: 'none',
                    background: isDark ? '#374151' : '#E5E7EB', color: th.text,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}>
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
            {/* Input row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, padding: 8 }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                background: 'transparent', color: th.textMuted, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#252838' : '#F0F2F5'; e.currentTarget.style.color = th.accent }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = th.textMuted }}
                title={t('attachScreenshot')}
              >
                <ImagePlus size={18} />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                onPaste={handlePaste}
                placeholder={t('advisorPlaceholder')}
                rows={1}
                style={{
                  flex: 1, padding: '8px 8px', borderRadius: 10, fontSize: 13, outline: 'none',
                  background: 'transparent', border: 'none', color: th.text, resize: 'none',
                  lineHeight: 1.5, fontFamily: 'inherit', maxHeight: 120,
                }}
              />
              <button onClick={() => sendMessage(input)} disabled={loading || (!input.trim() && !attachedImage)} style={{
                width: 40, height: 40, borderRadius: 12, border: 'none', flexShrink: 0,
                background: th.accent, color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: loading || (!input.trim() && !attachedImage) ? 0.4 : 1,
                transition: 'all 0.15s', boxShadow: `0 2px 8px ${th.accent}40`,
              }}
                onMouseDown={e => { if (!loading && (input.trim() || attachedImage)) e.currentTarget.style.transform = 'scale(0.92)' }}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: th.textMuted, marginTop: 10, fontWeight: 500 }}>
            {t('advisorDisclaimer')}
          </p>
        </div>
      </main>
    </div>
  )
}
