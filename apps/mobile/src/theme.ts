// Design tokens from docs/08-ux-v3-clean-saas.md (v3 Clean SaaS)
export const colors = {
  ground: '#F3F5F8',
  card: '#FFFFFF',
  border: '#E6EAF0',
  divider: '#EEF1F5',
  text: '#1B2430',
  secondary: '#3A4553',
  muted: '#6B7685',
  primary: '#1C74C4',
  primarySoft: '#E6F2FD',
  link: '#1567B4',
  data: '#4DA3F0',
  successSoft: '#E7F7EE',
  success: '#1C7C47',
  warnSoft: '#FFF4DE',
  warn: '#8A5A00',
  dangerSoft: '#FDECEC',
  danger: '#A8322A',
  aiSoft: '#F0ECFD',
  ai: '#5B44B8',
  neutralSoft: '#EEF1F5',
} as const;

export type Tone = 'success' | 'info' | 'warn' | 'danger' | 'neutral' | 'ai';

export const toneColors: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successSoft, fg: colors.success },
  info: { bg: colors.primarySoft, fg: colors.link },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.neutralSoft, fg: colors.secondary },
  ai: { bg: colors.aiSoft, fg: colors.ai },
};

export const radius = 14;
/** Minimum touch target for gloved hands on rugged handhelds. */
export const touch = 56;
