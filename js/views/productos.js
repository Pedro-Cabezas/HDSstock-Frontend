// ============================================================
// HDS Warehouse · views/productos.js
// Modal de productos de un estante: listado, alta/edición, control
// de stock (vía modal de cantidad) y edición masiva (solo admin).
// ============================================================

const Productos = (() => {

  // ── Drag del panel flotante (se inicializa una sola vez) ──
  // Solo modifica `transform` para evitar reflows de layout (GPU composited).
  let _dragReady = false;
  const _initDrag = () => {
    const content = document.querySelector('#prodModal .prod-content');
    const head = $('prodHead');
    if (!content || !head) return;

    let active = false, ox = 0, oy = 0, dw = 0, dh = 0;
    let pendX = 0, pendY = 0, rafId = null;

    const applyMove = () => {
      content.style.transform = `translate(${pendX}px, ${pendY}px)`;
      rafId = null;
    };

    const startDrag = (cx, cy) => {
      const r = content.getBoundingClientRect();
      dw = r.width; dh = r.height;
      ox = cx - r.left; oy = cy - r.top;
      // Convertir posición actual a offset de transform puro
      // left:50%; top:50% posiciona la esquina en (vw/2, vh/2)
      // entonces transform actual = posición_visual - (vw/2, vh/2)
      pendX = r.left - window.innerWidth / 2;
      pendY = r.top - window.innerHeight / 2;
      content.style.transform = `translate(${pendX}px, ${pendY}px)`;
      content.style.willChange = 'transform';
      active = true;
    };

    const moveDrag = (cx, cy) => {
      if (!active) return;
      // Posición deseada de la esquina top-left
      let x = cx - ox;
      let y = cy - oy;
      x = Math.max(-(dw - 120), Math.min(window.innerWidth - 120, x));
      y = Math.max(0, Math.min(window.innerHeight - 44, y));
      pendX = x - window.innerWidth / 2;
      pendY = y - window.innerHeight / 2;
      if (!rafId) rafId = requestAnimationFrame(applyMove);
    };

    const stopDrag = () => {
      if (!active) return;
      active = false;
      content.style.willChange = '';
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    };

    head.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', stopDrag);

    head.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!active) return;
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('touchend', stopDrag);
  };

  const registrarMovimiento = async (accion, producto, detalle, cantAnterior = null, cantNueva = null) => {
    if (!Store.get('online')) return;
    const estanteId = producto.estante_id ?? Store.get('prodEstanteId');
    const estante = Store.get('estantes').find((e) => e.id === estanteId);
    try {
      await Api.movimientos.registrar({
        producto_id: producto.id ?? null,
        producto_nombre: producto.nombre ?? '',
        estante_nombre: estante ? estante.nombre : '',
        usuario_nombre: Store.user.nombre,
        accion, detalle,
        cantidad_anterior: cantAnterior, cantidad_nueva: cantNueva,
      });
    } catch { /* el log no debe romper la operación */ }
  };

  const abrir = async (id) => {
    Store.patch({ prodEstanteId: id, prodEditId: null, seleccionados: [] });
    // Resetear posición al centro antes de mostrar
    const content = document.querySelector('#prodModal .prod-content');
    if (content) { content.style.transform = ''; content.style.willChange = ''; }
    $('prodModal').classList.add('active');
    renderHead();
    UI.showLoader($('prodBody'));
    if (!_dragReady) { _initDrag(); _dragReady = true; }
    await load();
  };

  const cerrar = () => {
    $('prodModal').classList.remove('active');
    Store.patch({ prodEstanteId: null, prodEditId: null, seleccionados: [] });
  };

  const load = async () => {
    if (!Store.get('online')) { Store.set('productos', []); return renderList(); }
    try {
      const { data, error } = await Api.productos.porEstante(Store.get('prodEstanteId'));
      if (error) throw error;
      Store.set('productos', data || []);
    } catch { Store.set('productos', []); }
    renderList();
  };

  const renderHead = () => {
    const e = Store.get('estantes').find((x) => x.id === Store.get('prodEstanteId'));
    if (!e) return;
    const def = TIPOS[e.tipo];
    $('prodHead').innerHTML = `
      <div class="t">
        <div class="prod-chip" style="background:${COLORES[def.color]}">${esc(e.nombre)}</div>
        <div class="meta"><b>Estante ${esc(e.nombre)}</b><span>${def.label} · ID ${e.id}</span></div>
      </div>
      <button class="x" id="prodClose">Cerrar ✕</button>`;
    $('prodClose').addEventListener('click', cerrar);
  };

  // ── Celda de stock (admin: input directo / otros: span) ──
  const stockCell = (p) => Store.esAdmin
    ? `<div class="stock">
         <button data-act="modal-minus" data-id="${p.id}">−</button>
         <input type="number" class="qty-input" data-qty="${p.id}" value="${p.cantidad ?? 0}" min="0" aria-label="Cantidad">
         <button data-act="modal-plus" data-id="${p.id}">+</button>
       </div>`
    : `<div class="stock">
         <button data-act="modal-minus" data-id="${p.id}">−</button>
         <span class="n" id="stockVal-${p.id}">${p.cantidad ?? 0}</span>
         <button data-act="modal-plus" data-id="${p.id}">+</button>
       </div>`;

  const renderList = () => {
    const body = $('prodBody');
    const productos = Store.get('productos');
    Store.set('seleccionados', []);
    const colCheck = Store.esAdmin ? '<th style="width:30px"><input type="checkbox" id="checkAll" aria-label="Seleccionar todos"></th>' : '';

    let rows;
    if (!productos.length) {
      rows = UI.emptyRow(Store.esAdmin ? 6 : 5, 'Sin productos en este estante', '📦');
    } else {
      // Agrupar por ubicación (A1, A2, A3, etc.)
      const grouped = {};
      productos.forEach((p) => {
        const nivel = p.ubicacion || 'Sin nivel';
        if (!grouped[nivel]) grouped[nivel] = [];
        grouped[nivel].push(p);
      });

      // Renderizar secciones por nivel
      rows = Object.keys(grouped)
        .sort() // Ordena A1, A2, A3, etc.
        .map((nivel) => {
          const productosNivel = grouped[nivel];
          return `
            <tr style="background:var(--surface-2); font-weight:600; border-top:2px solid var(--border)">
              <td colspan="${Store.esAdmin ? 6 : 5}" style="padding:10px 13px; color:var(--accent)">
                📍 Nivel ${esc(nivel)} (${productosNivel.length} producto${productosNivel.length !== 1 ? 's' : ''})
              </td>
            </tr>
            ${productosNivel.map((p) => `
            <tr>
              ${Store.esAdmin ? `<td><input type="checkbox" class="row-check" data-check="${p.id}" aria-label="Seleccionar"></td>` : ''}
              <td><span class="ubic">${esc(p.ubicacion || '—')}</span></td>
              <td>
                <div class="clickable-name" data-detalle="${p.id}" role="button" tabindex="0">${esc(p.nombre)}</div>
                <div class="desc">${esc(p.descripcion || '')}</div>
              </td>
              <td><span class="cat" style="background:${catColor(p.categoria)}">${esc(p.categoria || '—')}</span>
                <div style="font-size:9px;color:var(--text-dim);margin-top:3px">${esc(p.posicion || '')}</div></td>
              <td>${stockCell(p)}</td>
              <td class="acts">
                <button data-act="edit" data-id="${p.id}">Editar</button>
                <button class="danger" data-act="del" data-id="${p.id}">Eliminar</button>
              </td>
            </tr>`).join('')}
          `;
        }).join('');
    }

    const bulkBar = Store.esAdmin ? `
      <div class="bulk-bar" id="bulkBar">
        <span class="sel-count" id="selCount">0 seleccionados</span>
        <label style="font-size:9px; color:var(--text-dim); text-transform:uppercase">Fijar cantidad:</label>
        <input type="number" id="bulkQty" min="0" placeholder="0" aria-label="Cantidad masiva">
        <button id="bulkAplicar" class="btn-primary">Aplicar a seleccionados</button>
        <button id="bulkEliminar" class="danger">Eliminar seleccionados</button>
      </div>` : '';

    body.innerHTML = `
      <div class="prod-toolbar">
        <span class="count">${productos.length} producto(s)</span>
        <button class="btn-accent" id="prodAdd">+ Agregar producto</button>
      </div>
      ${bulkBar}
      <table class="prod-table">
        <thead><tr>${colCheck}<th>Ubic.</th><th>Producto</th><th>Categoría</th><th>Stock</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    bindList(body);
  };

  // ── Delegación de eventos del listado ──
  const bindList = (body) => {
    $('prodAdd').addEventListener('click', () => renderForm(null));

    body.querySelectorAll('.clickable-name[data-detalle]').forEach((el) => {
      const open = () => Detalle.abrir(Number(el.dataset.detalle));
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });

    body.querySelectorAll('button[data-act]').forEach((btn) => {
      const id = Number(btn.dataset.id);
      const act = btn.dataset.act;
      btn.addEventListener('click', () => {
        if (act === 'modal-plus') CantidadModal.abrirEstante(id, 'suma');
        else if (act === 'modal-minus') CantidadModal.abrirEstante(id, 'resta');
        else if (act === 'edit') renderForm(id);
        else if (act === 'del') eliminar(id);
      });
    });

    if (!Store.esAdmin) return;

    body.querySelectorAll('input[data-qty]').forEach((input) => {
      const id = Number(input.dataset.qty);
      input.addEventListener('change', () => {
        const nueva = Math.max(0, parseInt(input.value) || 0);
        input.value = nueva;
        setCantidadDirecta(id, nueva);
      });
    });

    const checkAll = $('checkAll');
    checkAll?.addEventListener('change', () => {
      body.querySelectorAll('.row-check').forEach((c) => { c.checked = checkAll.checked; });
      actualizarSeleccion();
    });
    body.querySelectorAll('.row-check').forEach((c) => c.addEventListener('change', actualizarSeleccion));

    $('bulkAplicar')?.addEventListener('click', aplicarCantidadMasiva);
    $('bulkEliminar')?.addEventListener('click', eliminarSeleccionados);
  };

  const actualizarSeleccion = () => {
    const seleccionados = [];
    document.querySelectorAll('.row-check').forEach((c) => { if (c.checked) seleccionados.push(Number(c.dataset.check)); });
    Store.set('seleccionados', seleccionados);
    const bar = $('bulkBar'), count = $('selCount');
    if (bar && count) {
      count.textContent = `${seleccionados.length} seleccionado(s)`;
      bar.classList.toggle('visible', seleccionados.length > 0);
    }
  };

  const setCantidadDirecta = async (id, nueva) => {
    const p = Store.get('productos').find((x) => x.id === id);
    if (!p) return;
    const anterior = p.cantidad || 0;
    if (anterior === nueva) return;
    p.cantidad = nueva;
    if (!Store.get('online')) return;
    try {
      await Api.productos.setCantidad(id, nueva);
      await registrarMovimiento(nueva > anterior ? MOV_ACCION.STOCK_MAS : MOV_ACCION.STOCK_MENOS, p, 'Cantidad fijada directamente', anterior, nueva);
    } catch { /* noop */ }
  };

  const aplicarCantidadMasiva = async () => {
    const seleccionados = Store.get('seleccionados');
    if (!seleccionados.length) return;
    const valor = parseInt($('bulkQty').value);
    if (isNaN(valor) || valor < 0) return UI.toast({ msg: 'Ingresá una cantidad válida', tipo: 'warn' });
    if (!confirm(`¿Fijar cantidad ${valor} en ${seleccionados.length} producto(s)?`)) return;
    for (const id of seleccionados) {
      const p = Store.get('productos').find((x) => x.id === id);
      if (!p || (p.cantidad || 0) === valor) continue;
      const anterior = p.cantidad || 0;
      p.cantidad = valor;
      try {
        await Api.productos.setCantidad(id, valor);
        await registrarMovimiento(valor > anterior ? MOV_ACCION.STOCK_MAS : MOV_ACCION.STOCK_MENOS, p, 'Edición masiva de cantidad', anterior, valor);
      } catch { /* noop */ }
    }
    renderList();
    UI.toast({ title: 'Stock actualizado', tipo: 'ok' });
  };

  const eliminarSeleccionados = async () => {
    const seleccionados = Store.get('seleccionados');
    if (!seleccionados.length) return;
    if (!confirm(`¿Eliminar ${seleccionados.length} producto(s)? Esta acción no se puede deshacer.`)) return;
    for (const id of seleccionados) {
      const p = Store.get('productos').find((x) => x.id === id);
      try {
        await Api.productos.eliminar(id);
        if (p) await registrarMovimiento(MOV_ACCION.ELIMINAR, p, 'Eliminación masiva', p.cantidad, null);
      } catch { /* noop */ }
    }
    await load();
    UI.toast({ title: 'Productos eliminados', tipo: 'warn' });
  };

  // ── Form alta/edición ──
  const renderForm = (id) => {
    Store.set('prodEditId', id);
    const p = id ? Store.get('productos').find((x) => x.id === id) : {};
    const catOpts = getCategorias().map((c) => `<option value="${c}">${c}</option>`).join('');
    const posOpts = POSICIONES.map((c) => `<option value="${c}" ${p.posicion === c ? 'selected' : ''}>${c}</option>`).join('');
    $('prodBody').innerHTML = `
      <div class="prod-toolbar">
        <span class="count">${id ? 'Editar' : 'Nuevo'} producto</span>
        <button id="prodBack" style="width:auto">← Volver</button>
      </div>
      <div class="prod-form">
        <div class="full"><label>Nombre</label><input type="text" id="fNombre" value="${esc(p.nombre || '')}" maxlength="100"></div>
        <div><label>Categoría</label><input type="text" id="fCategoria" list="categorias-list" value="${esc(p.categoria || '')}" maxlength="50"><datalist id="categorias-list">${catOpts}</datalist></div>
        <div><label>Cantidad</label><input type="number" id="fCantidad" value="${p.cantidad ?? 0}" min="0"></div>
        <div><label>Ubicación (ej: A1)</label><input type="text" id="fUbicacion" value="${esc(p.ubicacion || '')}" maxlength="10"></div>
        <div><label>Posición</label><select id="fPosicion">${posOpts}</select></div>
        <div class="full"><label>Descripción</label><textarea id="fDescripcion" maxlength="300">${esc(p.descripcion || '')}</textarea></div>
      </div>
      <div class="modal-buttons">
        <button id="prodCancel">Cancelar</button>
        <button class="btn-primary" id="prodSave">${id ? 'Guardar' : 'Agregar'}</button>
      </div>`;
    $('prodBack').addEventListener('click', renderList);
    $('prodCancel').addEventListener('click', renderList);
    $('prodSave').addEventListener('click', guardar);
  };

  const guardar = async () => {
    if (!Store.get('online')) return UI.toast({ title: 'Sin conexión', tipo: 'err' });
    const categoria = $('fCategoria').value.trim();
    if (!categoria) return UI.toast({ msg: 'La categoría es obligatoria', tipo: 'warn' });
    agregarCategoria(categoria);
    const payload = {
      estante_id: Store.get('prodEstanteId'),
      nave: Store.get('naveActual') || 1,
      nombre: $('fNombre').value.trim(),
      categoria,
      cantidad: parseInt($('fCantidad').value) || 0,
      ubicacion: $('fUbicacion').value.trim(),
      posicion: $('fPosicion').value,
      descripcion: $('fDescripcion').value.trim(),
    };
    if (!payload.nombre) return UI.toast({ msg: 'El nombre es obligatorio', tipo: 'warn' });
    const prodEditId = Store.get('prodEditId');
    try {
      if (prodEditId) {
        const { error } = await Api.productos.actualizar(prodEditId, payload);
        if (error) throw error;
        await registrarMovimiento(MOV_ACCION.EDITAR, { ...payload, id: prodEditId }, 'Producto editado');
      } else {
        // Generar el código corto del producto al crearlo
        payload.codigo = generarCodigoProducto();
        const { data, error } = await Api.productos.crear(payload);
        if (error) throw error;
        await registrarMovimiento(MOV_ACCION.CREAR, data[0], 'Producto creado', null, payload.cantidad);
      }
      await load();
      UI.toast({ title: 'Guardado', tipo: 'ok' });
    } catch (e) { UI.toast({ title: 'Error al guardar', msg: e.message, tipo: 'err' }); }
  };

  // Cambio de stock por cantidad (desde el modal de cantidad del estante)
  const changeStockCantidad = async (id, delta) => {
    const p = Store.get('productos').find((x) => x.id === id);
    if (!p) return;
    const anterior = p.cantidad || 0;
    const nueva = Math.max(0, anterior + delta);
    if (anterior === nueva) return;
    p.cantidad = nueva;
    const span = $('stockVal-' + id); if (span) span.textContent = nueva;
    const inp = document.querySelector(`input[data-qty="${id}"]`); if (inp) inp.value = nueva;
    if (!Store.get('online')) return;
    try {
      await Api.productos.setCantidad(id, nueva);
      await registrarMovimiento(delta > 0 ? MOV_ACCION.STOCK_MAS : MOV_ACCION.STOCK_MENOS, p,
        `Stock ${delta > 0 ? 'incrementado' : 'reducido'} (${Math.abs(delta)} unidades)`, anterior, nueva);
    } catch { /* noop */ }
  };

  const eliminar = async (id) => {
    if (!Store.get('online')) return UI.toast({ title: 'Sin conexión', tipo: 'err' });
    if (!confirm('¿Eliminar este producto?')) return;
    const p = Store.get('productos').find((x) => x.id === id);
    try {
      const { error } = await Api.productos.eliminar(id);
      if (error) throw error;
      if (p) await registrarMovimiento(MOV_ACCION.ELIMINAR, p, 'Producto eliminado', p.cantidad, null);
      await load();
      UI.toast({ title: 'Producto eliminado', tipo: 'warn' });
    } catch (e) { UI.toast({ title: 'Error al eliminar', msg: e.message, tipo: 'err' }); }
  };

  return { abrir, cerrar, load, registrarMovimiento, changeStockCantidad };
})();