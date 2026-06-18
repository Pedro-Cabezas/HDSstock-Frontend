// ============================================================
// HDS Warehouse · views/usuarios.js
// Gestión de usuarios (solo admin). Opera sobre la tabla `perfiles`
// ligada a Supabase Auth. La autorización real la impone RLS.
// ============================================================

const Usuarios = (() => {

  const cargar = async () => {
    try {
      const [{ data: pendientes }, { data: activos }] = await Promise.all([
        Api.perfiles.porEstado('pendiente'),
        Api.perfiles.activos(),
      ]);
      renderPendientes(pendientes || []);
      renderActivos(activos || []);
    } catch (e) {
      console.error('Error cargando usuarios:', e);
      UI.toast({ title: 'Error', msg: 'No se pudieron cargar los usuarios', tipo: 'err' });
    }
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
    try {
      const { error } = await Api.perfiles.eliminar(id);
      if (error) throw error;
      await cargar();
      UI.toast({ title: 'Usuario eliminado', tipo: 'warn' });
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  return { cargar };
})();
