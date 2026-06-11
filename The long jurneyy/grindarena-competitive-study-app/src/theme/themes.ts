export type Theme = 'violet' | 'ocean' | 'sunset' | 'mint' | 'rose' | 'amber';

export interface ThemeConfig {
  name: string;
  emoji: string;
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  primary: string;
  primaryText: string;
  primaryGlow: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
  win: string;
  loss: string;
  gold: string;
  gradient: string;
  cardGradient: string;
  pill: string;
}

export const themes: Record<Theme, ThemeConfig> = {
  violet: {
    name: 'Midnight Violet',
    emoji: '💜',
    bg: '#0d0d14',
    surface: '#16161f',
    surfaceHover: '#1e1e2e',
    border: '#2a2a3e',
    primary: '#7c5cfc',
    primaryText: '#ffffff',
    primaryGlow: 'rgba(124,92,252,0.35)',
    secondary: '#a78bfa',
    accent: '#e879f9',
    text: '#f1f0ff',
    textMuted: '#7070a0',
    win: '#22d37c',
    loss: '#ff4d6a',
    gold: '#f5c842',
    gradient: 'linear-gradient(135deg, #7c5cfc, #e879f9)',
    cardGradient: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(232,121,249,0.08))',
    pill: 'rgba(124,92,252,0.18)',
  },
  ocean: {
    name: 'Deep Ocean',
    emoji: '🌊',
    bg: '#070f1a',
    surface: '#0d1b2a',
    surfaceHover: '#122237',
    border: '#1a3050',
    primary: '#0ea5e9',
    primaryText: '#ffffff',
    primaryGlow: 'rgba(14,165,233,0.35)',
    secondary: '#38bdf8',
    accent: '#06b6d4',
    text: '#e0f2fe',
    textMuted: '#4a7090',
    win: '#22d37c',
    loss: '#f87171',
    gold: '#fbbf24',
    gradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
    cardGradient: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(6,182,212,0.08))',
    pill: 'rgba(14,165,233,0.18)',
  },
  sunset: {
    name: 'Sunset Fire',
    emoji: '🔥',
    bg: '#110808',
    surface: '#1c0f0f',
    surfaceHover: '#261515',
    border: '#3d1f1f',
    primary: '#f97316',
    primaryText: '#ffffff',
    primaryGlow: 'rgba(249,115,22,0.35)',
    secondary: '#fb923c',
    accent: '#ef4444',
    text: '#fff1e6',
    textMuted: '#7a5040',
    win: '#4ade80',
    loss: '#ef4444',
    gold: '#facc15',
    gradient: 'linear-gradient(135deg, #ef4444, #f97316)',
    cardGradient: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(239,68,68,0.08))',
    pill: 'rgba(249,115,22,0.18)',
  },
  mint: {
    name: 'Neon Mint',
    emoji: '🌿',
    bg: '#070f0b',
    surface: '#0d1a12',
    surfaceHover: '#12261a',
    border: '#1a3828',
    primary: '#10b981',
    primaryText: '#ffffff',
    primaryGlow: 'rgba(16,185,129,0.35)',
    secondary: '#34d399',
    accent: '#6ee7b7',
    text: '#ecfdf5',
    textMuted: '#3d7058',
    win: '#34d399',
    loss: '#f87171',
    gold: '#fbbf24',
    gradient: 'linear-gradient(135deg, #10b981, #06b6d4)',
    cardGradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.08))',
    pill: 'rgba(16,185,129,0.18)',
  },
  rose: {
    name: 'Cherry Blossom',
    emoji: '🌸',
    bg: '#100a0d',
    surface: '#1c1018',
    surfaceHover: '#261522',
    border: '#3d1f30',
    primary: '#f43f5e',
    primaryText: '#ffffff',
    primaryGlow: 'rgba(244,63,94,0.35)',
    secondary: '#fb7185',
    accent: '#e879f9',
    text: '#fff0f5',
    textMuted: '#7a4060',
    win: '#4ade80',
    loss: '#f43f5e',
    gold: '#fbbf24',
    gradient: 'linear-gradient(135deg, #f43f5e, #e879f9)',
    cardGradient: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(232,121,249,0.08))',
    pill: 'rgba(244,63,94,0.18)',
  },
  amber: {
    name: 'Golden Hour',
    emoji: '✨',
    bg: '#0f0d07',
    surface: '#1a1608',
    surfaceHover: '#241f0c',
    border: '#3d3410',
    primary: '#d97706',
    primaryText: '#ffffff',
    primaryGlow: 'rgba(217,119,6,0.35)',
    secondary: '#f59e0b',
    accent: '#fbbf24',
    text: '#fefce8',
    textMuted: '#7a6030',
    win: '#4ade80',
    loss: '#f87171',
    gold: '#fbbf24',
    gradient: 'linear-gradient(135deg, #d97706, #f59e0b)',
    cardGradient: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(245,158,11,0.08))',
    pill: 'rgba(217,119,6,0.18)',
  },
};

export function getTheme(theme: Theme): ThemeConfig {
  return themes[theme];
}
