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
      Store.set('movData', data || []);
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
    const body = $('movBody');
    const filtrados = Store.get('movData').filter((m) => {
      if (!filtro) return true;
      if (filtro === 'stock') return m.accion === 'stock+' || m.accion === 'stock-';
      return m.accion === filtro;
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
  };

  return { cargar, init };
})();
