import { Loader2, FileText, RotateCcw } from 'lucide-react'

export type SubtitleStyle = 'classic' | 'yellow' | 'clean' | 'pill' | 'neon'
export type SubtitleLang  = 'en' | 'he'

interface StyleDef {
  id: SubtitleStyle
  label: string
  textColor: string
  bg: string
  shadow?: string
  border?: string
}

export const SUBTITLE_STYLE_DEFS: StyleDef[] = [
  {
    id: 'classic',
    label: 'Classic',
    textColor: '#ffffff',
    bg: 'rgba(0,0,0,0.72)',
  },
  {
    id: 'yellow',
    label: 'Yellow',
    textColor: '#FFE500',
    bg: 'transparent',
    shadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
  },
  {
    id: 'clean',
    label: 'Clean',
    textColor: '#ffffff',
    bg: 'transparent',
    shadow: '1px 1px 3px #000, -1px -1px 3px #000, 1px -1px 3px #000, -1px 1px 3px #000',
  },
  {
    id: 'pill',
    label: 'Pill',
    textColor: '#111111',
    bg: '#ffffff',
    border: '1px solid rgba(0,0,0,0.1)',
  },
  {
    id: 'neon',
    label: 'Neon',
    textColor: '#00FF88',
    bg: 'rgba(0,0,0,0.62)',
    shadow: '0 0 8px #00FF88, 0 0 2px #00FF88',
  },
]

interface SubtitlePickerProps {
  lang: SubtitleLang
  style: SubtitleStyle
  isProcessing: boolean
  hasSubtitles: boolean
  onLangChange: (l: SubtitleLang) => void
  onStyleChange: (s: SubtitleStyle) => void
  onGenerate: () => void
  onRevert: () => void
}

export function SubtitlePicker({
  lang, style, isProcessing, hasSubtitles,
  onLangChange, onStyleChange, onGenerate, onRevert,
}: SubtitlePickerProps) {
  if (hasSubtitles) {
    return (
      <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5">
        <p className="text-xs text-green-700 dark:text-green-400 font-semibold flex items-center gap-1.5">
          <FileText size={13} /> Subtitles added
        </p>
        <button
          onClick={onRevert}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition-colors"
        >
          <RotateCcw size={12} /> Remove subtitles
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
      {/* Language */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 shrink-0">Language</span>
        <div className="flex gap-1.5">
          {(['en', 'he'] as SubtitleLang[]).map(l => (
            <button key={l} onClick={() => onLangChange(l)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${lang === l ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-violet-400'}`}
            >{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Style picker */}
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 shrink-0 pt-1">Style</span>
        <div className="flex flex-wrap gap-2">
          {SUBTITLE_STYLE_DEFS.map(s => (
            <button
              key={s.id}
              onClick={() => onStyleChange(s.id)}
              className={`relative rounded-lg overflow-hidden transition-all ${style === s.id ? 'ring-2 ring-violet-500 ring-offset-1' : 'ring-1 ring-gray-200 dark:ring-gray-600 hover:ring-violet-400'}`}
              title={s.label}
            >
              {/* Mini video frame preview */}
              <div className="w-24 h-14 bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-end pb-1.5 px-1">
                <div
                  className="text-[9px] font-bold leading-tight text-center px-1.5 py-0.5 rounded"
                  style={{
                    color: s.textColor,
                    background: s.bg,
                    boxShadow: s.shadow,
                    border: s.border,
                    textShadow: s.shadow && s.bg === 'transparent' ? s.shadow : undefined,
                  }}
                >
                  Sample text
                </div>
              </div>
              <div className="absolute top-1 left-0 right-0 text-center text-[8px] font-semibold text-white/80">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-md shadow-violet-200 dark:shadow-violet-900/30"
      >
        {isProcessing
          ? <><Loader2 size={15} className="animate-spin" /> Adding subtitles...</>
          : <><FileText size={15} /> Add Subtitles</>
        }
      </button>
    </div>
  )
}
