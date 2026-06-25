// ============================================================
// HDS Warehouse · views/stock.js
// Inventario completo con búsqueda y filtros (categoría / estante).
// ============================================================

const Stock = (() => {

  const cargar = async () => {
    const body = $('stockBody');
    body.innerHTML = UI.tableSkeleton(7);
    try {
      const nave = Store.get('naveActual') || 1;
      const { data, error } = await Api.productos.inventario(nave);
      if (error) throw error;
      Store.set('stockData', data || []);

      // poblar filtro de estantes
      const nombres = [...new Set(Store.get('stockData').map((p) => p.estantes?.nombre).filter(Boolean))].sort();
      $('stockEstanteFilter').innerHTML = '<option value="">Todos los estantes</option>' +
        nombres.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');

      render();
    } catch (e) {
      body.innerHTML = UI.emptyRow(7, 'Error: ' + e.message);
    }
  };

  const render = () => {
    const q = $('stockSearch').value.toLowerCase();
    const cat = $('stockCatFilter').value;
    const est = $('stockEstanteFilter').value;
    const body = $('stockBody');

    const filtrados = Store.get('stockData').filter((p) => {
      const nombreEstante = p.estantes?.nombre || '';
      if (q && !(p.nombre || '').toLowerCase().includes(q) && !(p.descripcion || '').toLowerCase().includes(q)) return false;
      if (cat && p.categoria !== cat) return false;
      if (est && nombreEstante !== est) return false;
      return true;
    });

    $('stockTotal').textContent = `${filtrados.length} producto(s)`;
    if (!filtrados.length) { body.innerHTML = UI.emptyRow(7, 'Sin resultados', '🔍'); return; }

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
          <td class="desc">${esc(p.descripcion || '')}</td>
        </tr>`;
    }).join('');
  };

  const init = () => {
    $('stockCatFilter').innerHTML = '<option value="">Todas las categorías</option>' +
      CATEGORIAS.map((c) => `<option value="${c}">${c}</option>`).join('');
    $('stockSearch').addEventListener('input', render);
    $('stockCatFilter').addEventListener('change', render);
    $('stockEstanteFilter').addEventListener('change', render);
  };

  return { cargar, init };
})();
