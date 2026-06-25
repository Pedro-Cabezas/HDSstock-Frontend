// ============================================================
// HDS Warehouse · core/api.js
// Capa de acceso a datos. Centraliza el cliente de Supabase y TODAS
// las consultas. Sin select('*'): cada query pide solo sus columnas.
// Los permisos los valida RLS en el servidor; acá no se confía en el
// frontend para autorizar.
// ============================================================

// El cliente global de Supabase (UMD) expone `window.supabase.createClient`.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Api = {
  client: sb,

  // ───────────── AUTH ─────────────
  auth: {
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
    signUp: (email, password, nombre) =>
      sb.auth.signUp({ email, password, options: { data: { nombre } } }),
    signOut: () => sb.auth.signOut(),
    getSession: () => sb.auth.getSession(),
    onAuthChange: (cb) => sb.auth.onAuthStateChange(cb),
  },

  // ───────────── PERFILES ─────────────
  perfiles: {
    miPerfil: (id) =>
      sb.from('perfiles').select(COLS.perfiles).eq('id', id).single(),
    porEstado: (estado) =>
      sb.from('perfiles').select(COLS.perfiles).eq('estado', estado)
        .order('fecha_creacion', { ascending: false }),
    activos: () =>
      sb.from('perfiles').select(COLS.perfiles).eq('estado', 'activo')
        .order('nombre', { ascending: true }),
    aprobar: (id, rol, aprobadorId) =>
      sb.from('perfiles').update({
        estado: 'activo', rol,
        fecha_aprobacion: new Date().toISOString(), aprobado_por: aprobadorId,
      }).eq('id', id),
    cambiarRol: (id, rol) => sb.from('perfiles').update({ rol }).eq('id', id),
    eliminar: (id) => sb.from('perfiles').delete().eq('id', id),
    marcarLogin: (id) =>
      sb.from('perfiles').update({ fecha_ultimo_login: new Date().toISOString() }).eq('id', id),
  },

  // ───────────── ESTANTES ─────────────
  estantes: {
    listar: (nave = 1) => sb.from('estantes').select(COLS.estantes).eq('nave', nave).order('id'),
    crear: (data) => sb.from('estantes').insert([data]).select(COLS.estantes),
    actualizar: (id, data) => sb.from('estantes').update(data).eq('id', id),
    eliminar: (id) => sb.from('estantes').delete().eq('id', id),
  },

  // ───────────── PRODUCTOS ─────────────
  productos: {
    porEstante: (estanteId) =>
      sb.from('productos').select(COLS.productos)
        .eq('estante_id', estanteId).order('ubicacion', { ascending: true }),
    detalle: (id) =>
      sb.from('productos').select(COLS.productosConEstante).eq('id', id).single(),
    inventario: (nave = 1) =>
      sb.from('productos').select(COLS.productosConEstante)
        .eq('nave', nave).order('estante_id', { ascending: true }),
    crear: (data) => sb.from('productos').insert([data]).select(COLS.productos),
    actualizar: (id, data) => sb.from('productos').update(data).eq('id', id),
    setCantidad: (id, cantidad) => sb.from('productos').update({ cantidad }).eq('id', id),
    eliminar: (id) => sb.from('productos').delete().eq('id', id),
  },

  // ───────────── MOVIMIENTOS ─────────────
  movimientos: {
    registrar: (data) => sb.from('movimientos').insert([data]),
    listar: (limit = 200) =>
      sb.from('movimientos').select(COLS.movimientos)
        .order('fecha', { ascending: false }).limit(limit),
    porProducto: (productoId, limit = 5) =>
      sb.from('movimientos').select(COLS.movimientos)
        .eq('producto_id', productoId).order('fecha', { ascending: false }).limit(limit),
  },

  // ───────────── PEDIDOS ─────────────
  pedidos: {
    listar: (limit = 200) =>
      sb.from('pedidos').select(COLS.pedidos)
        .order('fecha', { ascending: false }).limit(limit),
    crear: (data) => sb.from('pedidos').insert([data]),
    resolver: (id, estado, resueltoPor) =>
      sb.from('pedidos').update({
        estado, resuelto_por: resueltoPor, fecha_resolucion: new Date().toISOString(),
      }).eq('id', id),
    eliminar: (id) => sb.from('pedidos').delete().eq('id', id),
  },

  // ───────────── DASHBOARD (en paralelo) ─────────────
  dashboard: () => Promise.all([
    sb.from('movimientos').select(COLS.movimientos).order('fecha', { ascending: false }).limit(1000),
    sb.from('productos').select('id,nombre,categoria,cantidad,estante_id,estantes(nombre)'),
    sb.from('pedidos').select(COLS.pedidos),
  ]),
};
