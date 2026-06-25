// ============================================================
// HDS Warehouse · core/theme.js
// Modo claro / oscuro. Guarda la preferencia y la aplica al instante.
// (localStorage acá es solo preferencia de UI, no datos de sesión.)
// ============================================================

const Theme = (() => {
  const KEY = 'hds-theme';

  // Aplica el tema al <html>. 'light' | 'dark'
  const apply = (tema) => {
    document.documentElement.setAttribute('data-theme', tema);
    const btn = document.getElementById('btnTheme');
    if (btn) {
      btn.textContent = tema === 'dark' ? '☀️' : '🌙';
      btn.title = tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }
  };

  // Tema actual (guardado, o claro por defecto)
  const actual = () => {
    try { return localStorage.getItem(KEY) || 'light'; }
    catch { return 'light'; }
  };

  const toggle = () => {
    const nuevo = actual() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, nuevo); } catch { /* noop */ }
    apply(nuevo);
    // Redibujar el canvas del mapa si está disponible (colores según tema)
    if (typeof Mapa !== 'undefined' && Mapa.draw) {
      try { Mapa.draw(); } catch { /* noop */ }
    }
  };

  // Aplicar lo antes posible (evita "flash" del tema incorrecto)
  const init = () => {
    apply(actual());
    const btn = document.getElementById('btnTheme');
    if (btn) btn.addEventListener('click', toggle);
  };

  // Aplicar el tema YA (antes de que el usuario interactúe)
  apply(actual());

  return { init, toggle, apply, actual };
})();