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

  const cerrarMenus = () => document.querySelectorAll('.ped-menu-dropdown.open').forEach((m) => m.classList.remove('open'));

  const accionesHtml = (p) => {
    if (!Store.esSupervisorOAdmin) return '';
    let opciones = '';
    if (p.estado === PEDIDO_ESTADO.PENDIENTE) {
      opciones += `<button class="ped-menu-item" data-ped="${p.id}" data-estado="aprobado">✓ Aprobar</button>`;
      opciones += `<button class="ped-menu-item" data-ped="${p.id}" data-estado="rechazado">✗ Rechazar</button>`;
    }
    if (p.estado === PEDIDO_ESTADO.APROBADO) {
      opciones += `<button class="ped-menu-item" data-ped="${p.id}" data-estado="recibido">📦 Recibido</button>`;
    }
    if (opciones) opciones += '<div class="ped-menu-sep"></div>';
    opciones += `<button class="ped-menu-item danger" data-ped="${p.id}" data-accion="eliminar">🗑 Eliminar</button>`;
    return `<div class="ped-menu-container">
      <button class="ped-menu-btn" title="Opciones">⋮</button>
      <div class="ped-menu-dropdown">${opciones}</div>
    </div>`;
  };

  const render = () => {
    const filtro = $('pedEstadoFilter').value;
    const body = $('pedBody');
    const filtrados = Store.get('pedData').filter((p) => !filtro || p.estado === filtro);
    $('pedTotal').textContent = `${filtrados.length} pedido(s)`;

    const totalPend = Store.get('pedData').filter((p) => p.estado === 'pendiente').length;
    const badge = $('pedidosBadge');
    if (badge) { badge.textContent = totalPend > 99 ? '99+' : String(totalPend); badge.style.display = totalPend > 0 ? 'inline-flex' : 'none'; }

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

  };

  const resolver = async (id, estado) => {
    const esDanger = estado === 'rechazado';
    const ok = await UI.confirm({
      title: `¿Marcar como "${estado}"?`,
      confirmText: estado === 'rechazado' ? 'Rechazar' : estado === 'aprobado' ? 'Aprobar' : 'Confirmar',
      danger: esDanger,
    });
    if (!ok) return;
    try {
      const { error } = await Api.pedidos.resolver(id, estado, Store.user.nombre);
      if (error) throw error;
      await cargar();
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  const eliminar = async (id) => {
    const ok = await UI.confirm({
      title: '¿Eliminar este pedido?',
      msg: 'Esta acción no se puede deshacer',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;

    // Eliminación optimista: quitar del Store inmediatamente
    const pedDataAntes = Store.get('pedData');
    const pedidoElim = pedDataAntes.find((p) => p.id === id);
    Store.set('pedData', pedDataAntes.filter((p) => p.id !== id));
    render();
    UI.toast({ title: 'Pedido eliminado', tipo: 'ok' });

    // Luego intentar eliminar de Supabase
    try {
      const { error } = await Api.pedidos.eliminar(id);
      if (error) throw error;
    } catch (e) {
      // Si falla, restaurar
      Store.set('pedData', pedDataAntes);
      render();
      UI.toast({ title: 'Error al eliminar', msg: e.message, tipo: 'err' });
    }
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

    // Delegación global de eventos para el menú — registrada UNA sola vez
    const pedView = $('view-pedidos');
    pedView.addEventListener('click', (ev) => {
      const menuBtn = ev.target.closest('.ped-menu-btn');
      const menuItem = ev.target.closest('.ped-menu-item');
      if (menuBtn) {
        ev.stopPropagation();
        const dropdown = menuBtn.closest('.ped-menu-container').querySelector('.ped-menu-dropdown');
        const yaAbierto = dropdown.classList.contains('open');
        cerrarMenus();
        if (!yaAbierto) {
          // Posicionar con fixed para escapar overflow:hidden de la tabla
          const rect = menuBtn.getBoundingClientRect();
          dropdown.style.top  = (rect.bottom + 5) + 'px';
          dropdown.style.left = (rect.right - 172) + 'px';
          dropdown.classList.add('open');
        }
        return;
      }
      if (menuItem) {
        cerrarMenus();
        const id = Number(menuItem.dataset.ped);
        if (menuItem.dataset.accion === 'eliminar') eliminar(id);
        else resolver(id, menuItem.dataset.estado);
        return;
      }
      cerrarMenus();
    });

    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('.ped-menu-container')) cerrarMenus();
    });
  };

  return { cargar, init };
})();
