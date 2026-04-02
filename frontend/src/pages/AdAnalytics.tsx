import { useState, useEffect } from 'react'
import { RefreshCw, DollarSign, MousePointerClick, Eye, Target, Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useApp } from '../contexts/AppContext'
import { getJoyoTheme } from '../styles/joyo-theme'
import { getApiUrl } from '../lib/api'

interface Campaign {
  id: string; platform: string; platform_campaign_id: string
  campaign_name: string; status: string; campaign_type: string; objective: string
  impressions: number; clicks: number; ctr: number; spend: number
  avg_cpc: number; conversions: number; conversion_rate: number
  cost_per_conversion: number; roas: number; reach: number
  search_impression_share: number
}

interface SyncStatus { platform: string; status: string; campaigns_synced: number; completed_at: string; error_message: string }
interface Overview { totals: Record<string, any>; top_campaigns: Campaign[]; sync_status: SyncStatus[] }

export default function AdAnalytics() {
  const { session } = useAuth()
  const { theme } = useTheme()
  const { t } = useApp()
  const th = getJoyoTheme(theme)

  const [overview, setOverview] = useState<Overview | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'campaigns' | 'keywords'>('overview')
  const [metaAdAccounts, setMetaAdAccounts] = useState<any[]>([])
  const [metaSelected, setMetaSelected] = useState('')
  const [switchingAccount, setSwitchingAccount] = useState(false)

  const api = getApiUrl()
  const headers = { 'Authorization': `Bearer ${session?.access_token}` }

  const loadMetaAccounts = async () => {
    try {
      const res = await fetch(`${api}/api/social/meta-ads/ad-accounts`, { headers })
      if (res.ok) {
        const d = await res.json()
        setMetaAdAccounts(d.ad_accounts || [])
        setMetaSelected(d.selected || '')
      }
    } catch { /* ignore */ }
  }

  const switchMetaAccount = async (id: string) => {
    setSwitchingAccount(true)
    setMetaSelected(id)
    try {
      await fetch(`${api}/api/social/meta-ads/select-account`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_account_id: id }),
      })
      await doSync()
    } catch (e) { console.error('Switch error:', e) }
    finally { setSwitchingAccount(false) }
  }

  const loadData = async () => {
    try {
      const [ov, ca] = await Promise.all([
        fetch(`${api}/api/analytics/overview`, { headers }).then(r => r.json()),
        fetch(`${api}/api/analytics/campaigns`, { headers }).then(r => r.json()),
      ])
      setOverview(ov)
      setCampaigns(ca.campaigns || [])
    } catch (e) { console.error('Load error:', e) }
    finally { setLoading(false) }
  }

  const doSync = async () => {
    setSyncing(true)
    try {
      await fetch(`${api}/api/analytics/sync?days=90&force=true`, { method: 'POST', headers })
      await loadData()
    } catch (e) { console.error('Sync error:', e) }
    finally { setSyncing(false) }
  }

  useEffect(() => {
    if (session) {
      loadData()
      doSync()
      loadMetaAccounts()
    }
  }, [session])

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0)
  const fmtMoney = (n: number) => `$${n.toFixed(2)}`
  const pctBadge = (n: number) => n > 0 ? `${n.toFixed(1)}%` : '—'

  if (loading) {
    return <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: th.accent }} />
    </div>
  }

  const comb = overview?.totals?.combined || {}
  const gTotals = overview?.totals?.google_ads || {}
  const mTotals = overview?.totals?.meta || {}

  const tabLabels = { overview: t('overview'), campaigns: t('campaignsTab'), keywords: t('keywordsTab') }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: th.text }}>{t('aiAdvisorAnalyst')}</h1>
          <p className="text-sm" style={{ color: th.textSecondary }}>{t('crossPlatformAnalytics')} · {t('last90Days')}</p>
        </div>
        <button onClick={doSync} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: th.gradient1 }}>
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? t('syncing') : t('syncNow')}
        </button>
      </div>

      {/* Sync status */}
      {overview?.sync_status?.map((s, i) => (
        <div key={i} className="mb-2 text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-2 me-2"
          style={{ background: s.status === 'completed' ? `${th.success}15` : s.status === 'error' ? `${th.danger}15` : `${th.warning}15`, color: s.status === 'completed' ? th.success : s.status === 'error' ? th.danger : th.warning }}>
          <span className="font-semibold">{s.platform === 'google_ads' ? t('googleAds') : t('meta')}</span>
          {s.status === 'completed' ? `${s.campaigns_synced} ${t('campaignsSynced')}` : s.status === 'error' ? `${t('error')}: ${s.error_message?.slice(0, 80) || t('unknown')}` : (s.error_message || s.status)}
        </div>
      ))}

      {/* Error: permission denied — suggest switching account */}
      {overview?.sync_status?.some(s => s.status === 'error' && s.error_message?.includes('403')) && metaAdAccounts.length > 1 && (
        <div className="mt-3 p-4 rounded-xl flex items-start gap-3" style={{ background: `${th.warning}12`, border: `1px solid ${th.warning}30` }}>
          <AlertTriangle size={18} style={{ color: th.warning, flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold mb-2" style={{ color: th.text }}>{t('permissionError')}</p>
            <div className="flex items-center gap-2">
              <select value={metaSelected} onChange={e => switchMetaAccount(e.target.value)} disabled={switchingAccount}
                className="px-3 py-1.5 rounded-lg text-sm" style={{ background: th.card, border: `1px solid ${th.border}`, color: th.text }}>
                {metaAdAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name || a.id} {a.currency ? `(${a.currency})` : ''}</option>
                ))}
              </select>
              {switchingAccount && <Loader2 size={14} className="animate-spin" style={{ color: th.accent }} />}
            </div>
          </div>
        </div>
      )}

      {/* No data at all — suggest switching or connecting */}
      {!loading && campaigns.length === 0 && overview?.sync_status?.every(s => s.status === 'completed') && metaAdAccounts.length > 1 && (
        <div className="mt-3 p-4 rounded-xl flex items-start gap-3" style={{ background: `${th.accent}08`, border: `1px solid ${th.accent}20` }}>
          <Eye size={18} style={{ color: th.accent, flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold mb-2" style={{ color: th.text }}>{t('noCampaignsFound')}</p>
            <div className="flex items-center gap-2">
              <select value={metaSelected} onChange={e => switchMetaAccount(e.target.value)} disabled={switchingAccount}
                className="px-3 py-1.5 rounded-lg text-sm" style={{ background: th.card, border: `1px solid ${th.border}`, color: th.text }}>
                {metaAdAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name || a.id} {a.currency ? `(${a.currency})` : ''}</option>
                ))}
              </select>
              {switchingAccount && <Loader2 size={14} className="animate-spin" style={{ color: th.accent }} />}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mt-4 mb-6 p-1 rounded-xl" style={{ background: th.border }}>
        {(['overview', 'campaigns', 'keywords'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition"
            style={{ background: tab === tb ? th.card : 'transparent', color: tab === tb ? th.text : th.textSecondary }}>
            {tabLabels[tb]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard icon={Eye} label={t('impressions')} value={fmt(comb.impressions || 0)} theme={th} color={th.accent} />
            <KpiCard icon={MousePointerClick} label={t('clicks')} value={fmt(comb.clicks || 0)} sub={`${t('ctr')} ${pctBadge(comb.ctr || 0)}`} theme={th} color={th.success} />
            <KpiCard icon={DollarSign} label={t('totalSpend')} value={fmtMoney(comb.spend || 0)} theme={th} color={th.warning} />
            <KpiCard icon={Target} label={t('conversions')} value={(comb.conversions || 0).toFixed(0)} sub={`${t('cpa')} ${fmtMoney(comb.cpa || 0)}`} theme={th} color={th.purple} />
          </div>

          {/* Platform comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <PlatformCard title={t('googleAds')} data={gTotals} theme={th} color="#4285F4" />
            <PlatformCard title={t('metaAds')} data={mTotals} theme={th} color="#1877F2" />
          </div>

          {/* Top Campaigns */}
          <div style={{ background: th.card, borderRadius: 16, border: `1px solid ${th.border}`, padding: 24 }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: th.text }}>{t('topCampaignsBySpend')}</h3>
            {(overview?.top_campaigns || []).length === 0 ? (
              <p className="text-sm" style={{ color: th.textMuted }}>{t('noCampaignsYet')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ color: th.textMuted }}>
                    <th className="text-start pb-3 font-semibold">{t('campaign')}</th>
                    <th className="text-start pb-3 font-semibold">{t('platform')}</th>
                    <th className="text-end pb-3 font-semibold">{t('spend')}</th>
                    <th className="text-end pb-3 font-semibold">{t('clicks')}</th>
                    <th className="text-end pb-3 font-semibold">{t('ctr')}</th>
                    <th className="text-end pb-3 font-semibold">{t('conv')}</th>
                  </tr></thead>
                  <tbody>
                    {overview!.top_campaigns.map((c, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${th.border}` }}>
                        <td className="py-2.5 font-medium" style={{ color: th.text }}>{c.campaign_name}</td>
                        <td className="py-2.5">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: c.platform === 'google_ads' ? '#4285F415' : '#1877F215', color: c.platform === 'google_ads' ? '#4285F4' : '#1877F2' }}>
                            {c.platform === 'google_ads' ? t('google') : t('meta')}
                          </span>
                        </td>
                        <td className="py-2.5 text-end" style={{ color: th.text }}>{fmtMoney(c.spend)}</td>
                        <td className="py-2.5 text-end" style={{ color: th.textSecondary }}>{fmt(c.clicks)}</td>
                        <td className="py-2.5 text-end" style={{ color: th.textSecondary }}>{pctBadge(c.ctr)}</td>
                        <td className="py-2.5 text-end" style={{ color: th.text }}>{c.conversions?.toFixed(0) || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'campaigns' && <CampaignsTab campaigns={campaigns} theme={th} />}
      {tab === 'keywords' && <KeywordsTab theme={th} />}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, theme: th, color }: any) {
  return (
    <div style={{ background: th.card, borderRadius: 14, border: `1px solid ${th.border}`, padding: '18px 20px' }}>
      <div className="flex items-center gap-2 mb-2">
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
        <span className="text-xs font-semibold" style={{ color: th.textSecondary }}>{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color: th.text }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: th.textMuted }}>{sub}</div>}
    </div>
  )
}

function PlatformCard({ title, data, theme: th, color }: any) {
  const { t } = useApp()
  return (
    <div style={{ background: th.card, borderRadius: 14, border: `1px solid ${th.border}`, padding: 20 }}>
      <div className="flex items-center gap-2 mb-4">
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span className="text-sm font-bold" style={{ color: th.text }}>{title}</span>
        <span className="text-xs ml-auto" style={{ color: th.textMuted }}>{data.campaigns || 0} {t('campaigns')}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: t('impressions'), v: data.impressions || 0 },
          { l: t('clicks'), v: data.clicks || 0 },
          { l: t('spend'), v: `$${(data.spend || 0).toFixed(2)}` },
          { l: t('ctr'), v: `${(data.ctr || 0).toFixed(1)}%` },
          { l: t('conversions'), v: (data.conversions || 0).toFixed(0) },
          { l: t('cpa'), v: `$${(data.cpa || 0).toFixed(2)}` },
        ].map((m, i) => (
          <div key={i}>
            <div className="text-xs" style={{ color: th.textMuted }}>{m.l}</div>
            <div className="text-sm font-bold" style={{ color: th.text }}>{typeof m.v === 'number' ? m.v.toLocaleString() : m.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CampaignsTab({ campaigns, theme: th }: { campaigns: Campaign[]; theme: any }) {
  const { t } = useApp()
  const [filter, setFilter] = useState<string>('all')
  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.platform === filter)

  return (
    <div style={{ background: th.card, borderRadius: 16, border: `1px solid ${th.border}`, padding: 24 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: th.text }}>{t('allCampaigns')} ({filtered.length})</h3>
        <div className="flex gap-1">
          {['all', 'google_ads', 'meta'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: filter === f ? th.accent + '20' : 'transparent', color: filter === f ? th.accent : th.textSecondary }}>
              {f === 'all' ? t('all') : f === 'google_ads' ? t('google') : t('meta')}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm" style={{ color: th.textMuted }}>{t('noCampaignsConnectAds')}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: th.surfaceSecondary, border: `1px solid ${th.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: th.text }}>{c.campaign_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: c.status === 'ENABLED' || c.status === 'ACTIVE' ? `${th.success}20` : `${th.textMuted}20`, color: c.status === 'ENABLED' || c.status === 'ACTIVE' ? th.success : th.textMuted }}>
                    {c.status}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: c.platform === 'google_ads' ? '#4285F415' : '#1877F215', color: c.platform === 'google_ads' ? '#4285F4' : '#1877F2' }}>
                  {c.platform === 'google_ads' ? t('googleAds') : t('meta')}
                </span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                <div><span style={{ color: th.textMuted }}>{t('impressions')}</span><div className="font-bold" style={{ color: th.text }}>{(c.impressions || 0).toLocaleString()}</div></div>
                <div><span style={{ color: th.textMuted }}>{t('clicks')}</span><div className="font-bold" style={{ color: th.text }}>{(c.clicks || 0).toLocaleString()}</div></div>
                <div><span style={{ color: th.textMuted }}>{t('ctr')}</span><div className="font-bold" style={{ color: th.text }}>{c.ctr?.toFixed(2)}%</div></div>
                <div><span style={{ color: th.textMuted }}>{t('spend')}</span><div className="font-bold" style={{ color: th.text }}>${(c.spend || 0).toFixed(2)}</div></div>
                <div><span style={{ color: th.textMuted }}>{t('conv')}</span><div className="font-bold" style={{ color: th.text }}>{(c.conversions || 0).toFixed(0)}</div></div>
                <div><span style={{ color: th.textMuted }}>{t('cpa')}</span><div className="font-bold" style={{ color: th.text }}>${(c.cost_per_conversion || 0).toFixed(2)}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KeywordsTab({ theme: th }: { theme: any }) {
  const { session } = useAuth()
  const { t } = useApp()
  const [keywords, setKeywords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    fetch(`${getApiUrl()}/api/analytics/keywords`, { headers: { 'Authorization': `Bearer ${session.access_token}` } })
      .then(r => r.json())
      .then(d => setKeywords(d.keywords || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [session])

  if (loading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: th.accent }} /></div>

  return (
    <div style={{ background: th.card, borderRadius: 16, border: `1px solid ${th.border}`, padding: 24 }}>
      <h3 className="text-sm font-bold mb-4" style={{ color: th.text }}>{t('keywordsGoogleAds')} — {keywords.length}</h3>
      {keywords.length === 0 ? (
        <p className="text-sm" style={{ color: th.textMuted }}>{t('noKeywordData')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr style={{ color: th.textMuted }}>
              <th className="text-start pb-2 font-semibold">{t('keyword')}</th>
              <th className="text-start pb-2 font-semibold">{t('matchType')}</th>
              <th className="text-end pb-2 font-semibold">QS</th>
              <th className="text-end pb-2 font-semibold">{t('impressions')}</th>
              <th className="text-end pb-2 font-semibold">{t('clicks')}</th>
              <th className="text-end pb-2 font-semibold">{t('ctr')}</th>
              <th className="text-end pb-2 font-semibold">{t('avgCpc')}</th>
              <th className="text-end pb-2 font-semibold">{t('conv')}</th>
            </tr></thead>
            <tbody>
              {keywords.slice(0, 50).map((kw, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${th.border}` }}>
                  <td className="py-2 font-medium" style={{ color: th.text }}>{kw.keyword_text}</td>
                  <td className="py-2"><span className="px-1.5 py-0.5 rounded text-xs" style={{ background: `${th.accent}15`, color: th.accent }}>{kw.match_type}</span></td>
                  <td className="py-2 text-end" style={{ color: kw.quality_score >= 7 ? th.success : kw.quality_score >= 4 ? th.warning : th.danger }}>{kw.quality_score || '—'}</td>
                  <td className="py-2 text-end" style={{ color: th.textSecondary }}>{(kw.impressions || 0).toLocaleString()}</td>
                  <td className="py-2 text-end" style={{ color: th.textSecondary }}>{kw.clicks || 0}</td>
                  <td className="py-2 text-end" style={{ color: th.textSecondary }}>{kw.ctr?.toFixed(2)}%</td>
                  <td className="py-2 text-end" style={{ color: th.textSecondary }}>${(kw.avg_cpc || 0).toFixed(2)}</td>
                  <td className="py-2 text-end font-semibold" style={{ color: th.text }}>{(kw.conversions || 0).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
