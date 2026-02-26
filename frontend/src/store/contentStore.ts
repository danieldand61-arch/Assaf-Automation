import { create } from 'zustand'

interface PostVariation {
  text: string
  hashtags: string[]
  char_count: number
  engagement_score: number
  call_to_action: string
  platform: string
  variant_type: string
  strategist_note: string
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
  website_data?: any
  request_params?: any
  user_media?: string | null
}

interface ContentStore {
  generatedContent: GeneratedContent | null
  setGeneratedContent: (content: GeneratedContent | null) => void
  updateVariation: (index: number, text: string, hashtags: string[], cta: string) => void
  updateImage: (index: number, imageUrl: string) => void
}

export const useContentStore = create<ContentStore>((set) => ({
  generatedContent: null,
  setGeneratedContent: (content) => set({ generatedContent: content }),
  updateVariation: (index, text, hashtags, cta) => set((state) => {
    if (!state.generatedContent) return state
    const newVariations = [...state.generatedContent.variations]
    newVariations[index] = {
      ...newVariations[index],
      text,
      hashtags,
      call_to_action: cta,
      char_count: text.length
    }
    return {
      generatedContent: {
        ...state.generatedContent,
        variations: newVariations
      }
    }
  }),
  updateImage: (index, imageUrl) => set((state) => {
    if (!state.generatedContent) return state
    const newImages = [...state.generatedContent.images]
    newImages[index] = {
      ...newImages[index],
      url: imageUrl
    }
    return {
      generatedContent: {
        ...state.generatedContent,
        images: newImages
      }
    }
  })
}))

