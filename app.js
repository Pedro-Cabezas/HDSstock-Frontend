// ============================================================
// HDS Warehouse · app.js
// Orquestador principal: protege la sesión, arma el header, maneja
// la navegación entre vistas y la carga diferida (lazy) de cada una.
// Es el último script en cargar.
// ============================================================

const App = (() => {

  // Las vistas se inicializan una sola vez (lazy): la primera vez que
  // se entra, se llama init(); después solo se recargan datos.
  const vistasInicializadas = new Set();

  const initVista = (vista) => {
    if (vistasInicializadas.has(vista)) return;
    const inits = {
      mapa: () => Mapa.init(),
      stock: () => Stock.init(),
      pedidos: () => Pedidos.init(),
      dashboard: () => Dashboard.init(),
      movimientos: () => Movimientos.init(),
    };
    inits[vista]?.();
    vistasInicializadas.add(vista);
  };

  const cargarDatosVista = (vista) => {
    const loaders = {
      mapa: () => Mapa.resizeCanvas(),
      stock: () => Stock.cargar(),
      pedidos: () => Pedidos.cargar(),
      dashboard: () => Dashboard.cargar(),
      movimientos: () => Movimientos.cargar(),
      usuarios: () => Usuarios.cargar(),
      producto: () => Detalle.cargar(),
    };
    loaders[vista]?.();
  };

  const cambiarVista = (vista) => {
    const rol = Store.user.rol;
    if (!PERMISOS_VISTA[vista].includes(rol)) return;
    if (vista === 'producto' && !Store.get('productoDetalleId')) return;

    Store.set('vistaActual', vista);
    $$('.view').forEach((v) => v.classList.remove('active'));
    $('view-' + vista).classList.add('active');
    $$('.taskbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === vista));

    initVista(vista);
    cargarDatosVista(vista);
  };

  const armarNavbar = () => {
    const rol = Store.user.rol;
    $$('.taskbar button').forEach((btn) => {
      const vista = btn.dataset.view;
      if (vista !== 'producto' && PERMISOS_VISTA[vista].includes(rol)) btn.classList.add('allowed');
      btn.addEventListener('click', () => cambiarVista(vista));
    });
  };

  const armarHeader = () => {
    $('usuarioNombre').textContent = Store.user.nombre;
    $('usuarioRol').textContent = ROL_LABEL[Store.user.rol] || Store.user.rol;
    $('btnSalir').addEventListener('click', async () => {
      if (confirm('¿Cerrar sesión?')) await Auth.logout();
    });
  };

  const start = async () => {
    // 1. Proteger: sin sesión activa → al login (no se confía en localStorage)
    const user = await Auth.requireSession();
    if (!user) return;

    // 2. Header + navegación
    armarHeader();
    armarNavbar();

    // 3. Inicializar módulos transversales del shell
    Theme.init();
    Detalle.init();
    CantidadModal.init();

    // 4. Si la URL trae ?producto=ID (QR escaneado), abrir ese producto
    const params = new URLSearchParams(location.search);
    const prodId = params.get('producto');
    if (prodId) {
      Store.set('productoDetalleId', Number(prodId));
      $('navProducto').classList.add('allowed');
      initVista('mapa');           // el mapa queda listo de fondo
      cambiarVista('producto');    // pero mostramos el producto directo
      return;
    }

    // 5. Vista inicial normal
    initVista('mapa');
    cargarDatosVista('mapa');
  };

  return { start, cambiarVista };
})();

// Arranque
App.start();