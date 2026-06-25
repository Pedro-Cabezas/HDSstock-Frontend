// ============================================================
// HDS Warehouse · views/movimientos.js
// Historial de movimientos con filtro por tipo de acción.
// ============================================================

const Movimientos = (() => {

  const cargar = async () => {
    const body = $('movBody');
    body.innerHTML = UI.tableSkeleton(7);
    try {
      const { data, error } = await Api.movimientos.listar();
      if (error) throw error;
      // Filtrar movimientos por nave actual (comparar contra estantes)
      const estantesNaveActual = Store.get('estantes').map((e) => e.nombre);
      const movFiltrados = (data || []).filter((m) => estantesNaveActual.includes(m.estante_nombre));
      Store.set('movData', movFiltrados);
      render();
    } catch (e) {
      body.innerHTML = UI.emptyRow(7, 'Error: ' + e.message + ' · ¿Creaste la tabla "movimientos"?');
    }
  };

  const accionClass = (accion) => ({
    crear: 'accion-crear', editar: 'accion-editar', eliminar: 'accion-eliminar',
  }[accion] || 'accion-stock');

  const render = () => {
    const filtro = $('movAccionFilter').value;
    const busqueda = $('movSearch').value.trim().toLowerCase();
    const body = $('movBody');
    const filtrados = Store.get('movData').filter((m) => {
      if (filtro && filtro !== 'stock' && m.accion !== filtro) return false;
      if (filtro === 'stock' && m.accion !== 'stock+' && m.accion !== 'stock-') return false;
      if (busqueda) {
        const haystack = [m.usuario_nombre, m.producto_nombre, m.estante_nombre, m.accion, m.detalle]
          .map((v) => (v || '').toLowerCase()).join(' ');
        if (!haystack.includes(busqueda)) return false;
      }
      return true;
    });

    $('movTotal').textContent = `${filtrados.length} movimiento(s)`;
    if (!filtrados.length) { body.innerHTML = UI.emptyRow(7, 'Sin movimientos registrados', '🔄'); return; }

    body.innerHTML = filtrados.map((m) => {
      let stockInfo = '—';
      if (m.cantidad_anterior !== null && m.cantidad_nueva !== null) stockInfo = `${m.cantidad_anterior} → ${m.cantidad_nueva}`;
      else if (m.cantidad_nueva !== null) stockInfo = `${m.cantidad_nueva}`;
      return `
        <tr>
          <td style="color:var(--text-dim); white-space:nowrap">${fmtFecha(m.fecha)}</td>
          <td>${esc(m.usuario_nombre || '—')}</td>
          <td><span class="accion-badge ${accionClass(m.accion)}">${esc(m.accion)}</span></td>
          <td>${esc(m.producto_nombre || '—')}</td>
          <td><span class="ubic">${esc(m.estante_nombre || '—')}</span></td>
          <td>${stockInfo}</td>
          <td class="desc">${esc(m.detalle || '')}</td>
        </tr>`;
    }).join('');
  };

  const init = () => {
    $('movAccionFilter').addEventListener('change', render);
    $('movRefresh').addEventListener('click', cargar);
    $('movSearch').addEventListener('input', render);
  };

  return { cargar, init };
})();
