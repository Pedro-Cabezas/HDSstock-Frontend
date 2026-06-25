// ============================================================
// HDS Warehouse · views/dashboard.js
// Panel de análisis: KPIs y gráficos de barras con filtros anuales
// y trimestrales. Carga las 3 fuentes en paralelo (Api.dashboard).
// ============================================================

const Dashboard = (() => {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const llenarAnios = () => {
    const actual = new Date().getFullYear();
    let opts = '';
    for (let y = actual; y >= 2024; y--) opts += `<option value="${y}">${y}</option>`;
    $('dashYear').innerHTML = opts;
  };

  const cargar = async () => {
    try {
      const [movRes, prodRes, pedRes] = await Api.dashboard();
      // Filtrar por nave actual
      const estantesNaveActual = Store.get('estantes').map((e) => e.nombre);
      const movFiltrados = (movRes.data || []).filter((m) => estantesNaveActual.includes(m.estante_nombre));
      const prodFiltrados = (prodRes.data || []).filter((p) => estantesNaveActual.includes(p.estantes?.nombre));
      Store.patch({
        dashMovimientos: movFiltrados,
        dashProductos: prodFiltrados,
        dashPedidos: pedRes.data || [],
      });
      render();
    } catch (e) {
      $('kpiGrid').innerHTML = UI.emptyState('Error: ' + e.message);
    }
  };

  const filtrarPorPeriodo = (items, campoFecha) => {
    const anio = parseInt($('dashYear').value);
    const trimestre = $('dashQuarter').value;
    return items.filter((item) => {
      const f = new Date(item[campoFecha]);
      if (f.getFullYear() !== anio) return false;
      if (trimestre && Math.floor(f.getMonth() / 3) + 1 !== parseInt(trimestre)) return false;
      return true;
    });
  };

  const kpi = (label, value, extra, cls = '') => `
    <div class="kpi ${cls}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-extra">${extra}</div>
    </div>`;

  const render = () => {
    const movFiltrados = filtrarPorPeriodo(Store.get('dashMovimientos'), 'fecha');
    const pedFiltrados = filtrarPorPeriodo(Store.get('dashPedidos'), 'fecha');
    const productos = Store.get('dashProductos');

    const unidades = productos.reduce((acc, p) => acc + (p.cantidad || 0), 0);
    const sinStock = productos.filter((p) => (p.cantidad || 0) === 0).length;
    const pendientes = Store.get('dashPedidos').filter((p) => p.estado === 'pendiente').length;

    $('kpiGrid').innerHTML =
      kpi('Productos registrados', productos.length, 'en todo el almacén') +
      kpi('Unidades en stock', unidades, 'suma de todas las cantidades', 'ok') +
      kpi('Productos sin stock', sinStock, 'requieren reposición', 'err') +
      kpi('Pedidos pendientes', pendientes, 'esperando aprobación', 'warn') +
      kpi('Movimientos (período)', movFiltrados.length, 'cambios registrados') +
      kpi('Pedidos (período)', pedFiltrados.length, 'solicitudes creadas');

    // movimientos por mes
    const porMes = new Array(12).fill(0);
    movFiltrados.forEach((m) => porMes[new Date(m.fecha).getMonth()]++);
    renderBarras('chartMovimientos', MESES.map((mes, i) => ({ label: mes, valor: porMes[i] })));

    // stock por categoría
    const porCat = {};
    productos.forEach((p) => { const c = p.categoria || 'Sin categoría'; porCat[c] = (porCat[c] || 0) + (p.cantidad || 0); });
    renderBarras('chartCategorias', Object.entries(porCat).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor));

    // actividad por usuario
    const porUsuario = {};
    movFiltrados.forEach((m) => { const u = m.usuario_nombre || '—'; porUsuario[u] = (porUsuario[u] || 0) + 1; });
    renderBarras('chartUsuarios', Object.entries(porUsuario).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor).slice(0, 8));

    // top productos con menos stock
    const bajoStock = [...productos].sort((a, b) => (a.cantidad || 0) - (b.cantidad || 0)).slice(0, 8)
      .map((p) => ({ label: p.nombre, valor: p.cantidad || 0 }));
    renderBarras('chartBajoStock', bajoStock, true);
  };

  const renderBarras = (elementId, items, invertirColor = false) => {
    const el = $(elementId);
    if (!items.length) { el.innerHTML = '<div class="empty" style="padding:16px 0">Sin datos</div>'; return; }
    const max = Math.max(...items.map((i) => i.valor), 1);
    el.innerHTML = items.map((item) => {
      const pct = Math.round((item.valor / max) * 100);
      const color = invertirColor
        ? (item.valor === 0 ? 'var(--err)' : item.valor <= 3 ? 'var(--warn)' : 'var(--ok)')
        : 'var(--accent)';
      return `
        <div class="bar-row">
          <span class="bar-label" title="${esc(item.label)}">${esc(item.label)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${color}"></div></div>
          <span class="bar-num">${item.valor}</span>
        </div>`;
    }).join('');
  };

  const init = () => {
    llenarAnios();
    $('dashYear').addEventListener('change', render);
    $('dashQuarter').addEventListener('change', render);
    $('dashRefresh').addEventListener('click', cargar);
  };

  return { cargar, init };
})();
