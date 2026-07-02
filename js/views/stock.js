// ============================================================
// HDS Warehouse · views/stock.js
// Inventario completo con búsqueda y filtros (categoría / estante).
// ============================================================

const Stock = (() => {

  const cargar = async () => {
    const body = $('stockBody');
    body.innerHTML = UI.tableSkeleton(8);
    try {
      const nave = Store.get('naveActual') || 1;
      const sub = $('stockSubtitle');
      if (sub) sub.textContent = `Inventario completo · Nave ${nave}`;
      const { data, error } = await Api.productos.inventario(nave);
      if (error) throw error;
      Store.set('stockData', data || []);

      // poblar filtro de estantes
      const nombres = [...new Set(Store.get('stockData').map((p) => p.estantes?.nombre).filter(Boolean))].sort();
      const eSel = $('stockEstanteFilter'), eVal = eSel.value;
      eSel.innerHTML = '<option value="">Todos los estantes</option>' +
        nombres.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
      eSel.value = eVal;

      // poblar filtro de niveles (ubicación: A1, A2, …)
      const niveles = [...new Set(Store.get('stockData').map((p) => p.ubicacion).filter(Boolean))].sort();
      const uSel = $('stockUbicFilter'), uVal = uSel.value;
      uSel.innerHTML = '<option value="">Todos los niveles</option>' +
        niveles.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
      uSel.value = uVal;

      render();
    } catch (e) {
      body.innerHTML = UI.emptyRow(8, 'Error: ' + e.message);
    }
  };

  const render = () => {
    const q = $('stockSearch').value.toLowerCase();
    const cat = $('stockCatFilter').value;
    const est = $('stockEstanteFilter').value;
    const ubic = $('stockUbicFilter').value;
    const estado = $('stockEstadoFilter').value;
    const orden = $('stockOrden').value;
    const body = $('stockBody');

    const filtrados = Store.get('stockData').filter((p) => {
      const nombreEstante = p.estantes?.nombre || '';
      const cant = p.cantidad || 0;
      if (q && !(p.nombre || '').toLowerCase().includes(q) && !(p.descripcion || '').toLowerCase().includes(q)) return false;
      if (cat && p.categoria !== cat) return false;
      if (est && nombreEstante !== est) return false;
      if (ubic && p.ubicacion !== ubic) return false;
      if (estado === 'sin' && cant !== 0) return false;
      if (estado === 'bajo' && (cant < 1 || cant > 5)) return false;
      if (estado === 'ok' && cant < 6) return false;
      if (estado === 'sinprecio' && p.precio != null) return false;
      return true;
    });

    // Contador de filtros activos en el botón "Filtros"
    const activos = [cat, est, ubic, estado, orden].filter(Boolean).length;
    const badge = $('stockFiltrosCount');
    badge.textContent = activos;
    badge.classList.toggle('on', activos > 0);

    // Ordenamiento (por defecto: como llega, agrupado por estante)
    const ordenes = {
      'nombre':      (a, b) => (a.nombre || '').localeCompare(b.nombre || ''),
      'cant-desc':   (a, b) => (b.cantidad || 0) - (a.cantidad || 0),
      'cant-asc':    (a, b) => (a.cantidad || 0) - (b.cantidad || 0),
      'precio-desc': (a, b) => (b.precio ?? -1) - (a.precio ?? -1),
      'precio-asc':  (a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity),
    };
    if (ordenes[orden]) filtrados.sort(ordenes[orden]);

    // Total de productos + valor del inventario filtrado (si hay precios)
    const valorTotal = filtrados.reduce((acc, p) => acc + (p.precio != null ? p.precio * (p.cantidad || 0) : 0), 0);
    $('stockTotal').textContent = `${filtrados.length} producto(s)` + (valorTotal > 0 ? ` · ${fmtPrecio(valorTotal)}` : '');
    if (!filtrados.length) { body.innerHTML = UI.emptyRow(8, 'Sin resultados', '🔍'); return; }

    body.innerHTML = filtrados.map((p) => {
      const e = p.estantes;
      const colorEstante = e ? (COLORES[TIPOS[e.tipo]?.color] || '#64748b') : '#64748b';
      return `
        <tr>
          <td><span class="estante-chip" style="background:${colorEstante}">${esc(e ? e.nombre : '—')}</span></td>
          <td><span class="ubic">${esc(p.ubicacion || '—')}</span></td>
          <td>${esc(p.nombre)}</td>
          <td><span class="cat" style="background:${catColor(p.categoria)}">${esc(p.categoria || '—')}</span></td>
          <td style="color:var(--text-dim)">${esc(p.posicion || '—')}</td>
          <td style="font-weight:600">${p.cantidad ?? 0}</td>
          <td>${fmtPrecio(p.precio)}</td>
          <td class="desc">${esc(p.descripcion || '')}</td>
        </tr>`;
    }).join('');
  };

  const init = () => {
    $('stockCatFilter').innerHTML = '<option value="">Todas las categorías</option>' +
      CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join('');
    // Mostrar / esconder el panel de filtros
    const fBtn = $('stockFiltrosBtn'), fPanel = $('stockFiltros');
    fBtn.addEventListener('click', () => {
      const abierto = fPanel.classList.toggle('open');
      fBtn.classList.toggle('active', abierto);
    });

    $('stockSearch').addEventListener('input', render);
    $('stockCatFilter').addEventListener('change', render);
    $('stockEstanteFilter').addEventListener('change', render);
    $('stockUbicFilter').addEventListener('change', render);
    $('stockEstadoFilter').addEventListener('change', render);
    $('stockOrden').addEventListener('change', render);
  };

  return { cargar, init };
})();
