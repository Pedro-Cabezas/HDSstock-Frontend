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
      home: () => {
        $$('.unit-card').forEach((btn) => {
          btn.addEventListener('click', () => {
            const nave = Number(btn.dataset.nave);
            if (nave === 2) {
              UI.toast({ title: 'Próximamente', msg: 'Nave 2 estará disponible en breve', tipo: 'info' });
              return;
            }
            Store.set('naveActual', nave);
            cambiarVista('mapa');
          });
        });
      },
      mapa: () => Mapa.init(),
      stock: () => Stock.init(),
      pedidos: () => Pedidos.init(),
      dashboard: () => Dashboard.init(),
      movimientos: () => Movimientos.init(),
      usuarios: () => Usuarios.init(),
    };
    inits[vista]?.();
    vistasInicializadas.add(vista);
  };

  const cargarDatosVista = (vista) => {
    const loaders = {
      mapa: () => Mapa.entrar(),
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
    document.body.classList.toggle('at-home', vista === 'home');
    const btnInicio = $('btnInicio');
    if (btnInicio) btnInicio.style.display = vista === 'home' ? 'none' : 'flex';

    initVista(vista);
    cargarDatosVista(vista);
  };

  const armarNavbar = () => {
    const rol = Store.user.rol;
    const taskbar = $('taskbar');
    const toggle = $('dockToggle');

    const cerrarDock = () => {
      taskbar.classList.remove('open');
      if (toggle) { toggle.classList.remove('open'); toggle.textContent = '☰'; toggle.setAttribute('aria-expanded', 'false'); }
    };

    $$('.taskbar button').forEach((btn) => {
      const vista = btn.dataset.view;
      if (vista !== 'producto' && PERMISOS_VISTA[vista].includes(rol)) btn.classList.add('allowed');
      btn.addEventListener('click', () => { cambiarVista(vista); cerrarDock(); });
    });

    // Botón hamburguesa (visible solo en celular)
    if (toggle) {
      toggle.addEventListener('click', () => {
        const abierto = taskbar.classList.toggle('open');
        toggle.classList.toggle('open', abierto);
        toggle.textContent = abierto ? '✕' : '☰';
        toggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      });
    }
    // Cerrar el dock al tocar fuera
    document.addEventListener('click', (ev) => {
      if (!taskbar.contains(ev.target) && ev.target !== toggle && taskbar.classList.contains('open')) cerrarDock();
    });
  };

  const armarHeader = () => {
    $('usuarioNombre').textContent = Store.user.nombre;
    $('usuarioRol').textContent = ROL_LABEL[Store.user.rol] || Store.user.rol;
    $('btnSalir').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: '¿Cerrar sesión?', confirmText: 'Salir', danger: true });
      if (ok) await Auth.logout();
    });
    $('btnInicio').addEventListener('click', () => cambiarVista('home'));
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

    // 5. Cargar badge de pedidos pendientes en background
    Api.pedidos.listar().then(({ data }) => {
      const n = (data || []).filter((p) => p.estado === 'pendiente').length;
      const badge = $('pedidosBadge');
      if (badge) { badge.textContent = n > 99 ? '99+' : String(n); badge.style.display = n > 0 ? 'inline-flex' : 'none'; }
    }).catch(() => {});

    // 6. Vista inicial normal
    cambiarVista('home');
  };

  return { start, cambiarVista };
})();

// Arranque
App.start();