import { create } from 'zustand'

interface PostVariation {
  text: string
  hashtags: string[]
  char_count: number
  engagement_score: number
  call_to_action: string
}

interface ImageVariation {
  url: string
  size: string
  dimensions: string
}

interface GeneratedContent {
  variations: PostVariation[]
  images: ImageVariation[]
  brand_colors: string[]
  brand_voice: string
}

interface ContentStore {
  generatedContent: GeneratedContent | null
  setGeneratedContent: (content: GeneratedContent | null) => void
}

export const useContentStore = create<ContentStore>((set) => ({
  generatedContent: null,
  setGeneratedContent: (content) => set({ generatedContent: content })
}))

