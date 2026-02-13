// JOYO Theme - Design System
export const JoyoTheme = {
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
};

// Card Style Helper
export const cardStyle = {
  background: JoyoTheme.card,
  borderRadius: 16,
  border: `1px solid ${JoyoTheme.border}`,
  transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
};

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
