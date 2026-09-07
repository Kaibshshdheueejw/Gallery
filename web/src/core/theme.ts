/**
 * Material You style theming.
 * A single seed colour is expanded into a tonal token set (light + dark),
 * mirroring how the Flutter app derives dynamic colour from the wallpaper.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

export interface SeedOption {
  id: string;
  label: string;
  color: string;
}

export const SEEDS: SeedOption[] = [
  { id: 'violet', label: 'Violet bloom', color: '#6750a4' },
  { id: 'teal', label: 'Teal shore', color: '#00696d' },
  { id: 'sunset', label: 'Sunset sand', color: '#8c5123' },
  { id: 'magenta', label: 'Bougainvillea', color: '#9c4170' },
  { id: 'forest', label: 'Monsoon green', color: '#3f6b21' },
  { id: 'indigo', label: 'Night indigo', color: '#4355b9' },
];

/* ---------- colour maths ---------- */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const hsl = (h: number, s: number, l: number) => {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
};

function schemeFrom(seedHex: string, dark: boolean) {
  const [r, g, b] = hexToRgb(seedHex);
  let [h, s] = rgbToHsl(r, g, b);
  s = Math.max(0.28, Math.min(0.75, s));
  if (dark) {
    return {
      primary: hsl(h, s, 0.8),
      onPrimary: hsl(h, s, 0.2),
      primaryContainer: hsl(h, s, 0.3),
      onPrimaryContainer: hsl(h, Math.min(1, s + 0.1), 0.9),
      secondary: hsl(h, s * 0.5, 0.8),
      secondaryContainer: hsl(h, s * 0.45, 0.28),
      onSecondaryContainer: hsl(h, s * 0.5, 0.9),
      tertiary: hsl((h + 60) % 360, s * 0.7, 0.8),
      tertiaryContainer: hsl((h + 60) % 360, s * 0.6, 0.28),
      onTertiaryContainer: hsl((h + 60) % 360, s * 0.6, 0.9),
      surface: hsl(h, 0.1, 0.08),
      surfaceDim: hsl(h, 0.1, 0.06),
      surfaceContainer: hsl(h, 0.09, 0.12),
      surfaceContainerHigh: hsl(h, 0.09, 0.16),
      surfaceContainerHighest: hsl(h, 0.09, 0.2),
      onSurface: hsl(h, 0.05, 0.92),
      onSurfaceVariant: hsl(h, 0.08, 0.78),
      outline: hsl(h, 0.08, 0.55),
      outlineVariant: hsl(h, 0.08, 0.3),
      inverseSurface: hsl(h, 0.05, 0.92),
      inverseOnSurface: hsl(h, 0.08, 0.12),
      error: '#ffb4ab',
      scrim: '#000000',
    };
  }
  return {
    primary: hsl(h, s, 0.4),
    onPrimary: '#ffffff',
    primaryContainer: hsl(h, Math.min(1, s + 0.15), 0.9),
    onPrimaryContainer: hsl(h, s, 0.16),
    secondary: hsl(h, s * 0.45, 0.4),
    secondaryContainer: hsl(h, s * 0.5, 0.9),
    onSecondaryContainer: hsl(h, s * 0.5, 0.14),
    tertiary: hsl((h + 60) % 360, s * 0.6, 0.42),
    tertiaryContainer: hsl((h + 60) % 360, s * 0.6, 0.9),
    onTertiaryContainer: hsl((h + 60) % 360, s * 0.6, 0.16),
    surface: hsl(h, 0.1, 0.98),
    surfaceDim: hsl(h, 0.08, 0.9),
    surfaceContainer: hsl(h, 0.08, 0.95),
    surfaceContainerHigh: hsl(h, 0.08, 0.92),
    surfaceContainerHighest: hsl(h, 0.08, 0.89),
    onSurface: hsl(h, 0.08, 0.12),
    onSurfaceVariant: hsl(h, 0.07, 0.32),
    outline: hsl(h, 0.07, 0.48),
    outlineVariant: hsl(h, 0.08, 0.82),
    inverseSurface: hsl(h, 0.08, 0.18),
    inverseOnSurface: hsl(h, 0.05, 0.95),
    error: '#b3261e',
    scrim: '#000000',
  };
}

export type TokenSet = ReturnType<typeof schemeFrom>;

export function buildTokens(seedHex: string, mode: ThemeMode, prefersDark: boolean): TokenSet {
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  return schemeFrom(seedHex, dark);
}

export function applyTokens(tokens: TokenSet) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--md-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
  }
  root.style.setProperty('--md-scrim-60', 'rgba(0,0,0,0.6)');
}

export function isDarkTokens(mode: ThemeMode, prefersDark: boolean) {
  return mode === 'dark' || (mode === 'system' && prefersDark);
}
