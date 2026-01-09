export const translations = {
  en: {
    // Header
    title: "Social Media AI Generator",
    poweredBy: "Powered by Google Gemini 2.5 Pro & Nano Banana 🍌",
    
    // Hero
    heroTitle: "Create Professional Posts in Seconds",
    heroSubtitle: "Enter a website URL and keywords — get ready-made posts with images",
    
    // Form
    websiteUrl: "Website URL",
    keywords: "Keywords / Description",
    keywordsPlaceholder: "New product launch, innovative solutions, technology...",
    platforms: "Platforms",
    imageSize: "Image Size",
    style: "Style",
    targetAudience: "Target Audience",
    industry: "Industry",
    industryPlaceholder: "E-commerce, SaaS, Healthcare...",
    includeEmojis: "Include Emojis",
    includeLogo: "Include Logo",
    generateButton: "Generate Content",
    
    // Styles
    professional: "Professional",
    casual: "Casual",
    funny: "Funny",
    inspirational: "Inspirational",
    educational: "Educational",
    salesFocused: "Sales-focused",
    
    // Audiences
    b2b: "B2B",
    b2c: "B2C",
    youngAdults: "Young Adults",
    parents: "Parents",
    businessOwners: "Business Owners",
    techEnthusiasts: "Tech Enthusiasts",
    
    // Loading
    generating: "Generating Content...",
    analyzingWebsite: "Analyzing website...",
    extractingBrand: "Extracting brand information...",
    generatingTexts: "Generating post texts...",
    creatingImages: "Creating images...",
    timeEstimate: "This may take 30-60 seconds",
    
    // Preview
    postVariations: "Post Variations",
    variation: "Variation",
    engagement: "Engagement",
    characters: "characters",
    more: "more",
    brandAnalysis: "Brand Analysis",
    voice: "Voice",
    colors: "Colors",
    preview: "Preview",
    justNow: "Just now",
    generatedImages: "Generated Images",
    newGeneration: "New Generation",
    downloadAll: "Download All",
    downloadPost: "Download Post",
    active: "Active",
    
    // Errors
    fillRequired: "Please fill in URL and keywords!",
    generationError: "Generation error. Check backend and API key.",
    downloadError: "Error creating ZIP file. Please try again.",
    downloadTodo: "Download ZIP with content (TODO: implement)"
  },
  
  he: {
    // Header
    title: "מחולל תוכן AI לרשתות חברתיות",
    poweredBy: "מופעל על ידי Google Gemini 2.5 Pro & Nano Banana 🍌",
    
    // Hero
    heroTitle: "צור פוסטים מקצועיים בשניות",
    heroSubtitle: "הזן כתובת אתר ומילות מפתח - קבל פוסטים מוכנים עם תמונות",
    
    // Form
    websiteUrl: "כתובת אתר",
    keywords: "מילות מפתח / תיאור",
    keywordsPlaceholder: "השקת מוצר חדש, פתרונות חדשניים, טכנולוגיה...",
    platforms: "פלטפורמות",
    imageSize: "גודל תמונה",
    style: "סגנון",
    targetAudience: "קהל יעד",
    industry: "תעשייה",
    industryPlaceholder: "מסחר אלקטרוני, SaaS, רפואה...",
    includeEmojis: "כלול אימוג'ים",
    includeLogo: "כלול לוגו",
    generateButton: "צור תוכן",
    
    // Styles
    professional: "מקצועי",
    casual: "סלחני",
    funny: "מצחיק",
    inspirational: "מעורר השראה",
    educational: "חינוכי",
    salesFocused: "ממוקד מכירות",
    
    // Audiences
    b2b: "עסק לעסק",
    b2c: "עסק לצרכן",
    youngAdults: "צעירים",
    parents: "הורים",
    businessOwners: "בעלי עסקים",
    techEnthusiasts: "חובבי טכנולוגיה",
    
    // Loading
    generating: "מייצר תוכן...",
    analyzingWebsite: "מנתח אתר...",
    extractingBrand: "מחלץ מידע על המותג...",
    generatingTexts: "מייצר טקסטים...",
    creatingImages: "יוצר תמונות...",
    timeEstimate: "זה עשוי לקחת 30-60 שניות",
    
    // Preview
    postVariations: "וריאציות פוסט",
    variation: "וריאציה",
    engagement: "מעורבות",
    characters: "תווים",
    more: "עוד",
    brandAnalysis: "ניתוח מותג",
    voice: "טון",
    colors: "צבעים",
    preview: "תצוגה מקדימה",
    justNow: "עכשיו",
    generatedImages: "תמונות שנוצרו",
    newGeneration: "ייצור חדש",
    downloadAll: "הורד הכל",
    downloadPost: "הורד פוסט",
    active: "פעיל",
    
    // Errors
    fillRequired: "אנא מלא כתובת אתר ומילות מפתח!",
    generationError: "שגיאת ייצור. בדוק את השרת ומפתח API.",
    downloadError: "שגיאה ביצירת קובץ ZIP. נסה שוב.",
    downloadTodo: "הורד ZIP עם תוכן (TODO: ליישם)"
  }
}

export type Language = 'en' | 'he'
export type TranslationKey = keyof typeof translations.en
