// ============================================================
// HDS Warehouse · views/pedidos.js
// Pedidos y necesidades: crear, filtrar y resolver (supervisor/admin).
// ============================================================

const Pedidos = (() => {

  const cargar = async () => {
    const body = $('pedBody');
    body.innerHTML = UI.tableSkeleton(8);
    try {
      const { data, error } = await Api.pedidos.listar();
      if (error) throw error;
      Store.set('pedData', data || []);
      render();
    } catch (e) {
      body.innerHTML = UI.emptyRow(8, 'Error: ' + e.message + ' · ¿Creaste la tabla "pedidos"?');
    }
  };

  const accionesHtml = (p) => {
    if (!Store.esSupervisorOAdmin) return '';
    if (p.estado === PEDIDO_ESTADO.PENDIENTE) {
      return `<button class="ap" data-ped="${p.id}" data-estado="aprobado">✓ Aprobar</button>
              <button class="re" data-ped="${p.id}" data-estado="rechazado">✗ Rechazar</button>`;
    }
    if (p.estado === PEDIDO_ESTADO.APROBADO) {
      return `<button class="rc" data-ped="${p.id}" data-estado="recibido">📦 Recibido</button>`;
    }
    return '';
  };

  const render = () => {
    const filtro = $('pedEstadoFilter').value;
    const body = $('pedBody');
    const filtrados = Store.get('pedData').filter((p) => !filtro || p.estado === filtro);
    $('pedTotal').textContent = `${filtrados.length} pedido(s)`;

    if (!filtrados.length) { body.innerHTML = UI.emptyRow(8, 'Sin pedidos registrados', '📋'); return; }

    body.innerHTML = filtrados.map((p) => `
      <tr>
        <td style="color:var(--text-dim); white-space:nowrap">${fmtFecha(p.fecha)}</td>
        <td>${esc(p.usuario_nombre || '—')}</td>
        <td>${esc(p.producto)}</td>
        <td style="font-weight:600">${p.cantidad}</td>
        <td class="desc">${esc(p.motivo || '')}</td>
        <td><span class="estado-badge estado-${esc(p.estado)}">${esc(p.estado)}</span></td>
        <td style="color:var(--text-dim)">${esc(p.resuelto_por || '—')}</td>
        <td class="acts">${accionesHtml(p)}</td>
      </tr>`).join('');

    body.querySelectorAll('button[data-ped]').forEach((btn) =>
      btn.addEventListener('click', () => resolver(Number(btn.dataset.ped), btn.dataset.estado)));
  };

  const resolver = async (id, estado) => {
    if (!confirm(`¿Marcar pedido como "${estado}"?`)) return;
    try {
      const { error } = await Api.pedidos.resolver(id, estado, Store.user.nombre);
      if (error) throw error;
      await cargar();
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  const enviar = async () => {
    const producto = $('pedProducto').value.trim();
    const cantidad = parseInt($('pedCantidad').value) || 1;
    const motivo = $('pedMotivo').value.trim();
    if (!producto) return UI.toast({ msg: 'Ingresá el producto o insumo', tipo: 'warn' });
    try {
      const { error } = await Api.pedidos.crear({
        usuario_nombre: Store.user.nombre, producto, cantidad, motivo, estado: PEDIDO_ESTADO.PENDIENTE,
      });
      if (error) throw error;
      $('pedProducto').value = '';
      $('pedCantidad').value = '1';
      $('pedMotivo').value = '';
      await cargar();
      UI.toast({ title: 'Pedido enviado', tipo: 'ok' });
    } catch (e) { UI.toast({ title: 'Error al enviar', msg: e.message, tipo: 'err' }); }
  };

  const init = () => {
    $('pedEnviar').addEventListener('click', enviar);
    $('pedEstadoFilter').addEventListener('change', render);
    $('pedRefresh').addEventListener('click', cargar);
  };

  return { cargar, init };
})();
