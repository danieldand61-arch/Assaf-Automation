// JOYO Theme - Design System
type Theme = 'light' | 'dark'

const darkTheme = {
  // Brand Colors
  brand: "#131B2E",
  accent: "#4A7CFF",
  accentSoft: "rgba(74,124,255,0.15)",

  // Status Colors
  success: "#34D399",
  successSoft: "rgba(16,185,129,0.15)",
  warning: "#FBBF24",
  warningSoft: "rgba(245,158,11,0.15)",
  danger: "#F87171",
  dangerSoft: "rgba(239,68,68,0.15)",

  // Extended Palette
  purple: "#A78BFA",
  purpleSoft: "rgba(139,92,246,0.15)",
  pink: "#F472B6",
  pinkSoft: "rgba(236,72,153,0.15)",
  orange: "#FB923C",
  orangeSoft: "rgba(249,115,22,0.15)",
  teal: "#2DD4BF",
  tealSoft: "rgba(20,184,166,0.15)",

  // Surface Colors — actual dark
  surface: "#0F1117",
  surfaceSecondary: "#1A1D2B",
  card: "#1E2130",
  border: "#2A2D3E",
  borderLight: "#23263A",

  // Text Colors — light on dark
  text: "#F1F3F9",
  textSecondary: "#9BA3B5",
  textMuted: "#636B7F",

  // Gradients
  gradient1: "linear-gradient(135deg, #4A7CFF 0%, #6366F1 50%, #8B5CF6 100%)",
  gradient2: "linear-gradient(135deg, #10B981 0%, #14B8A6 100%)",
  gradient3: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
  gradient4: "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
  sidebarGrad: "linear-gradient(175deg, #0B0E18 0%, #111627 35%, #151B30 65%, #1A2140 100%)",
}

const lightTheme = {
  // Brand Colors
  brand: "#131B2E",
  accent: "#4A7CFF",
  accentSoft: "#EEF2FF",

  // Status Colors
  success: "#10B981",
  successSoft: "#ECFDF5",
  warning: "#F59E0B",
  warningSoft: "#FFFBEB",
  danger: "#EF4444",
  dangerSoft: "#FEF2F2",

  // Extended Palette
  purple: "#8B5CF6",
  purpleSoft: "#F5F3FF",
  pink: "#EC4899",
  pinkSoft: "#FDF2F8",
  orange: "#F97316",
  orangeSoft: "#FFF7ED",
  teal: "#14B8A6",
  tealSoft: "#F0FDFA",

  // Surface Colors
  surface: "#F7F8FB",
  surfaceSecondary: "#F0F2F5",
  card: "#FFFFFF",
  border: "#E5E9F0",
  borderLight: "#EEF1F6",

  // Text Colors
  text: "#151821",
  textSecondary: "#5C6478",
  textMuted: "#959DAF",

  // Gradients
  gradient1: "linear-gradient(135deg, #4A7CFF 0%, #6366F1 50%, #8B5CF6 100%)",
  gradient2: "linear-gradient(135deg, #10B981 0%, #14B8A6 100%)",
  gradient3: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
  gradient4: "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
  sidebarGrad: "linear-gradient(175deg, #131B2E 0%, #162240 35%, #1A2B52 65%, #1E2F58 100%)",
}

export function getJoyoTheme(theme: Theme = 'dark') {
  return theme === 'light' ? lightTheme : darkTheme
}

// Default export for backward compatibility (light theme as safe default)
export const JoyoTheme = lightTheme;

// Animation Keyframes
export const animations = `
  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
`;
