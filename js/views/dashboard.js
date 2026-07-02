// ============================================================
// HDS Warehouse · views/dashboard.js
// Dashboard de inventario: métricas por sección, gráficos
// Chart.js (stock mensual con drill-down de movimientos,
// torta de categorías con desglose, línea de actividad),
// comparador de meses, top items con drawer y modal QR.
// ============================================================

const Dashboard = (() => {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const PALETA = ['#185fa5', '#0f6e56', '#854f0b', '#7f77dd', '#d85a30', '#5f5e5a', '#b0367c', '#3b7d1e'];

  let chartStock = null, chartCateg = null, chartSubCateg = null, chartActividad = null;

  // ── helpers ──
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const anioSel = () => parseInt($('dashYear').value) || new Date().getFullYear();

  // Delta de unidades de un movimiento (positivo = ingreso)
  const deltaMov = (m) => (m.cantidad_nueva ?? 0) - (m.cantidad_anterior ?? 0);

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
      $('dashMetricsInv').innerHTML = UI.emptyState('Error: ' + e.message);
    }
  };

  // ── movimientos del año seleccionado, agrupados por mes ──
  const movsPorMes = () => {
    const anio = anioSel();
    const porMes = Array.from({ length: 12 }, () => []);
    Store.get('dashMovimientos').forEach((m) => {
      const f = new Date(m.fecha);
      if (f.getFullYear() === anio) porMes[f.getMonth()].push(m);
    });
    return porMes;
  };

  // ── stock reconstruido a fin de cada mes del año seleccionado ──
  // Parte del total actual y descuenta hacia atrás los deltas de movimientos.
  const stockMensual = () => {
    const anio = anioSel();
    const hoy = new Date();
    const totalActual = Store.get('dashProductos').reduce((acc, p) => acc + (p.cantidad || 0), 0);
    const movs = [...Store.get('dashMovimientos')]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // más reciente primero

    const finDeMes = (y, m) => new Date(y, m + 1, 0, 23, 59, 59, 999);
    const resultado = new Array(12).fill(null);
    let stock = totalActual;
    let i = 0;
    // Recorremos meses desde el actual hacia atrás hasta enero del año elegido
    for (let y = hoy.getFullYear(), m = hoy.getMonth(); y > anio || (y === anio && m >= 0); m--) {
      if (m < 0) { m = 11; y--; }
      const corte = finDeMes(y, m);
      // descontar movimientos posteriores al corte
      while (i < movs.length && new Date(movs[i].fecha) > corte) {
        stock -= deltaMov(movs[i]);
        i++;
      }
      if (y === anio) resultado[m] = Math.max(0, stock);
      if (y === anio && m === 0) break;
    }
    return resultado;
  };

  // ── resumen de un mes (para comparador y panel de movimientos) ──
  const resumenMes = (idx, porMes, stockMes) => {
    const movs = porMes[idx];
    let ing = 0, egr = 0;
    movs.forEach((m) => { const d = deltaMov(m); if (d > 0) ing += d; else egr += -d; });
    return { stock: stockMes[idx], movs: movs.length, ing, egr, neto: ing - egr };
  };

  // ── métricas ──
  const metric = (cls, label, value, sub, subCls = 'dash-neutral') => `
    <div class="dash-metric ${cls}">
      <div class="dash-metric-label">${label}</div>
      <div class="dash-metric-value">${value}</div>
      <div class="dash-metric-sub ${subCls}">${sub}</div>
    </div>`;

  const renderMetricas = (porMes, stockMes) => {
    const productos = Store.get('dashProductos');
    const unidades = productos.reduce((acc, p) => acc + (p.cantidad || 0), 0);
    const sinStock = productos.filter((p) => (p.cantidad || 0) === 0).length;
    const pendientes = Store.get('dashPedidos').filter((p) => p.estado === 'pendiente').length;

    // delta vs mes anterior (solo si el año elegido es el actual)
    const hoy = new Date();
    let subUnidades = 'unidades totales', subUnidadesCls = 'dash-neutral';
    if (anioSel() === hoy.getFullYear() && hoy.getMonth() > 0 && stockMes[hoy.getMonth() - 1] != null) {
      const dif = unidades - stockMes[hoy.getMonth() - 1];
      subUnidades = `${dif >= 0 ? '▲ +' : '▼ '}${Math.abs(dif).toLocaleString('es-AR')} vs ${MESES[hoy.getMonth() - 1].toLowerCase()}`;
      subUnidadesCls = dif >= 0 ? 'dash-up' : 'dash-down';
    }

    $('dashMetricsInv').innerHTML =
      metric('inv', 'Unidades en stock', unidades.toLocaleString('es-AR'), subUnidades, subUnidadesCls) +
      metric('inv', 'Productos registrados', productos.length, 'líneas de producto') +
      metric('inv', 'Sin stock', sinStock, 'requieren reposición', sinStock > 0 ? 'dash-down' : 'dash-up') +
      metric('inv', 'Pedidos pendientes', pendientes, 'esperando aprobación', pendientes > 0 ? 'dash-down' : 'dash-neutral');

    // actividad del año seleccionado
    let ing = 0, egr = 0, movTotal = 0;
    const usuarios = new Set();
    porMes.forEach((movs) => movs.forEach((m) => {
      movTotal++;
      const d = deltaMov(m);
      if (d > 0) ing += d; else egr += -d;
      if (m.usuario_nombre) usuarios.add(m.usuario_nombre);
    }));

    $('dashMetricsAct').innerHTML =
      metric('act', 'Movimientos', movTotal.toLocaleString('es-AR'), `registrados en ${anioSel()}`) +
      metric('act', 'Unidades ingresadas', '+' + ing.toLocaleString('es-AR'), 'suma de ingresos', 'dash-up') +
      metric('act', 'Unidades egresadas', '-' + egr.toLocaleString('es-AR'), 'suma de egresos', 'dash-down') +
      metric('act', 'Usuarios activos', usuarios.size, 'operaron en el período');
  };

  // ── gráfico: stock mensual (barras + drill-down) ──
  const renderChartStock = (porMes, stockMes) => {
    if (chartStock) { chartStock.destroy(); chartStock = null; }
    if (typeof Chart === 'undefined') return;
    const gridC = cssVar('--border') || 'rgba(0,0,0,0.06)';
    const txtC = cssVar('--text-dim') || '#888';
    const accent = cssVar('--accent') || '#0D63EA';

    chartStock = new Chart($('dashChartStock'), {
      type: 'bar',
      data: {
        labels: MESES,
        datasets: [{
          label: 'Unidades',
          data: stockMes,
          backgroundColor: MESES.map(() => accent),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ' Stock: ' + (ctx.parsed.y ?? 0).toLocaleString('es-AR') + ' uds · ' + porMes[ctx.dataIndex].length + ' movs' } },
        },
        scales: {
          x: { grid: { color: gridC }, ticks: { color: txtC, font: { size: 11 } } },
          y: { grid: { color: gridC }, ticks: { color: txtC, font: { size: 11 }, callback: (v) => v.toLocaleString('es-AR') } },
        },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const i = elements[0].index;
          chartStock.data.datasets[0].backgroundColor = MESES.map((_, j) => j === i ? cssVar('--ink') || '#0c447c' : accent);
          chartStock.update();
          abrirMovPanel(i, porMes, stockMes);
        },
      },
    });
    $('dashLegendStock').innerHTML =
      `<span class="dash-legend-item"><span class="dash-legend-dot" style="background:${accent}"></span>Stock a fin de mes (reconstruido por movimientos)</span>`;
  };

  // ── panel de movimientos de un mes ──
  const abrirMovPanel = (idx, porMes, stockMes) => {
    const movs = porMes[idx];
    const r = resumenMes(idx, porMes, stockMes);
    $('dashMovTitle').textContent = `${MESES[idx]} ${anioSel()} — Movimientos`;
    $('dashMovSummary').innerHTML =
      `<div class="dash-mov-stat"><div class="dash-mov-stat-label">Ingresos</div><div class="dash-mov-stat-val dash-up">+${r.ing.toLocaleString('es-AR')} uds</div></div>` +
      `<div class="dash-mov-stat"><div class="dash-mov-stat-label">Egresos</div><div class="dash-mov-stat-val dash-down">-${r.egr.toLocaleString('es-AR')} uds</div></div>` +
      `<div class="dash-mov-stat"><div class="dash-mov-stat-label">Neto</div><div class="dash-mov-stat-val ${r.neto >= 0 ? 'dash-up' : 'dash-down'}">${r.neto >= 0 ? '+' : ''}${r.neto.toLocaleString('es-AR')} uds</div></div>`;

    const tbody = $('dashMovBody');
    if (!movs.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-dim);padding:10px 0;">Sin movimientos este mes</td></tr>';
    } else {
      tbody.innerHTML = movs.map((m) => {
        const d = deltaMov(m);
        const tag = d > 0 ? '<span class="dash-tag-ing">Ingreso</span>'
          : d < 0 ? '<span class="dash-tag-egr">Egreso</span>'
          : `<span class="dash-tag-neu">${esc(m.accion || '—')}</span>`;
        const f = new Date(m.fecha);
        return `<tr>
          <td>${tag}</td>
          <td style="padding-left:8px;">${esc(m.producto_nombre || '—')}</td>
          <td style="font-weight:600;">${d > 0 ? '+' : ''}${d}</td>
          <td style="color:var(--text-dim);">${esc(m.usuario_nombre || '—')}</td>
          <td style="text-align:right;color:var(--text-dim);">${f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
        </tr>`;
      }).join('');
    }
    $('dashMovPanel').classList.add('open');
  };

  const cerrarMovPanel = () => {
    $('dashMovPanel').classList.remove('open');
    if (chartStock) {
      const accent = cssVar('--accent') || '#0D63EA';
      chartStock.data.datasets[0].backgroundColor = MESES.map(() => accent);
      chartStock.update();
    }
  };

  // ── comparador de meses ──
  const compararMeses = (porMes, stockMes) => {
    const ia = parseInt($('dashCmpA').value), ib = parseInt($('dashCmpB').value);
    if (isNaN(ia) || isNaN(ib) || ia === ib) {
      UI.toast({ title: 'Comparar meses', msg: 'Seleccioná dos meses distintos', tipo: 'warn' });
      return;
    }
    const a = resumenMes(ia, porMes, stockMes), b = resumenMes(ib, porMes, stockMes);
    const col = (mes, d) => `
      <div class="dash-cmp-col">
        <div class="dash-cmp-col-title">${mes}</div>
        <div class="dash-cmp-row"><span class="dash-cmp-row-label">Stock</span><span>${d.stock != null ? d.stock.toLocaleString('es-AR') + ' uds' : '—'}</span></div>
        <div class="dash-cmp-row"><span class="dash-cmp-row-label">Movimientos</span><span>${d.movs}</span></div>
        <div class="dash-cmp-row"><span class="dash-cmp-row-label">Ingresos</span><span class="dash-up">+${d.ing.toLocaleString('es-AR')} uds</span></div>
        <div class="dash-cmp-row"><span class="dash-cmp-row-label">Egresos</span><span class="dash-down">-${d.egr.toLocaleString('es-AR')} uds</span></div>
        <div class="dash-cmp-row"><span class="dash-cmp-row-label">Neto</span><span class="${d.neto >= 0 ? 'dash-up' : 'dash-down'}">${d.neto >= 0 ? '+' : ''}${d.neto.toLocaleString('es-AR')} uds</span></div>
      </div>`;
    $('dashCmpGrid').innerHTML = col(MESES[ia], a) + col(MESES[ib], b);
    const ds = (b.stock ?? 0) - (a.stock ?? 0);
    const dm = b.movs - a.movs;
    $('dashCmpDelta').innerHTML =
      `<div class="dash-cmp-delta-title">Diferencia ${MESES[ib]} vs ${MESES[ia]}</div>` +
      `<div class="dash-cmp-delta-row"><span class="dash-cmp-row-label">Stock</span><span class="${ds >= 0 ? 'dash-up' : 'dash-down'}">${ds >= 0 ? '+' : ''}${ds.toLocaleString('es-AR')} uds</span></div>` +
      `<div class="dash-cmp-delta-row"><span class="dash-cmp-row-label">Movimientos</span><span class="${dm >= 0 ? 'dash-up' : 'dash-down'}">${dm >= 0 ? '+' : ''}${dm}</span></div>`;
    $('dashCmpPanel').classList.add('open');
    $('dashCmpClose').style.display = '';
  };

  const cerrarCmp = () => {
    $('dashCmpPanel').classList.remove('open');
    $('dashCmpClose').style.display = 'none';
    $('dashCmpA').value = ''; $('dashCmpB').value = '';
  };

  // ── gráfico: categorías (torta con desglose) ──
  const categorias = () => {
    const porCat = {};
    Store.get('dashProductos').forEach((p) => {
      const c = p.categoria || 'Sin categoría';
      (porCat[c] = porCat[c] || []).push(p);
    });
    return Object.entries(porCat)
      .map(([label, items], i) => ({
        label, items,
        uds: items.reduce((acc, p) => acc + (p.cantidad || 0), 0),
      }))
      .sort((a, b) => b.uds - a.uds)
      .map((c, i) => ({ ...c, color: PALETA[i % PALETA.length] }));
  };

  const renderChartCateg = (cats) => {
    if (chartCateg) { chartCateg.destroy(); chartCateg = null; }
    if (typeof Chart === 'undefined' || !cats.length) return;
    const isDark = document.documentElement.dataset.theme === 'dark';

    chartCateg = new Chart($('dashChartCateg'), {
      type: 'doughnut',
      data: {
        labels: cats.map((c) => c.label),
        datasets: [{
          data: cats.map((c) => c.uds),
          backgroundColor: cats.map((c) => c.color),
          borderWidth: 2,
          borderColor: isDark ? cssVar('--surface') : '#fff',
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + ctx.parsed.toLocaleString('es-AR') + ' uds' } },
        },
        onClick: (evt, elements) => { if (elements.length) abrirCategPanel(elements[0].index, cats); },
      },
    });
    $('dashChartCateg').style.cursor = 'pointer';

    const leg = $('dashLegendCateg');
    leg.innerHTML = '';
    cats.forEach((c, i) => {
      const sp = document.createElement('span');
      sp.className = 'dash-legend-item';
      sp.innerHTML = `<span class="dash-legend-dot" style="background:${c.color}"></span>${esc(c.label)} · ${c.uds.toLocaleString('es-AR')} uds`;
      sp.addEventListener('click', () => abrirCategPanel(i, cats));
      leg.appendChild(sp);
    });
  };

  const abrirCategPanel = (idx, cats) => {
    const cat = cats[idx];
    const totalUds = cats.reduce((acc, c) => acc + c.uds, 0) || 1;
    $('dashCategTitle').innerHTML =
      `<span class="dash-categ-dot" style="background:${cat.color}"></span>${esc(cat.label)} — ${Math.round((cat.uds / totalUds) * 100)}% del inventario`;

    // sub-torta: productos de la categoría por unidades (top 8)
    const top = [...cat.items].sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0)).slice(0, 8);
    if (chartSubCateg) { chartSubCateg.destroy(); chartSubCateg = null; }
    if (typeof Chart !== 'undefined' && top.some((p) => (p.cantidad || 0) > 0)) {
      const isDark = document.documentElement.dataset.theme === 'dark';
      chartSubCateg = new Chart($('dashChartSubCateg'), {
        type: 'doughnut',
        data: {
          labels: top.map((p) => p.nombre),
          datasets: [{
            data: top.map((p) => p.cantidad || 0),
            backgroundColor: top.map((_, i) => PALETA[i % PALETA.length]),
            borderWidth: 2,
            borderColor: isDark ? cssVar('--surface') : '#fff',
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '55%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + ctx.parsed.toLocaleString('es-AR') + ' uds' } },
          },
        },
      });
    }
    const legSub = $('dashLegendSubCateg');
    legSub.innerHTML = '';
    top.forEach((p, i) => {
      const sp = document.createElement('span');
      sp.className = 'dash-legend-item';
      sp.style.cursor = 'default';
      sp.innerHTML = `<span class="dash-legend-dot" style="background:${PALETA[i % PALETA.length]}"></span>${esc(p.nombre)} · ${(p.cantidad || 0)} uds`;
      legSub.appendChild(sp);
    });

    // lista de items con botón QR
    const list = $('dashCategItems');
    list.innerHTML = '';
    [...cat.items].sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0)).forEach((p) => {
      const div = document.createElement('div');
      div.className = 'dash-categ-item';
      div.innerHTML =
        `<span class="dash-categ-item-name">${esc(p.nombre)}</span>` +
        `<span class="dash-categ-item-meta">${(p.cantidad || 0)} uds</span>` +
        `<span class="dash-categ-item-meta">${esc(p.estantes?.nombre || '—')}</span>`;
      const btn = document.createElement('button');
      btn.className = 'dash-btn-qr';
      btn.textContent = 'QR';
      btn.title = 'Ver código QR';
      btn.addEventListener('click', () => abrirQR(p));
      div.appendChild(btn);
      list.appendChild(div);
    });

    const panel = $('dashCategPanel');
    panel.classList.add('open');
    $('dashCategHint').style.display = 'none';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const cerrarCategPanel = () => {
    $('dashCategPanel').classList.remove('open');
    $('dashCategHint').style.display = '';
    if (chartSubCateg) { chartSubCateg.destroy(); chartSubCateg = null; }
  };

  // ── gráfico: actividad mensual (línea) ──
  const renderChartActividad = (porMes) => {
    if (chartActividad) { chartActividad.destroy(); chartActividad = null; }
    if (typeof Chart === 'undefined') return;
    const gridC = cssVar('--border') || 'rgba(0,0,0,0.06)';
    const txtC = cssVar('--text-dim') || '#888';
    const accent = cssVar('--accent') || '#0D63EA';

    chartActividad = new Chart($('dashChartActividad'), {
      type: 'line',
      data: {
        labels: MESES,
        datasets: [{
          label: 'Movimientos',
          data: porMes.map((movs) => movs.length),
          borderColor: accent,
          backgroundColor: 'rgba(13, 99, 234, 0.08)',
          borderWidth: 2,
          pointBackgroundColor: accent,
          pointRadius: 4,
          fill: true,
          tension: 0.35,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ' ' + ctx.parsed.y + ' movimientos' } },
        },
        scales: {
          x: { grid: { color: gridC }, ticks: { color: txtC, font: { size: 11 } } },
          y: { grid: { color: gridC }, ticks: { color: txtC, font: { size: 11 }, precision: 0 }, beginAtZero: true },
        },
      },
    });
  };

  // ── top items con drawer ──
  const renderTopItems = () => {
    const productos = [...Store.get('dashProductos')]
      .sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0))
      .slice(0, 9);
    const totalUds = Store.get('dashProductos').reduce((acc, p) => acc + (p.cantidad || 0), 0) || 1;
    const maxUds = productos[0]?.cantidad || 1;

    const tbody = $('dashTopBody');
    tbody.innerHTML = '';
    if (!productos.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:12px 0;color:var(--text-dim);">Sin productos</td></tr>';
      return;
    }

    productos.forEach((p, idx) => {
      const pct = (((p.cantidad || 0) / totalUds) * 100).toFixed(1);
      const barW = Math.round(((p.cantidad || 0) / maxUds) * 100);
      const rankCls = idx === 0 ? 'dash-rank-1' : idx === 1 ? 'dash-rank-2' : idx === 2 ? 'dash-rank-3' : '';

      const trMain = document.createElement('tr');
      const tdMain = document.createElement('td');
      tdMain.setAttribute('colspan', '6');
      tdMain.innerHTML = `<div class="dash-top-row" role="button">
          <span class="dash-rank ${rankCls}">${idx + 1}</span>
          <span class="dash-top-nombre">${esc(p.nombre)}</span>
          <span class="dash-top-cat">${esc(p.categoria || 'Sin categoría')}</span>
          <span class="dash-top-estante">${esc(p.estantes?.nombre || '—')}</span>
          <span class="dash-top-uds">${(p.cantidad || 0).toLocaleString('es-AR')}</span>
          <span class="dash-top-chevron">▼</span>
        </div>`;
      trMain.appendChild(tdMain);
      tbody.appendChild(trMain);

      const trDrawer = document.createElement('tr');
      const tdDrawer = document.createElement('td');
      tdDrawer.setAttribute('colspan', '6');
      tdDrawer.style.padding = '0';
      const drawer = document.createElement('div');
      drawer.className = 'dash-top-drawer';
      drawer.innerHTML =
        `<div class="dash-drawer-item"><div class="dash-drawer-label">Estante</div><div class="dash-drawer-val">${esc(p.estantes?.nombre || '—')}</div></div>` +
        `<div class="dash-drawer-item"><div class="dash-drawer-label">Categoría</div><div class="dash-drawer-val">${esc(p.categoria || 'Sin categoría')}</div></div>` +
        `<div class="dash-drawer-item"><div class="dash-drawer-label">Unidades</div><div class="dash-drawer-val">${(p.cantidad || 0).toLocaleString('es-AR')}</div></div>` +
        `<div class="dash-drawer-item"><div class="dash-drawer-label">% del inventario</div><div class="dash-drawer-val">
            <div class="dash-drawer-bar-wrap"><div class="dash-drawer-bar-bg"><div class="dash-drawer-bar" style="width:${barW}%"></div></div><span style="font-size:11px;font-weight:600;">${pct}%</span></div>
        </div></div>` +
        `<div class="dash-drawer-item" style="grid-column:span 2;"><div class="dash-drawer-label" style="margin-bottom:4px;">Código QR</div>
            <div style="display:flex;align-items:center;gap:12px;">
                <img class="dash-drawer-qr" src="${urlQR(p.id, 80)}" alt="QR ${esc(p.nombre)}" loading="lazy">
                <button class="dash-btn-qr dash-drawer-qr-btn">Ver QR grande</button>
            </div>
        </div>`;
      drawer.querySelector('.dash-drawer-qr-btn').addEventListener('click', () => abrirQR(p));
      tdDrawer.appendChild(drawer);
      trDrawer.appendChild(tdDrawer);
      tbody.appendChild(trDrawer);

      const row = tdMain.querySelector('.dash-top-row');
      const chevron = tdMain.querySelector('.dash-top-chevron');
      row.addEventListener('click', () => {
        drawer.classList.toggle('open');
        chevron.classList.toggle('open');
      });
    });
  };

  // ── modal QR ──
  let _qrProducto = null;
  const abrirQR = (p) => {
    _qrProducto = p;
    $('dashQrNombre').textContent = p.nombre;
    $('dashQrCodigo').textContent = p.codigo ? 'Código: ' + p.codigo : 'ID: ' + p.id;
    $('dashQrImg').src = urlQR(p.id, 180);
    $('dashQrMeta').innerHTML =
      `<span>Categoría</span><strong>${esc(p.categoria || 'Sin categoría')}</strong>` +
      `<span>Estante</span><strong>${esc(p.estantes?.nombre || '—')}</strong>` +
      `<span>Unidades</span><strong>${(p.cantidad || 0).toLocaleString('es-AR')}</strong>` +
      `<span>Ubicación</span><strong>${esc(p.ubicacion || '—')}</strong>`;
    $('dashQrModal').classList.add('active');
  };
  const cerrarQR = () => $('dashQrModal').classList.remove('active');

  // ── render principal ──
  const render = () => {
    const hoy = new Date();
    $('dashFecha').textContent = hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    $('dashSubtitle').textContent = `Estado del almacén — ${MESES[hoy.getMonth()].toLowerCase()} ${hoy.getFullYear()}`;

    const porMes = movsPorMes();
    const stockMes = stockMensual();

    renderMetricas(porMes, stockMes);
    renderChartStock(porMes, stockMes);
    renderChartCateg(categorias());
    renderChartActividad(porMes);
    renderTopItems();

    // reset de paneles al re-renderizar
    cerrarMovPanel();
    cerrarCategPanel();
    cerrarCmp();

    // guardar contexto para los handlers del comparador / panel
    _ctx = { porMes, stockMes };
  };

  let _ctx = { porMes: [], stockMes: [] };

  const init = () => {
    llenarAnios();
    $('dashYear').addEventListener('change', render);
    $('dashRefresh').addEventListener('click', cargar);
    $('dashMovClose').addEventListener('click', cerrarMovPanel);
    $('dashCategClose').addEventListener('click', cerrarCategPanel);
    $('dashCmpBtn').addEventListener('click', () => compararMeses(_ctx.porMes, _ctx.stockMes));
    $('dashCmpClose').addEventListener('click', cerrarCmp);
    $('dashQrClose').addEventListener('click', cerrarQR);
    $('dashQrDownload').addEventListener('click', () => { if (_qrProducto) descargarQR(_qrProducto); });
    $('dashQrModal').addEventListener('click', (e) => { if (e.target === $('dashQrModal')) cerrarQR(); });
    // llenar selects del comparador
    const selA = $('dashCmpA'), selB = $('dashCmpB');
    MESES.forEach((m, i) => {
      selA.innerHTML += `<option value="${i}">${m}</option>`;
      selB.innerHTML += `<option value="${i}">${m}</option>`;
    });
  };

  return { cargar, init };
})();
