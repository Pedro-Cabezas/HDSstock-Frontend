// ============================================================
// HDS Warehouse · core/state.js
// Estado global centralizado (store). Única fuente de verdad en
// memoria. El rol/sesión NO se confía a localStorage: provienen de
// Supabase Auth + tabla perfiles (validados por RLS en el servidor).
// ============================================================

const Store = (() => {
  const state = {
    // sesión (se hidrata desde Supabase Auth, no desde localStorage)
    user: null,          // { id, email, nombre, rol, estado }

    // datos de dominio
    estantes: [],
    productos: [],       // productos del estante abierto
    stockData: [],       // inventario completo (vista stock)
    movData: [],
    pedData: [],

    // dashboard
    dashMovimientos: [],
    dashProductos: [],
    dashPedidos: [],

    // ui / navegación
    vistaActual: 'mapa',
    online: false,

    // mapa
    editMode: false,
    selectedId: null,
    draggedId: null,
    hoveredId: null,
    tipoSeleccionado: 'grande',

    // modal de productos del estante
    prodEstanteId: null,
    prodEditId: null,
    seleccionados: [],

    // vista producto individual
    productoDetalleId: null,
    productoDetalleData: null,

    // modal de cantidad
    tipoOperacion: null,
    modalEstanteProductoId: null,
    modalEstanteTipo: null,
  };

  return {
    get: (key) => state[key],
    set: (key, value) => { state[key] = value; },
    patch: (obj) => Object.assign(state, obj),
    // helpers de rol derivados de la sesión (de solo lectura)
    get esAdmin() { return state.user?.rol === 'admin'; },
    get esSupervisorOAdmin() {
      return state.user?.rol === 'supervisor' || state.user?.rol === 'admin';
    },
    get user() { return state.user; },
  };
})();
