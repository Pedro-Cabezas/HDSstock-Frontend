// ============================================================
// HDS Warehouse · core/utils.js
// Utilidades puras y reutilizables (sin estado, sin DOM salvo $).
// ============================================================

// ─── Sanitización (previene XSS al interpolar en innerHTML) ───
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[m]));

// ─── Selectores DOM (centralizados, con caché simple) ───
const _domCache = new Map();
const $ = (id) => {
  if (_domCache.has(id)) {
    const cached = _domCache.get(id);
    if (cached && cached.isConnected) return cached;
  }
  const el = document.getElementById(id);
  if (el) _domCache.set(id, el);
  return el;
};
const $$ = (selector, root = document) => root.querySelectorAll(selector);

// ─── Color helpers (para el canvas del plano) ───
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const tint = (hex, t) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
};
const shade = (hex, t) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`;
};
const hexAlpha = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
const catColor = (c) => CAT_COLORS[c] || '#64748b';

// ─── Formato de fechas ───
const fmtFecha = (iso) => {
  const f = new Date(iso);
  return `${f.toLocaleDateString('es-AR')} ${f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
};

// ─── Path de rectángulo redondeado en canvas ───
const roundedPath = (c, x, y, w, h, r) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
};

// ─── Misc ───
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
