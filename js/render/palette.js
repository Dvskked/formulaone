// Paleta y helpers de color compartidos por los renderizadores.

export const INK = '#05060a';
export const ASPHALT = '#262a33';
export const ASPHALT_DARK = '#1b1e25';
export const KERB_RED = '#c8382f';
export const KERB_BLUE = '#2f5cc8';
export const GRASS = '#16281a';
export const GRASS_ALT = '#1a3020';
export const CARBON = '#15171d';
export const WHITE = '#f2f4f8';

export const TYRE_STYLE = {
  soft: { color: '#e8112d', label: 'C5' },
  medium: { color: '#f5d000', label: 'C3' },
  hard: { color: '#e6e8ee', label: 'C2' },
};

export const TYRE_ORDER = ['soft', 'medium', 'hard'];

/** Convierte «#rrggbb» en «r, g, b» para usar con rgba(). */
export function rgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function alpha(hex, a) {
  return `rgba(${rgb(hex)}, ${a})`;
}

/** Color de equipo con respaldo neutro. */
export function teamColor(team) {
  return team?.livery?.primary || '#9aa3b5';
}

export function teamSecondary(team) {
  return team?.livery?.secondary || '#1a1e28';
}

  /** Aclara u oscurece un color hexadecimal (amount de -1 a 1). */
export function shade(hex, amount) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const mix = (channel) => {
    const target = amount < 0 ? 0 : 255;
    return Math.round(channel + (target - channel) * Math.abs(amount));
  };
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Contraste legible sobre un color de fondo. */
export function readableOn(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.58 ? '#101318' : '#ffffff';
}
