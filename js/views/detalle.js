// ============================================================
// HDS Warehouse · views/detalle.js
// Vista de producto individual (full page) + modal de cantidad.
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
    if (!id) {
      cont.innerHTML = UI.emptyState('No se pudo cargar el producto.');
      return;
    }
    try {
      const { data, error } = await Api.productos.detalle(id);
      if (error) throw error;
      if (!data) throw new Error('Producto no encontrado');
      Store.set('productoDetalleData', data);
      Store.set('online', true); // confirma conectividad
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

  const chevron = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>`;

  const render = (movimientos) => {
    const p = Store.get('productoDetalleData');
    const cont = $('prodDetailContent');
    const est = p.estantes;
    const colEstante = est ? (COLORES[TIPOS[est.tipo]?.color] || '#64748b') : '#64748b';
    const inicial = p.nombre ? p.nombre.charAt(0).toUpperCase() : '?';
    const stockVal = p.cantidad ?? 0;
    const sinStock = stockVal <= 0;
    const stockStatus = stockVal === 0 ? 'sin-stock' : stockVal <= 5 ? 'bajo' : 'ok';
    const stockLabel = stockVal === 0 ? 'Sin stock' : stockVal <= 5 ? 'Stock bajo' : 'En stock';

    // ── Historial rows ──
    let histRows;
    if (!movimientos.length) {
      histRows = '<div class="pd-empty">Sin movimientos registrados</div>';
    } else {
      histRows = movimientos.map((m) => {
        let deltaTxt = '—', deltaClass = 'eq';
        if (m.cantidad_anterior !== null && m.cantidad_nueva !== null) {
          const d = m.cantidad_nueva - m.cantidad_anterior;
          if (d > 0) { deltaTxt = '+' + d; deltaClass = 'up'; }
          else if (d < 0) { deltaTxt = String(d); deltaClass = 'down'; }
          else { deltaTxt = '0'; }
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

    // ── Edit form ──
    const catOpts = CATEGORIAS.map((c) => `<option value="${c}" ${p.categoria === c ? 'selected' : ''}>${c}</option>`).join('');
    const posOpts = POSICIONES.map((c) => `<option value="${c}" ${p.posicion === c ? 'selected' : ''}>${c}</option>`).join('');

    cont.innerHTML = `
      <div class="pd-layout">

        <!-- ── Hero ── -->
        <div class="pd-hero">
          <div class="pd-hero-chip" style="background:${colEstante}">${esc(inicial)}</div>
          <div class="pd-hero-info">
            <h1 class="pd-hero-name">${esc(p.nombre)}</h1>
            <div class="pd-hero-sub">
              <span>${esc(est ? est.nombre : 'Sin estante')}</span>
              <span class="pd-hero-dot">·</span>
              <span>ID ${p.id}</span>
            </div>
          </div>
          <div class="pd-hero-aside">
            ${p.categoria ? `<span class="cat" style="background:${catColor(p.categoria)}">${esc(p.categoria)}</span>` : ''}
            <span class="pd-stock-status ${stockStatus}">${stockLabel}</span>
          </div>
        </div>

        <!-- ── Fila principal: Stock + QR ── -->
        <div class="pd-main">

          <!-- Stock -->
          <div class="pd-card">
            <div class="pd-stock-wrap">
              <div class="pd-stock-label">Stock actual</div>
              <div class="pd-stock-value" id="pdStockValue">${stockVal}</div>
              <div class="pd-stock-unit">unidades</div>
              <div class="pd-stock-control">
                <button class="pd-stock-btn minus" id="pdMinus" ${sinStock ? 'disabled' : ''}>− Restar</button>
                <button class="pd-stock-btn plus" id="pdPlus">+ Sumar</button>
              </div>
            </div>
          </div>

          <!-- QR -->
          <div class="pd-card pd-qr-card">
            <div class="pd-qr-box">
              <img src="${urlQR(p.id, 150)}" alt="QR" width="150" height="150" loading="lazy">
            </div>
            <div class="pd-qr-meta-wrap">
              ${p.codigo ? `<div class="pd-qr-code">${esc(p.codigo)}</div>` : ''}
              <div class="pd-qr-note">Escaneá para abrir este producto</div>
              <div class="pd-qr-actions">
                <button class="pd-qr-print" id="pdQrPrint">🖨 Imprimir etiqueta</button>
                <button class="pd-qr-print" id="pdQrDownload">⬇ Descargar QR</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Detalles ── -->
        <div class="pd-card pd-details-card">
          <div class="pd-attrs">
            <div class="pd-attr"><span class="k">Ubicación</span><span class="v">${esc(p.ubicacion || '—')}</span></div>
            <div class="pd-attr"><span class="k">Posición</span><span class="v">${esc(p.posicion || '—')}</span></div>
            ${p.codigo ? `<div class="pd-attr"><span class="k">Código</span><span class="v" style="font-family:var(--font-mono);font-size:11px">${esc(p.codigo)}</span></div>` : ''}
            <div class="pd-attr"><span class="k">Estante</span><span class="v">${esc(est ? est.nombre : '—')}</span></div>
            <div class="pd-attr"><span class="k">Precio / unidad</span><span class="v">${fmtPrecio(p.precio)}</span></div>
            ${p.precio != null ? `<div class="pd-attr"><span class="k">Valor total</span><span class="v">${fmtPrecio((p.precio || 0) * (p.cantidad || 0))}</span></div>` : ''}
          </div>
          ${p.descripcion ? `<p class="pd-desc">${esc(p.descripcion)}</p>` : ''}
        </div>

        <!-- ── Historial (colapsable) ── -->
        ${Store.esSupervisorOAdmin ? `
        <div class="pd-section" id="pd-sec-hist">
          <button class="pd-section-toggle">
            <span>📊 Historial de movimientos</span>
            <span class="pd-toggle-icon">${chevron}</span>
          </button>
          <div class="pd-section-body">
            <div class="pd-section-inner">${histRows}</div>
          </div>
        </div>` : ''}

        <!-- ── Editar (colapsable, solo admin) ── -->
        ${Store.esAdmin ? `
        <div class="pd-section" id="pd-sec-edit">
          <button class="pd-section-toggle">
            <span>✏️ Editar producto</span>
            <span class="pd-toggle-icon">${chevron}</span>
          </button>
          <div class="pd-section-body">
            <div class="pd-section-inner">
              <div class="pd-edit-grid">
                <div class="full"><label>Nombre</label><input type="text" id="pdNombre" value="${esc(p.nombre || '')}" maxlength="100"></div>
                <div><label>Categoría</label><select id="pdCategoria">${catOpts}</select></div>
                <div><label>Nivel (estante ${esc(est ? est.nombre : '')})</label>
                  <div class="ubic-wrap">
                    <span class="ubic-prefix">${esc(est ? est.nombre : '')}</span>
                    <input type="number" id="pdUbicNum" min="1" max="99" placeholder="Nº"
                      value="${esc(est && p.ubicacion?.startsWith(est.nombre) ? p.ubicacion.slice(est.nombre.length).replace(/\D/g, '') : (p.ubicacion || '').replace(/\D/g, ''))}">
                  </div>
                </div>
                <div><label>Posición</label><select id="pdPosicion">${posOpts}</select></div>
                <div><label>Precio por unidad ($)</label><input type="number" id="pdPrecio" value="${p.precio ?? ''}" min="0" step="0.01" placeholder="Opcional"></div>
                <div class="full"><label>Descripción</label><textarea id="pdDescripcion" maxlength="300">${esc(p.descripcion || '')}</textarea></div>
              </div>
              <button class="btn-primary" id="pdGuardarDatos" style="width:auto;margin-top:16px">Guardar cambios</button>
            </div>
          </div>
        </div>` : ''}

      </div>`;

    // ── Eventos ──
    $('pdPlus').onclick = () => CantidadModal.abrir('suma');
    $('pdMinus').onclick = () => CantidadModal.abrir('resta');
    if (Store.esAdmin) $('pdGuardarDatos').onclick = guardarDatos;
    const printBtn = $('pdQrPrint');
    if (printBtn) printBtn.onclick = () => imprimirEtiqueta(p);
    const dlBtn = $('pdQrDownload');
    if (dlBtn) dlBtn.onclick = () => descargarQR(p);

    // Acordeones
    cont.querySelectorAll('.pd-section-toggle').forEach((btn) => {
      btn.addEventListener('click', () => btn.closest('.pd-section').classList.toggle('open'));
    });
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

    // Actualizar status pill
    const pill = document.querySelector('.pd-stock-status');
    if (pill) {
      pill.className = 'pd-stock-status ' + (nueva === 0 ? 'sin-stock' : nueva <= 5 ? 'bajo' : 'ok');
      pill.textContent = nueva === 0 ? 'Sin stock' : nueva <= 5 ? 'Stock bajo' : 'En stock';
    }

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
      // Refrescar solo el interior del acordeón si está abierto
      const sec = $('pd-sec-hist');
      if (!sec) return;
      const inner = sec.querySelector('.pd-section-inner');
      if (!inner) return;
      const chevronSvg = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>`;
      const rows = (data || []).map((m) => {
        let deltaTxt = '—', deltaClass = 'eq';
        if (m.cantidad_anterior !== null && m.cantidad_nueva !== null) {
          const d = m.cantidad_nueva - m.cantidad_anterior;
          if (d > 0) { deltaTxt = '+' + d; deltaClass = 'up'; }
          else if (d < 0) { deltaTxt = String(d); deltaClass = 'down'; }
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
      }).join('') || '<div class="pd-empty">Sin movimientos registrados</div>';
      inner.innerHTML = rows;
    } catch { /* noop */ }
  };

  let _guardandoDatos = false;
  const guardarDatos = async () => {
    if (!Store.esAdmin || _guardandoDatos) return;
    const p = Store.get('productoDetalleData');
    const precioTxt = $('pdPrecio').value.trim();
    const precio = precioTxt === '' ? null : parseFloat(precioTxt);
    if (precio !== null && (isNaN(precio) || precio < 0)) {
      const inp = $('pdPrecio');
      inp.classList.add('input-error');
      inp.focus();
      inp.addEventListener('input', () => inp.classList.remove('input-error'), { once: true });
      return UI.toast({ msg: 'El precio debe ser 0 o mayor', tipo: 'warn' });
    }
    // Ubicación = letra del estante + número de nivel
    const prefijo = p.estantes?.nombre
      || Store.get('estantes').find((e) => e.id === p.estante_id)?.nombre || '';
    const nivelTxt = $('pdUbicNum').value.trim();
    const payload = {
      nombre: $('pdNombre').value.trim(),
      categoria: $('pdCategoria').value,
      ubicacion: nivelTxt !== '' ? `${prefijo}${parseInt(nivelTxt)}` : '',
      posicion: $('pdPosicion').value,
      precio,
      descripcion: $('pdDescripcion').value.trim(),
    };
    if (!payload.nombre) {
      const inp = $('pdNombre');
      inp.classList.add('input-error');
      inp.focus();
      inp.addEventListener('input', () => inp.classList.remove('input-error'), { once: true });
      return UI.toast({ msg: 'El nombre es obligatorio', tipo: 'warn' });
    }
    const btn = $('pdGuardarDatos');
    _guardandoDatos = true;
    btn?.classList.add('btn-loading');
    try {
      const { error } = await Api.productos.actualizar(p.id, payload);
      if (error) throw error;
      Object.assign(p, payload);
      await Productos.registrarMovimiento(MOV_ACCION.EDITAR, p, 'Datos editados desde panel');
      UI.toast({ title: '✓ Cambios guardados', tipo: 'ok' });
      cargar();
    } catch (e) {
      UI.toast({ title: 'Error al guardar', msg: e.message, tipo: 'err' });
    } finally {
      _guardandoDatos = false;
      btn?.classList.remove('btn-loading');
    }
  };

  const volver = () => {
    const estanteId = Store.get('productoDetalleData')?.estante_id ?? null;
    Store.patch({ productoDetalleId: null, productoDetalleData: null });
    $('navProducto').classList.remove('allowed');
    App.cambiarVista('mapa');
    if (estanteId) setTimeout(() => Productos.abrir(estanteId), 150);
  };

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
