// ============================================================
// HDS Warehouse · views/detalle.js
// Vista de producto individual (full page) + modal de cantidad.
// Todos cambian stock; historial solo supervisor/admin; editar
// datos solo admin. Mismo comportamiento que el original.
// ============================================================

// ── Modal de cantidad (compartido entre detalle y estante) ──
const CantidadModal = (() => {
  const abrir = (tipo) => {
    Store.patch({ tipoOperacion: tipo, modalEstanteProductoId: null, modalEstanteTipo: null });
    $('cantModalTitle').textContent = tipo === 'suma' ? '+ Sumar unidades' : '− Restar unidades';
    $('cantModalInput').value = '1';
    $('cantidadModal').classList.add('active');
    setTimeout(() => $('cantModalInput').focus(), 100);
  };

  const abrirEstante = (prodId, tipo) => {
    Store.patch({ modalEstanteProductoId: prodId, modalEstanteTipo: tipo, tipoOperacion: null });
    const p = Store.get('productos').find((x) => x.id === prodId);
    const nombre = p ? p.nombre : 'producto';
    $('cantModalTitle').textContent = tipo === 'suma' ? `+ Sumar a ${nombre}` : `− Restar de ${nombre}`;
    $('cantModalInput').value = '1';
    $('cantidadModal').classList.add('active');
    setTimeout(() => $('cantModalInput').focus(), 100);
  };

  const cerrar = () => {
    $('cantidadModal').classList.remove('active');
    Store.patch({ tipoOperacion: null, modalEstanteProductoId: null, modalEstanteTipo: null });
  };

  const confirmar = () => {
    const estanteId = Store.get('modalEstanteProductoId');
    if (estanteId !== null) {
      const tipo = Store.get('modalEstanteTipo');
      const cantidad = parseInt($('cantModalInput').value) || 0;
      if (cantidad <= 0) return UI.toast({ msg: 'Ingresá una cantidad válida', tipo: 'warn' });
      cerrar();
      Productos.changeStockCantidad(estanteId, tipo === 'suma' ? cantidad : -cantidad);
    } else {
      Detalle.confirmarCantidad(Store.get('tipoOperacion'));
    }
  };

  const init = () => {
    $('cantModalCancel').addEventListener('click', cerrar);
    $('cantModalConfirm').addEventListener('click', confirmar);
    $('cantModalInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
      if (e.key === 'Escape') cerrar();
    });
  };

  return { abrir, abrirEstante, cerrar, init };
})();


// ── Vista de detalle de producto ──
const Detalle = (() => {

  const abrir = (id) => {
    Store.set('productoDetalleId', id);
    Productos.cerrar();
    $('navProducto').classList.add('allowed');
    App.cambiarVista('producto');
  };

  const cargar = async () => {
    const cont = $('prodDetailContent');
    UI.showLoader(cont, 'Cargando producto…');
    const id = Store.get('productoDetalleId');
    if (!id || !Store.get('online')) {
      cont.innerHTML = UI.emptyState('No se pudo cargar el producto.');
      return;
    }
    try {
      const { data, error } = await Api.productos.detalle(id);
      if (error) throw error;
      Store.set('productoDetalleData', data);
    } catch (e) {
      cont.innerHTML = UI.emptyState('Error: ' + e.message);
      return;
    }

    let movimientos = [];
    if (Store.esSupervisorOAdmin) {
      try {
        const { data } = await Api.movimientos.porProducto(id, 5);
        movimientos = data || [];
      } catch { movimientos = []; }
    }
    render(movimientos);
  };

  const histCardHtml = (movimientos) => {
    if (!Store.esSupervisorOAdmin) return '';
    let histRows;
    if (!movimientos.length) {
      histRows = '<div class="empty" style="padding:20px 0">Sin movimientos registrados</div>';
    } else {
      histRows = movimientos.map((m) => {
        let deltaTxt = '—', deltaClass = 'eq';
        if (m.cantidad_anterior !== null && m.cantidad_nueva !== null) {
          const d = m.cantidad_nueva - m.cantidad_anterior;
          if (d > 0) { deltaTxt = '+' + d; deltaClass = 'up'; }
          else if (d < 0) { deltaTxt = String(d); deltaClass = 'down'; }
          else { deltaTxt = '0'; deltaClass = 'eq'; }
        } else if (m.accion === MOV_ACCION.CREAR) { deltaTxt = '+' + (m.cantidad_nueva ?? 0); deltaClass = 'up'; }
        else if (m.accion === MOV_ACCION.ELIMINAR) { deltaTxt = '✕'; deltaClass = 'down'; }
        return `
          <div class="pd-hist-row">
            <div class="pd-hist-delta ${deltaClass}">${esc(deltaTxt)}</div>
            <div class="pd-hist-info">
              <div class="who">${esc(m.usuario_nombre || '—')}</div>
              <div class="when">${fmtFecha(m.fecha)}</div>
            </div>
            <div class="pd-hist-action">${esc(m.accion)}</div>
          </div>`;
      }).join('');
    }
    return `<div class="pd-card span"><div class="pd-hist-title">📊 Últimos 5 movimientos</div>${histRows}</div>`;
  };

  const editCardHtml = (p) => {
    if (!Store.esAdmin) return '';
    const catOpts = CATEGORIAS.map((c) => `<option value="${c}" ${p.categoria === c ? 'selected' : ''}>${c}</option>`).join('');
    const posOpts = POSICIONES.map((c) => `<option value="${c}" ${p.posicion === c ? 'selected' : ''}>${c}</option>`).join('');
    return `
      <div class="pd-card span">
        <div class="pd-hist-title">✏️ Editar datos del producto</div>
        <div class="pd-edit-grid">
          <div class="full"><label>Nombre</label><input type="text" id="pdNombre" value="${esc(p.nombre || '')}" maxlength="100"></div>
          <div><label>Categoría</label><select id="pdCategoria">${catOpts}</select></div>
          <div><label>Ubicación</label><input type="text" id="pdUbicacion" value="${esc(p.ubicacion || '')}" maxlength="10"></div>
          <div><label>Posición</label><select id="pdPosicion">${posOpts}</select></div>
          <div></div>
          <div class="full"><label>Descripción</label><textarea id="pdDescripcion" maxlength="300">${esc(p.descripcion || '')}</textarea></div>
        </div>
        <button class="btn-primary" id="pdGuardarDatos" style="width:auto; margin-top:14px;">Guardar cambios</button>
      </div>`;
  };

  const render = (movimientos) => {
    const p = Store.get('productoDetalleData');
    const cont = $('prodDetailContent');
    const est = p.estantes;
    const colEstante = est ? (COLORES[TIPOS[est.tipo]?.color] || '#64748b') : '#64748b';
    const inicial = p.nombre ? p.nombre.charAt(0).toUpperCase() : '?';
    const sinStock = (p.cantidad ?? 0) <= 0;

    cont.innerHTML = `
      <div class="pd-grid">
        <div class="pd-card">
          <div class="pd-head">
            <div class="pd-chip" style="background:${colEstante}">${esc(inicial)}</div>
            <div class="pd-meta">
              <h2>${esc(p.nombre)}</h2>
              <div class="pd-sub">Estante ${esc(est ? est.nombre : '—')} · ID ${p.id}</div>
            </div>
          </div>
          <div class="pd-attrs">
            <div class="pd-attr"><span class="k">Categoría</span>
              <span class="v"><span class="cat" style="background:${catColor(p.categoria)}">${esc(p.categoria || '—')}</span></span></div>
            <div class="pd-attr"><span class="k">Ubicación</span><span class="v">${esc(p.ubicacion || '—')}</span></div>
            <div class="pd-attr"><span class="k">Posición</span><span class="v">${esc(p.posicion || '—')}</span></div>
          </div>
          ${p.descripcion ? `<div style="margin-top:14px; color:var(--text-dim); font-size:11px; line-height:1.6">${esc(p.descripcion)}</div>` : ''}
        </div>

        <div class="pd-card">
          <div class="pd-qr">
            <div class="pd-qr-box">
              <img src="${urlQR(p.id, 150)}" alt="Código QR del producto" width="150" height="150" loading="lazy">
            </div>
            ${p.codigo ? `<div class="pd-qr-code">${esc(p.codigo)}</div>` : ''}
            <div class="pd-qr-note">Escaneá para abrir este producto</div>
            <button class="pd-qr-print" id="pdQrPrint">🖨 Imprimir etiqueta</button>
          </div>
        </div>

        <div class="pd-card span">
          <div class="pd-stock-wrap">
            <div class="pd-stock-label">Stock actual</div>
            <div class="pd-stock-value" id="pdStockValue">${p.cantidad ?? 0}</div>
            <div class="pd-stock-unit">unidades</div>
            <div class="pd-stock-control">
              <button class="pd-stock-btn minus" id="pdMinus" ${sinStock ? 'disabled' : ''}>− Restar</button>
              <button class="pd-stock-btn plus" id="pdPlus">+ Sumar</button>
            </div>
          </div>
        </div>

        ${histCardHtml(movimientos)}
        ${editCardHtml(p)}
      </div>`;

    $('pdPlus').onclick = () => CantidadModal.abrir('suma');
    $('pdMinus').onclick = () => CantidadModal.abrir('resta');
    if (Store.esAdmin) $('pdGuardarDatos').onclick = guardarDatos;
    const printBtn = $('pdQrPrint');
    if (printBtn) printBtn.onclick = () => imprimirEtiqueta(p);
  };

  const confirmarCantidad = async (tipo) => {
    const p = Store.get('productoDetalleData');
    if (!p || !tipo) return;
    const cantidad = parseInt($('cantModalInput').value) || 0;
    if (cantidad <= 0) return UI.toast({ msg: 'Ingresá una cantidad válida', tipo: 'warn' });

    const anterior = p.cantidad || 0;
    const delta = tipo === 'suma' ? cantidad : -cantidad;
    const nueva = Math.max(0, anterior + delta);
    p.cantidad = nueva;
    CantidadModal.cerrar();

    const val = $('pdStockValue');
    val.textContent = nueva;
    val.classList.add('bump');
    setTimeout(() => val.classList.remove('bump'), 200);
    $('pdMinus').disabled = (nueva <= 0);

    if (!Store.get('online')) return;
    try {
      await Api.productos.setCantidad(p.id, nueva);
      await Productos.registrarMovimiento(
        delta > 0 ? MOV_ACCION.STOCK_MAS : MOV_ACCION.STOCK_MENOS, p,
        `Stock ${delta > 0 ? 'incrementado' : 'reducido'} desde panel (${Math.abs(cantidad)} unidades)`,
        anterior, nueva);
      if (Store.esSupervisorOAdmin) refrescarHistorial();
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  const refrescarHistorial = async () => {
    try {
      const { data } = await Api.movimientos.porProducto(Store.get('productoDetalleId'), 5);
      render(data || []);
    } catch { /* noop */ }
  };

  const guardarDatos = async () => {
    if (!Store.esAdmin) return;
    const p = Store.get('productoDetalleData');
    const payload = {
      nombre: $('pdNombre').value.trim(),
      categoria: $('pdCategoria').value,
      ubicacion: $('pdUbicacion').value.trim(),
      posicion: $('pdPosicion').value,
      descripcion: $('pdDescripcion').value.trim(),
    };
    if (!payload.nombre) return UI.toast({ msg: 'El nombre es obligatorio', tipo: 'warn' });
    try {
      const { error } = await Api.productos.actualizar(p.id, payload);
      if (error) throw error;
      Object.assign(p, payload);
      await Productos.registrarMovimiento(MOV_ACCION.EDITAR, p, 'Datos editados desde panel');
      UI.toast({ title: '✓ Cambios guardados', tipo: 'ok' });
      cargar();
    } catch (e) { UI.toast({ title: 'Error al guardar', msg: e.message, tipo: 'err' }); }
  };

  const volver = () => {
    const estanteId = Store.get('productoDetalleData')?.estante_id ?? null;
    Store.patch({ productoDetalleId: null, productoDetalleData: null });
    $('navProducto').classList.remove('allowed');
    App.cambiarVista('mapa');
    if (estanteId) setTimeout(() => Productos.abrir(estanteId), 150);
  };

  // Abre una ventana con una etiqueta lista para imprimir (QR + datos).
  const imprimirEtiqueta = (p) => {
    const est = p.estantes;
    const win = window.open('', '_blank', 'width=420,height=560');
    if (!win) { UI.toast({ msg: 'Permití las ventanas emergentes para imprimir', tipo: 'warn' }); return; }
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiqueta ${esc(p.codigo || p.nombre)}</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;margin:0;padding:24px;color:#0B1C3F;text-align:center}
        .et{border:1.5px solid #0B1C3F;border-radius:12px;padding:20px;max-width:300px;margin:0 auto}
        h2{margin:0 0 4px;font-size:18px}
        .sub{color:#6B7A93;font-size:12px;margin-bottom:14px}
        img{width:180px;height:180px}
        .code{font-family:'Courier New',monospace;font-weight:bold;background:#EEF1F4;
              padding:4px 10px;border-radius:6px;display:inline-block;margin-top:12px;font-size:14px}
        .meta{margin-top:10px;font-size:11px;color:#6B7A93}
        @media print{button{display:none}}
      </style></head><body>
        <div class="et">
          <h2>${esc(p.nombre)}</h2>
          <div class="sub">Estante ${esc(est ? est.nombre : '—')} · ${esc(p.categoria || '')}</div>
          <img src="${urlQR(p.id, 180)}" alt="QR">
          ${p.codigo ? `<div class="code">${esc(p.codigo)}</div>` : ''}
          <div class="meta">Ubicación: ${esc(p.ubicacion || '—')}</div>
        </div>
        <button onclick="window.print()" style="margin-top:18px;padding:10px 20px;border:none;
          background:#0D63EA;color:#fff;border-radius:8px;font-size:14px;cursor:pointer">Imprimir</button>
      </body></html>`);
    win.document.close();
  };

  const init = () => $('prodDetailBack').addEventListener('click', volver);

  return { abrir, cargar, render, confirmarCantidad, init };
})();