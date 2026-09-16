/**
 * Ported from mobile/src/theme.ts — same brand tokens, same reasoning (shared
 * visual identity across mobile/web, accents constant across light/dark,
 * only surfaces/text/hairlines swap). Kept as a plain object (not CSS
 * variables) so components can also use these values in inline styles/SVG
 * fills where a var() wouldn't work; index.css still defines the --brand-*
 * CSS custom properties too, generated from this same source of truth.
 */
export type Palette = {
  background: string;
  surface: string;
  tint1: string;
  tint2: string;
  textPrimary: string;
  textMuted: string;
  hairline: string;
  inputBorder: string;
  brand50: string;
  brand100: string;
  brand200: string;
  brand300: string;
  brand400: string;
  brand500: string;
  brand600: string;
  brand700: string;
  brand800: string;
  brand900: string;
  gold400: string;
  gold500: string;
  gold600: string;
};

const accents = {
  brand50: '#fff0f5',
  brand100: '#ffe0eb',
  brand200: '#ffc2d4',
  brand300: '#ff94b3',
  brand400: '#ff5585',
  brand500: '#ff1a5e',
  brand600: '#e6004a',
  brand700: '#c2003d',
  brand800: '#990030',
  brand900: '#7a0027',
  gold400: '#f5c842',
  gold500: '#e6b800',
  gold600: '#cc9f00',
} as const;

export const lightPalette: Palette = {
  ...accents,
  background: '#fff8fa',
  surface: '#ffffff',
  tint1: '#fff0f5',
  tint2: '#ffe0eb',
  textPrimary: '#2b1016',
  textMuted: '#8a5a66',
  hairline: '#f5e2e7',
  inputBorder: '#ffc2d4',
};

export const darkPalette: Palette = {
  ...accents,
  background: '#150c0f',
  surface: '#1f1317',
  tint1: '#2a1920',
  tint2: '#341f28',
  textPrimary: '#f5e8ea',
  textMuted: '#c79aa4',
  hairline: '#3a2830',
  inputBorder: '#4a2e38',
};

export const gradients = {
  brand: `linear-gradient(135deg, ${accents.brand400}, ${accents.brand600})`,
  gold: `linear-gradient(135deg, ${accents.gold400}, ${accents.gold600})`,
};
