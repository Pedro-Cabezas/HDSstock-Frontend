// ============================================================
// HDS Warehouse · core/ui.js
// Helpers reutilizables de interfaz: mensajes de formulario,
// toasts, loaders, skeletons y estados vacíos.
// Reemplaza el patrón repetido `msg.textContent=...; msg.className=...`.
// ============================================================

const UI = (() => {

  // ─── Mensaje en un contenedor (login, signup, forms) ───
  // tipo: 'ok' | 'err' | 'warn' | 'info'
  const showMessage = (el, text, tipo = 'info') => {
    if (!el) return;
    el.textContent = text;
    el.className = `message ${tipo}`;
    el.style.display = 'block';
  };
  const clearMessage = (el) => {
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
  };

  // ─── Toast flotante (feedback no bloqueante) ───
  let toastStack = null;
  const ensureToastStack = () => {
    if (toastStack && toastStack.isConnected) return toastStack;
    toastStack = document.getElementById('toast-stack');
    if (!toastStack) {
      toastStack = document.createElement('div');
      toastStack.id = 'toast-stack';
      document.body.appendChild(toastStack);
    }
    return toastStack;
  };

  const toast = ({ title = '', msg = '', tipo = 'info', duration = 3200 } = {}) => {
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      ${title ? `<div class="toast-title">${esc(title)}</div>` : ''}
      ${msg ? `<div class="toast-msg">${esc(msg)}</div>` : ''}`;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const close = () => {
      el.classList.remove('on');
      setTimeout(() => el.remove(), 280);
    };
    setTimeout(close, duration);
    el.addEventListener('click', close);
  };

  // ─── Loader / skeleton dentro de un contenedor ───
  const showLoader = (el, text = 'Cargando…') => {
    if (!el) return;
    el.innerHTML = `<div class="loader" role="status" aria-live="polite">
      <span class="loader-spinner" aria-hidden="true"></span>${esc(text)}</div>`;
  };

  // Skeleton de filas para tablas (mejor percepción de carga)
  const tableSkeleton = (cols, rows = 5) => {
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<tr class="skeleton-row">';
      for (let c = 0; c < cols; c++) html += '<td><span class="skeleton"></span></td>';
      html += '</tr>';
    }
    return html;
  };

  // ─── Estado vacío reutilizable ───
  const emptyState = (msg, icon = '∅') =>
    `<div class="empty"><span class="empty-icon" aria-hidden="true">${icon}</span>${esc(msg)}</div>`;

  const emptyRow = (cols, msg, icon = '∅') =>
    `<tr><td colspan="${cols}">${emptyState(msg, icon)}</td></tr>`;

  // ─── Botón en estado "cargando" ───
  const setButtonLoading = (btn, loading, loadingText) => {
    if (!btn) return;
    if (loading) {
      btn.dataset._label = btn.textContent;
      btn.disabled = true;
      if (loadingText) btn.textContent = loadingText;
    } else {
      btn.disabled = false;
      if (btn.dataset._label) btn.textContent = btn.dataset._label;
    }
  };

  return {
    showMessage, clearMessage, toast,
    showLoader, tableSkeleton, emptyState, emptyRow, setButtonLoading,
  };
})();
