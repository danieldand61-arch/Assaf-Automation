import { useState } from 'react'
import { FileText, Megaphone, Video, MessageSquare, Loader2 } from 'lucide-react'
import { ChatApp } from './ChatApp'
import { InputSection } from './InputSection'
import { GoogleAdsGeneration } from './GoogleAdsGeneration'
import { VideoTranslation } from './VideoTranslation'
import { PreviewSection } from './PreviewSection'
import { useContentStore } from '../store/contentStore'
import { useAccount } from '../contexts/AccountContext'
import Header from './Header'

type TabType = 'chat' | 'social' | 'ads' | 'video'

interface Tab {
  id: TabType
  name: string
  icon: React.ReactNode
}

export function MainWorkspace() {
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const { generatedContent, setGeneratedContent } = useContentStore()
  const { loading, accounts } = useAccount()
  
  console.log('🏢 MainWorkspace render - loading:', loading, 'accounts:', accounts.length)

  const handleGenerate = (data: any) => {
    setGeneratedContent(data)
  }

  const handleReset = () => {
    setGeneratedContent(null)
  }

  // Show loading while fetching accounts
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  const tabs: Tab[] = [
    {
      id: 'chat',
      name: 'AI Chat',
      icon: <MessageSquare className="w-5 h-5" />
    },
    {
      id: 'social',
      name: 'Social Posts',
      icon: <FileText className="w-5 h-5" />
    },
    {
      id: 'ads',
      name: 'Google Ads',
      icon: <Megaphone className="w-5 h-5" />
    },
    {
      id: 'video',
      name: 'Video Translation',
      icon: <Video className="w-5 h-5" />
    }
  ]

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Header />
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-3 font-medium transition whitespace-nowrap border-b-2
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatApp />}
        {activeTab === 'social' && (
          <div className="flex h-full">
            <div className={`${generatedContent ? 'w-1/2' : 'flex-1'} overflow-auto p-6`}>
              <InputSection onGenerate={handleGenerate} />
            </div>
            {generatedContent && (
              <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 overflow-auto p-6 bg-white dark:bg-gray-800">
                <PreviewSection onReset={handleReset} />
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'ads' && (
          <div className="h-full overflow-auto p-6">
            <GoogleAdsGeneration />
          </div>
        )}
        
        {activeTab === 'video' && (
          <div className="h-full overflow-auto p-6">
            <VideoTranslation />
          </div>
        )}
      </div>
    </div>
  )
}
