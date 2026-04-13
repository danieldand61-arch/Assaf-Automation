import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from '../lib/api'
import {
  Loader2, Search, ArrowUpDown, Users, DollarSign, Activity,
  LogOut, Plus, Coins, Shield, TrendingDown, CheckCircle,
  XCircle, Clock, Download, RefreshCw, Filter,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserStats {
  user_id: string
  email: string
  full_name: string
  total_credits: number
  credits_used: number
  credits_remaining: number
  usage_by_service: {
    [key: string]: {
      requests: number
      input_tokens: number
      output_tokens: number
      total_tokens: number
    }
  }
  total_requests: number
  last_activity: string
  bypass_subscription?: boolean
}

type DropOffStage = 'converted' | 'onboarding_done' | 'onboarding_started' | 'registered'

interface DropOffUser {
  user_id: string
  email: string
  full_name: string
  registered_at: string | null
  company_name: string
  website_url: string
  started_onboarding: boolean
  completed_onboarding: boolean
  completed_payment: boolean
  bypass_subscription: boolean
  last_activity: string | null
  stage: DropOffStage
}

type AdminTab = 'users' | 'dropoffs'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getApiUrl_ = getApiUrl

const SERVICE_INFO: Record<string, { name: string; icon: string }> = {
  social_posts:    { name: 'Social Posts',    icon: '📱' },
  image_generation:{ name: 'Image Gen',       icon: '🎨' },
  video_dubbing:   { name: 'Video Dubbing',   icon: '🎬' },
  video_generation:{ name: 'Video Gen',       icon: '🎥' },
  chat:            { name: 'AI Chat',         icon: '💬' },
  google_ads:      { name: 'Google Ads',      icon: '📊' },
  content_edit:    { name: 'Content Edit',    icon: '✏️'  },
}

const STAGE_CONFIG: Record<DropOffStage, { label: string; color: string; bg: string; icon: JSX.Element }> = {
  converted: {
    label: 'Converted',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    icon: <CheckCircle size={14} className="text-green-600 dark:text-green-400" />,
  },
  onboarding_done: {
    label: 'No Payment',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    icon: <Clock size={14} className="text-amber-600 dark:text-amber-400" />,
  },
  onboarding_started: {
    label: 'Incomplete Onboarding',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    icon: <TrendingDown size={14} className="text-orange-600 dark:text-orange-400" />,
  },
  registered: {
    label: 'Registered Only',
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-800',
    icon: <XCircle size={14} className="text-gray-500 dark:text-gray-400" />,
  },
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Admin() {
  const { session } = useAuth()
  const navigate = useNavigate()

  // ── Users tab state ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserStats[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'email' | 'credits' | 'requests'>('credits')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [error, setError] = useState('')
  const [creditModal, setCreditModal] = useState<{ user: UserStats } | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [addingCredits, setAddingCredits] = useState(false)
  const [bypassModal, setBypassModal] = useState<{ user: UserStats } | null>(null)
  const [bypassCredits, setBypassCredits] = useState('100000')
  const [bypassingAccess, setBypassingAccess] = useState(false)
  const [margin, setMargin] = useState(2.0)
  const [savedMargin, setSavedMargin] = useState(2.0)
  const [savingMargin, setSavingMargin] = useState(false)

  // ── Drop-offs tab state ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [dropOffs, setDropOffs] = useState<DropOffUser[]>([])
  const [dropOffsLoading, setDropOffsLoading] = useState(false)
  const [dropOffsError, setDropOffsError] = useState('')
  const [dropOffSearch, setDropOffSearch] = useState('')
  const [dropOffStageFilter, setDropOffStageFilter] = useState<DropOffStage | 'all'>('all')
  const [dropOffsSortOrder, setDropOffsSortOrder] = useState<'asc' | 'desc'>('desc')

  // ── Access guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const hasAccess = sessionStorage.getItem('admin_access')
    if (!hasAccess) navigate('/admin', { replace: true })
  }, [navigate])

  useEffect(() => {
    loadUsers()
    loadMargin()
  }, [])

  // ─── Users tab: data loading ─────────────────────────────────────────────────

  const loadMargin = async () => {
    try {
      const res = await fetch(`${getApiUrl_()}/api/admin/margin`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMargin(data.margin)
        setSavedMargin(data.margin)
      }
    } catch {}
  }

  const saveMargin = async () => {
    setSavingMargin(true)
    try {
      const res = await fetch(`${getApiUrl_()}/api/admin/margin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ margin }),
      })
      if (res.ok) setSavedMargin(margin)
    } catch {}
    setSavingMargin(false)
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`${getApiUrl_()}/api/admin/users-stats`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const addCredits = async () => {
    if (!creditModal || !creditAmount) return
    setAddingCredits(true)
    try {
      const res = await fetch(
        `${getApiUrl_()}/api/admin/user/${creditModal.user.user_id}/add-credits`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: parseFloat(creditAmount), reason: creditReason || 'Manual top-up' }),
        }
      )
      if (!res.ok) throw new Error('Failed to add credits')
      setCreditModal(null)
      setCreditAmount('')
      setCreditReason('')
      await loadUsers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAddingCredits(false)
    }
  }

  const getTotalTokens = (user: UserStats) =>
    Object.values(user.usage_by_service || {}).reduce(
      (sum, s) => sum + (s.total_tokens || 0),
      0
    )

  const filteredUsers = users
    .filter(
      u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'email') cmp = a.email.localeCompare(b.email)
      else if (sortBy === 'credits') cmp = getTotalTokens(a) - getTotalTokens(b)
      else if (sortBy === 'requests') cmp = a.total_requests - b.total_requests
      return sortOrder === 'asc' ? cmp : -cmp
    })

  // ─── Drop-offs tab: data loading ─────────────────────────────────────────────

  const loadDropOffs = async () => {
    setDropOffsLoading(true)
    setDropOffsError('')
    try {
      const res = await fetch(`${getApiUrl_()}/api/admin/drop-offs`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to load drop-offs')
      const data = await res.json()
      setDropOffs(data.drop_offs || [])
    } catch (err: any) {
      setDropOffsError(err.message || 'Failed to load drop-offs')
    } finally {
      setDropOffsLoading(false)
    }
  }

  // Load drop-offs when tab becomes active (lazy load)
  useEffect(() => {
    if (activeTab === 'dropoffs' && dropOffs.length === 0 && !dropOffsLoading) {
      loadDropOffs()
    }
  }, [activeTab])

  const filteredDropOffs = dropOffs
    .filter(u => {
      const matchesSearch =
        u.email.toLowerCase().includes(dropOffSearch.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(dropOffSearch.toLowerCase())) ||
        (u.company_name && u.company_name.toLowerCase().includes(dropOffSearch.toLowerCase()))
      const matchesStage = dropOffStageFilter === 'all' || u.stage === dropOffStageFilter
      return matchesSearch && matchesStage
    })
    .sort((a, b) => {
      const da = a.registered_at || ''
      const db = b.registered_at || ''
      return dropOffsSortOrder === 'desc' ? db.localeCompare(da) : da.localeCompare(db)
    })

  // Funnel summary counts
  const funnelCounts = {
    total: dropOffs.length,
    converted: dropOffs.filter(u => u.stage === 'converted').length,
    onboarding_done: dropOffs.filter(u => u.stage === 'onboarding_done').length,
    onboarding_started: dropOffs.filter(u => u.stage === 'onboarding_started').length,
    registered: dropOffs.filter(u => u.stage === 'registered').length,
  }
  const dropOffCount = funnelCounts.onboarding_done + funnelCounts.onboarding_started + funnelCounts.registered

  // CSV export for drop-offs
  const exportDropOffsCsv = () => {
    const rows = [
      ['Email', 'Full Name', 'Company', 'Stage', 'Registered', 'Last Activity', 'Website'],
      ...filteredDropOffs.map(u => [
        u.email,
        u.full_name || '',
        u.company_name || '',
        STAGE_CONFIG[u.stage]?.label || u.stage,
        fmtDate(u.registered_at),
        fmtDate(u.last_activity),
        u.website_url || '',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drop-offs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Loading screen ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Page header ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Admin Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">User management and funnel analytics</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Back to Home
              </button>
              <button
                onClick={() => { sessionStorage.removeItem('admin_access'); navigate('/admin') }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>

          {/* ── Stats cards ── */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Converted</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{funnelCounts.converted}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Drop-offs</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{dropOffCount}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Conversion Rate</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {funnelCounts.total > 0
                  ? `${Math.round((funnelCounts.converted / funnelCounts.total) * 100)}%`
                  : '—'}
              </p>
            </div>
          </div>

          {/* ── Margin control ── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4 mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Credit Margin ×</span>
            <input
              type="number" step="0.1" min="1" max="5" value={margin}
              onChange={e => setMargin(parseFloat(e.target.value))}
              className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={saveMargin}
              disabled={savingMargin || margin === savedMargin}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm transition"
            >
              {savingMargin ? 'Saving…' : 'Save'}
            </button>
            {margin !== savedMargin && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
            )}
          </div>

          {/* ── Tab switcher ── */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <Users size={16} /> Users ({users.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('dropoffs')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'dropoffs'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <TrendingDown size={16} />
                Drop-offs
                {dropOffCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full">
                    {dropOffCount}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── USERS TAB ── */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" placeholder="Search users…" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'email' | 'credits' | 'requests')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none"
              >
                <option value="credits">Sort by Credits</option>
                <option value="requests">Sort by Requests</option>
                <option value="email">Sort by Email</option>
              </select>
              <button
                onClick={() => setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
              <button
                onClick={loadUsers}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    {['User', 'Credits Balance', 'By Service', 'Total Requests', 'Last Activity'].map(h => (
                      <th key={h} className="px-6 py-3 text-start text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.map(user => (
                    <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{user.full_name || 'No name'}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                        {(user as any).bypass_subscription && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 mt-1">
                            <Shield size={10} /> Bypass
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {(user.credits_remaining ?? 0).toLocaleString()} cr
                        </div>
                        <div className="text-xs text-gray-500">
                          Used: {(user.credits_used ?? 0).toLocaleString()} / {(user.total_credits ?? 0).toLocaleString()}
                        </div>
                        <div className="flex flex-col gap-1 mt-1">
                          <button
                            onClick={() => setCreditModal({ user })}
                            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition w-fit"
                          >
                            <Plus size={12} /> Add Credits
                          </button>
                          <button
                            onClick={() => {
                              if ((user as any).bypass_subscription) {
                                if (!confirm(`Revoke free access for ${user.full_name}?`)) return
                                ;(async () => {
                                  try {
                                    await fetch(
                                      `${getApiUrl_()}/api/admin/user/${user.user_id}/bypass-subscription`,
                                      {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ bypass: false, credits: 0, reason: 'Admin revoked' }),
                                      }
                                    )
                                    await loadUsers()
                                  } catch {}
                                })()
                              } else {
                                setBypassCredits('100000')
                                setBypassModal({ user })
                              }
                            }}
                            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition w-fit ${
                              (user as any).bypass_subscription
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200'
                                : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 hover:bg-violet-200'
                            }`}
                          >
                            <Shield size={12} />
                            {(user as any).bypass_subscription ? 'Revoke Bypass' : 'Grant Bypass'}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 min-w-40">
                          {Object.entries(user.usage_by_service || {})
                            .filter(([, u]) => u.total_tokens > 0)
                            .sort(([, a], [, b]) => b.total_tokens - a.total_tokens)
                            .slice(0, 4)
                            .map(([svc, u]) => {
                              const info = SERVICE_INFO[svc] || { name: svc, icon: '⚙️' }
                              return (
                                <div key={svc} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{info.icon}</span>
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{info.name}</span>
                                  </div>
                                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                    {u.total_tokens.toLocaleString()}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900 dark:text-white">{user.total_requests}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {user.last_activity ? fmtDate(user.last_activity) : 'Never'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No users found matching your search' : 'No users yet'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ── DROP-OFFS TAB ── */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dropoffs' && (
          <div>
            {/* Funnel summary bar */}
            {!dropOffsLoading && dropOffs.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {(
                  [
                    { stage: 'registered' as DropOffStage,         label: 'Registered Only',          count: funnelCounts.registered },
                    { stage: 'onboarding_started' as DropOffStage, label: 'Incomplete Onboarding',    count: funnelCounts.onboarding_started },
                    { stage: 'onboarding_done' as DropOffStage,    label: 'Onboarded, No Payment',    count: funnelCounts.onboarding_done },
                    { stage: 'converted' as DropOffStage,          label: 'Converted',                count: funnelCounts.converted },
                  ] as const
                ).map(({ stage, label, count }) => {
                  const cfg = STAGE_CONFIG[stage]
                  return (
                    <button
                      key={stage}
                      onClick={() => setDropOffStageFilter(f => f === stage ? 'all' : stage)}
                      className={`rounded-xl p-4 border text-left transition-all ${
                        dropOffStageFilter === stage
                          ? 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-600'
                          : 'border-gray-200 dark:border-gray-700'
                      } ${cfg.bg}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {cfg.icon}
                        <span className={`text-xs font-semibold ${cfg.color}`}>{label}</span>
                      </div>
                      <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                      {funnelCounts.total > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {Math.round((count / funnelCounts.total) * 100)}% of total
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Toolbar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by email, name or company…"
                    value={dropOffSearch}
                    onChange={e => setDropOffSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter size={15} className="text-gray-400" />
                  <select
                    value={dropOffStageFilter}
                    onChange={e => setDropOffStageFilter(e.target.value as DropOffStage | 'all')}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:outline-none"
                  >
                    <option value="all">All stages</option>
                    <option value="onboarding_done">No Payment</option>
                    <option value="onboarding_started">Incomplete Onboarding</option>
                    <option value="registered">Registered Only</option>
                    <option value="converted">Converted</option>
                  </select>
                </div>

                <button
                  onClick={() => setDropOffsSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
                  title={`Sort by date ${dropOffsSortOrder === 'desc' ? 'oldest first' : 'newest first'}`}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>

                <button
                  onClick={loadDropOffs}
                  disabled={dropOffsLoading}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${dropOffsLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={exportDropOffsCsv}
                  disabled={filteredDropOffs.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                >
                  <Download size={15} /> Export CSV
                </button>
              </div>

              {/* Loading / error / table */}
              {dropOffsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : dropOffsError ? (
                <div className="m-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {dropOffsError}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        {['User', 'Company', 'Stage', 'Registered', 'Last Activity', 'Funnel Steps'].map(h => (
                          <th key={h} className="px-5 py-3 text-start text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredDropOffs.map(u => {
                        const cfg = STAGE_CONFIG[u.stage]
                        return (
                          <tr key={u.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            {/* User */}
                            <td className="px-5 py-4">
                              <div className="font-medium text-gray-900 dark:text-white text-sm">
                                {u.full_name || <span className="italic text-gray-400">No name</span>}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{u.email}</div>
                            </td>

                            {/* Company */}
                            <td className="px-5 py-4">
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                {u.company_name || <span className="italic text-gray-400">—</span>}
                              </div>
                              {u.website_url && (
                                <a
                                  href={u.website_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-40"
                                >
                                  {u.website_url.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                            </td>

                            {/* Stage badge */}
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                                {cfg.icon}
                                {cfg.label}
                              </span>
                            </td>

                            {/* Registered date */}
                            <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {fmtDate(u.registered_at)}
                            </td>

                            {/* Last activity */}
                            <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {u.last_activity ? fmtDateTime(u.last_activity) : <span className="italic text-gray-400">Never</span>}
                            </td>

                            {/* Funnel step icons */}
                            <td className="px-5 py-4">
                              <div className="flex items-start">
                                {/* Registered — always done */}
                                <div className="flex flex-col items-center">
                                  <span title="Registered" className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <CheckCircle size={13} className="text-green-600" />
                                  </span>
                                  <span className="text-[10px] text-gray-400 mt-0.5">reg</span>
                                </div>
                                <div className="w-4 h-px bg-gray-300 dark:bg-gray-600 mt-3 shrink-0" />
                                {/* Onboarding started */}
                                <div className="flex flex-col items-center">
                                  <span
                                    title="Onboarding started"
                                    className={`w-6 h-6 rounded-full flex items-center justify-center ${u.started_onboarding ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}
                                  >
                                    {u.started_onboarding ? <CheckCircle size={13} className="text-green-600" /> : <XCircle size={13} className="text-gray-400" />}
                                  </span>
                                  <span className="text-[10px] text-gray-400 mt-0.5">start</span>
                                </div>
                                <div className="w-4 h-px bg-gray-300 dark:bg-gray-600 mt-3 shrink-0" />
                                {/* Onboarding completed */}
                                <div className="flex flex-col items-center">
                                  <span
                                    title="Onboarding completed"
                                    className={`w-6 h-6 rounded-full flex items-center justify-center ${u.completed_onboarding ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}
                                  >
                                    {u.completed_onboarding ? <CheckCircle size={13} className="text-green-600" /> : <XCircle size={13} className="text-gray-400" />}
                                  </span>
                                  <span className="text-[10px] text-gray-400 mt-0.5">onb</span>
                                </div>
                                <div className="w-4 h-px bg-gray-300 dark:bg-gray-600 mt-3 shrink-0" />
                                {/* Payment */}
                                <div className="flex flex-col items-center">
                                  <span
                                    title={u.bypass_subscription ? 'Admin bypass (free access)' : u.completed_payment ? 'Paid' : 'No payment'}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center ${u.completed_payment || u.bypass_subscription ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}
                                  >
                                    {u.completed_payment
                                      ? <CheckCircle size={13} className="text-green-600" />
                                      : u.bypass_subscription
                                        ? <Shield size={13} className="text-violet-500" />
                                        : <XCircle size={13} className="text-gray-400" />}
                                  </span>
                                  <span className="text-[10px] text-gray-400 mt-0.5">pay</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {filteredDropOffs.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      {dropOffSearch || dropOffStageFilter !== 'all'
                        ? 'No users match your filters'
                        : 'No data yet — run the migration first'}
                    </div>
                  )}
                </div>
              )}

              {/* Footer: row count */}
              {filteredDropOffs.length > 0 && (
                <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  Showing {filteredDropOffs.length} of {dropOffs.length} users
                  {dropOffStageFilter !== 'all' && ` · filtered by "${STAGE_CONFIG[dropOffStageFilter]?.label}"`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Error banner (Users tab) ── */}
        {error && activeTab === 'users' && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ── ADD CREDITS MODAL ── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {creditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setCreditModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <Coins className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Credits</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {creditModal.user.full_name} ({creditModal.user.email})<br />
              Current balance: <strong>{(creditModal.user.credits_remaining ?? 0).toLocaleString()} cr</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (credits)</label>
                <div className="flex gap-2">
                  <input
                    type="number" min="1" value={creditAmount}
                    onChange={e => setCreditAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex gap-1">
                    {[1000, 5000, 10000, 50000].map(v => (
                      <button
                        key={v}
                        onClick={() => setCreditAmount(String(v))}
                        className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {v >= 1000 ? `${v / 1000}k` : v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <input
                  type="text" value={creditReason}
                  onChange={e => setCreditReason(e.target.value)}
                  placeholder="Manual top-up"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCreditModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={addCredits}
                  disabled={addingCredits || !creditAmount}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition flex items-center justify-center gap-2"
                >
                  {addingCredits ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Credits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ── BYPASS MODAL ── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {bypassModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setBypassModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-violet-600" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Grant Free Access</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {bypassModal.user.full_name} ({bypassModal.user.email})
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credits to add</label>
                <div className="flex gap-2">
                  <input
                    type="number" min="0" value={bypassCredits}
                    onChange={e => setBypassCredits(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  {['0', '50000', '100000', '500000'].map(v => (
                    <button
                      key={v}
                      onClick={() => setBypassCredits(v)}
                      className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {v === '0' ? '0' : `${parseInt(v) / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setBypassModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setBypassingAccess(true)
                    try {
                      await fetch(
                        `${getApiUrl_()}/api/admin/user/${bypassModal.user.user_id}/bypass-subscription`,
                        {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            bypass: true,
                            credits: parseFloat(bypassCredits) || 0,
                            reason: 'Admin bypass grant',
                          }),
                        }
                      )
                      setBypassModal(null)
                      await loadUsers()
                    } catch {}
                    setBypassingAccess(false)
                  }}
                  disabled={bypassingAccess}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition flex items-center justify-center gap-2"
                >
                  {bypassingAccess ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Grant Access
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
