// ============================================================
// HDS Warehouse · views/usuarios.js
// Gestión de usuarios (solo admin). Opera sobre la tabla `perfiles`
// ligada a Supabase Auth. La autorización real la impone RLS.
// ============================================================

const Usuarios = (() => {

  let allPendientes = [];
  let allActivos = [];

  const cargar = async () => {
    try {
      const [{ data: pendientes }, { data: activos }] = await Promise.all([
        Api.perfiles.porEstado('pendiente'),
        Api.perfiles.activos(),
      ]);
      allPendientes = pendientes || [];
      allActivos = activos || [];
      aplicarFiltros();
    } catch (e) {
      console.error('Error cargando usuarios:', e);
      UI.toast({ title: 'Error', msg: 'No se pudieron cargar los usuarios', tipo: 'err' });
    }
  };

  const aplicarFiltros = () => {
    const busqueda = ($('usuariosSearch')?.value || '').toLowerCase();
    const estado = $('usuariosEstadoFilter')?.value || '';
    const rol = $('usuariosRolFilter')?.value || '';

    const filtrar = (usuarios) => usuarios.filter((u) => {
      const matchBusqueda = !busqueda || (u.nombre + ' ' + u.email).toLowerCase().includes(busqueda);
      const matchRol = !rol || u.rol === rol;
      return matchBusqueda && matchRol;
    });

    let pendientesFiltrados = allPendientes;
    let activosFiltrados = allActivos;

    if (estado === 'pendiente') {
      pendientesFiltrados = filtrar(allPendientes);
      activosFiltrados = [];
    } else if (estado === 'activo') {
      pendientesFiltrados = [];
      activosFiltrados = filtrar(allActivos);
    } else {
      pendientesFiltrados = filtrar(allPendientes);
      activosFiltrados = filtrar(allActivos);
    }

    renderPendientes(pendientesFiltrados);
    renderActivos(activosFiltrados);
  };

  const selectRol = (id, rolActual = '') => `
    <select id="${id}">
      <option value="operario" ${rolActual === 'operario' ? 'selected' : ''}>Operario</option>
      <option value="supervisor" ${rolActual === 'supervisor' ? 'selected' : ''}>Supervisor</option>
      <option value="admin" ${rolActual === 'admin' ? 'selected' : ''}>Admin</option>
    </select>`;

  const renderPendientes = (pendientes) => {
    $('pendingCount').textContent = pendientes.length;
    const list = $('pendingUsersList');
    if (!pendientes.length) {
      list.innerHTML = '<div style="color:var(--text-dim); font-size:11px">No hay solicitudes pendientes</div>';
      return;
    }
    list.innerHTML = pendientes.map((u) => `
      <div class="user-card">
        <div class="user-name">${esc(u.nombre)}</div>
        <div class="user-email">${esc(u.email)}</div>
        ${selectRol(`rol-${u.id}`)}
        <div class="user-actions">
          <button class="aprobar" data-id="${u.id}" data-act="aprobar">✓ Aprobar</button>
          <button class="rechazar" data-id="${u.id}" data-act="rechazar">✗ Rechazar</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('button[data-act]').forEach((btn) => {
      const id = btn.dataset.id;
      btn.addEventListener('click', () =>
        btn.dataset.act === 'aprobar' ? aprobar(id) : eliminar(id, 'rechazar'));
    });
  };

  const renderActivos = (activos) => {
    $('activeCount').textContent = activos.length;
    const list = $('activeUsersList');
    if (!activos.length) {
      list.innerHTML = '<div style="color:var(--text-dim); font-size:11px">No hay usuarios activos</div>';
      return;
    }
    list.innerHTML = activos.map((u) => {
      const esYo = u.id === Store.user.id;
      if (esYo) {
        return `
          <div class="user-card activo">
            <div class="user-name">${esc(u.nombre)}<span class="badge-yo">VOS</span></div>
            <div class="user-email">${esc(u.email)}</div>
            <div style="color:var(--accent); font-size:10px">${ROL_LABEL[u.rol] || u.rol}</div>
          </div>`;
      }
      return `
        <div class="user-card activo">
          <div class="user-name">${esc(u.nombre)}</div>
          <div class="user-email">${esc(u.email)}</div>
          ${selectRol(`rolact-${u.id}`, u.rol)}
          <div class="user-actions">
            <button class="cambiar" data-id="${u.id}" data-act="cambiar">↻ Cambiar rol</button>
            <button class="rechazar" data-id="${u.id}" data-act="eliminar">🗑 Eliminar</button>
          </div>
        </div>`;
    }).join('');
    list.querySelectorAll('button[data-act]').forEach((btn) => {
      const id = btn.dataset.id;
      btn.addEventListener('click', () =>
        btn.dataset.act === 'cambiar' ? cambiarRol(id) : eliminar(id, 'eliminar'));
    });
  };

  const aprobar = async (id) => {
    const rol = $(`rol-${id}`).value;
    if (!confirm(`¿Aprobar como ${ROL_LABEL[rol]}?`)) return;
    try {
      const { error } = await Api.perfiles.aprobar(id, rol, Store.user.id);
      if (error) throw error;
      await cargar();
      UI.toast({ title: 'Usuario aprobado', tipo: 'ok' });
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  const cambiarRol = async (id) => {
    const rol = $(`rolact-${id}`).value;
    if (!confirm(`¿Cambiar rol a ${ROL_LABEL[rol]}?`)) return;
    try {
      const { error } = await Api.perfiles.cambiarRol(id, rol);
      if (error) throw error;
      UI.toast({ title: 'Rol actualizado', msg: 'El usuario verá el cambio al volver a entrar', tipo: 'ok' });
      await cargar();
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  const eliminar = async (id, modo) => {
    const msg = modo === 'rechazar'
      ? '¿Rechazar y eliminar esta solicitud?'
      : '¿Eliminar este usuario del sistema? Esta acción no se puede deshacer.';
    if (!confirm(msg)) return;

    // Eliminación optimista
    const indexPend = allPendientes.findIndex((u) => u.id === id);
    const indexAct = allActivos.findIndex((u) => u.id === id);
    const userAntes = allPendientes[indexPend] || allActivos[indexAct];

    if (indexPend >= 0) allPendientes.splice(indexPend, 1);
    if (indexAct >= 0) allActivos.splice(indexAct, 1);
    aplicarFiltros();
    UI.toast({ title: 'Usuario eliminado', tipo: 'warn' });

    // Luego intentar persistir
    try {
      const { error } = await Api.perfiles.eliminar(id);
      if (error) throw error;
      console.log('Usuario eliminado de Supabase:', id);
    } catch (e) {
      // Restaurar si falla
      if (userAntes) {
        if (indexPend >= 0) allPendientes.splice(indexPend, 0, userAntes);
        else allActivos.splice(indexAct, 0, userAntes);
        aplicarFiltros();
      }
      console.error('Error al eliminar usuario:', e);
      UI.toast({ title: 'Error al eliminar', msg: e.message, tipo: 'err' });
    }
  };

  const init = () => {
    $('usuariosSearch').addEventListener('input', aplicarFiltros);
    $('usuariosEstadoFilter').addEventListener('change', aplicarFiltros);
    $('usuariosRolFilter').addEventListener('change', aplicarFiltros);
  };

  return { cargar, init };
})();
