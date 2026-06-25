// ============================================================
// HDS Warehouse · views/mapa.js
// Vista del plano: canvas, dibujo de estantes, hover animado,
// drag & drop y edición (solo admin). Mismo comportamiento visual.
// ============================================================

const Mapa = (() => {
  let canvas, ctx;
  let animFrame = null;

  // ── Geometría / transform ──
  // Capa de zoom/desplazamiento del usuario (para touch en celular).
  // Con userScale=1 y pan en 0, el transform es idéntico al ajuste automático.
  let userScale = 1, userPanX = 0, userPanY = 0;
  const resetView = () => { userScale = 1; userPanX = 0; userPanY = 0; };

  const getTransform = () => {
    const cw = canvas.width, ch = canvas.height;
    const { WORLD_W, WORLD_H, PAD } = PLANO_CONFIG;
    const baseScale = Math.min((cw - PAD * 2) / WORLD_W, (ch - PAD * 2) / WORLD_H);
    const baseOX = (cw - WORLD_W * baseScale) / 2;
    const baseOY = (ch - WORLD_H * baseScale) / 2;
    const cx = cw / 2, cy = ch / 2;
    return {
      scale: baseScale * userScale,
      offsetX: cx - (cx - baseOX) * userScale + userPanX,
      offsetY: cy - (cy - baseOY) * userScale + userPanY,
    };
  };
  const toWorld = (cx, cy) => {
    const t = getTransform();
    return { x: (cx - t.offsetX) / t.scale, y: (cy - t.offsetY) / t.scale };
  };
  const bbox = (e) => {
    const tipo = TIPOS[e.tipo];
    const w = e.rotacion === 90 ? tipo.h : tipo.w;
    const h = e.rotacion === 90 ? tipo.w : tipo.h;
    return { x: e.pos_x - w / 2, y: e.pos_y - h / 2, w, h };
  };
  const hitTest = (wx, wy) => {
    const estantes = Store.get('estantes');
    for (let i = estantes.length - 1; i >= 0; i--) {
      const b = bbox(estantes[i]);
      if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) return estantes[i].id;
    }
    return null;
  };

  // ── Animación de hover (requestAnimationFrame) ──
  const animate = () => {
    let needsMore = !!Store.get('searchFocusId');  // sigue corriendo mientras hay foco de búsqueda
    const hoveredId = Store.get('hoveredId');
    for (const e of Store.get('estantes')) {
      const target = e.id === hoveredId ? 1 : 0;
      if (e._h === undefined) e._h = 0;
      const diff = target - e._h;
      if (Math.abs(diff) > 0.015) { e._h += diff * 0.22; needsMore = true; }
      else e._h = target;
    }
    draw();
    animFrame = needsMore ? requestAnimationFrame(animate) : null;
  };
  const kickAnim = () => { if (!animFrame) animFrame = requestAnimationFrame(animate); };

  // ── Dibujo del plano + estantes (idéntico al original) ──
  const draw = () => {
    const t = getTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(t.offsetX, t.offsetY);
    ctx.scale(t.scale, t.scale);

    const W = PLANO.wall;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const floorFill = dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.75)';
    const gridDot = dark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(11, 28, 63, 0.07)';

    // Piso
    ctx.fillStyle = floorFill;
    ctx.fillRect(W.x, W.y, W.w, W.h);
    ctx.fillStyle = gridDot;
    for (let gx = W.x + 20; gx < W.x + W.w; gx += 20)
      for (let gy = W.y + 20; gy < W.y + W.h; gy += 20)
        ctx.fillRect(gx - 0.5, gy - 0.5, 1, 1);

    const innerGrad = ctx.createLinearGradient(W.x, W.y, W.x, W.y + 60);
    innerGrad.addColorStop(0, dark ? 'rgba(0, 0, 0, 0.18)' : 'rgba(11, 28, 63, 0.05)');
    innerGrad.addColorStop(1, 'rgba(11, 28, 63, 0)');
    ctx.fillStyle = innerGrad;
    ctx.fillRect(W.x, W.y, W.w, 60);

    // Paredes — usa "ink" que se adapta al tema
    const ink = dark ? '148, 163, 184' : '11, 28, 63';
    const inkRGBA = (a) => `rgba(${ink}, ${a})`;
    ctx.strokeStyle = inkRGBA(0.40); ctx.lineWidth = 2.5;
    ctx.strokeRect(W.x, W.y, W.w, W.h);
    ctx.strokeStyle = inkRGBA(0.07); ctx.lineWidth = 7;
    ctx.strokeRect(W.x - 3, W.y - 3, W.w + 6, W.h + 6);

    // Puerta (el trazo "borra" la pared con el color del piso)
    ctx.strokeStyle = dark ? '#0b0f1a' : '#FFFFFF'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(PLANO.door.x1, W.y); ctx.lineTo(PLANO.door.x2, W.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(13, 99, 234, 0.75)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(PLANO.door.x1, W.y); ctx.lineTo(PLANO.door.x2, W.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(13, 99, 234, 0.70)';
    ctx.font = '600 9px "Barlow Condensed"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ENTRADA', (PLANO.door.x1 + PLANO.door.x2) / 2, W.y - 12);

    // Escalera
    const R = PLANO.room;
    ctx.fillStyle = inkRGBA(0.04); ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.strokeStyle = inkRGBA(0.20); ctx.lineWidth = 1; ctx.strokeRect(R.x, R.y, R.w, R.h);
    ctx.strokeStyle = inkRGBA(0.12); ctx.lineWidth = 1;
    for (let py = R.y + 14; py < R.y + R.h - 6; py += 14) {
      ctx.beginPath(); ctx.moveTo(R.x + 10, py); ctx.lineTo(R.x + R.w - 10, py); ctx.stroke();
    }
    ctx.save();
    ctx.translate(R.x + 26, R.y + R.h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = inkRGBA(0.50);
    ctx.font = '600 11px "Barlow Condensed"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ESCALERA', 0, 0);
    ctx.restore();

    // Zona de carga
    const C = PLANO.camion;
    ctx.save();
    ctx.beginPath(); ctx.rect(C.x, C.y, C.w, C.h); ctx.clip();
    ctx.fillStyle = 'rgba(13, 99, 234, 0.05)'; ctx.fillRect(C.x, C.y, C.w, C.h);
    ctx.strokeStyle = 'rgba(13, 99, 234, 0.10)'; ctx.lineWidth = 5;
    for (let d = -C.h; d < C.w + C.h; d += 16) {
      ctx.beginPath(); ctx.moveTo(C.x + d, C.y + C.h); ctx.lineTo(C.x + d + C.h, C.y); ctx.stroke();
    }
    ctx.restore();
    ctx.setLineDash([7, 5]); ctx.strokeStyle = 'rgba(13, 99, 234, 0.55)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(C.x, C.y, C.w, C.h); ctx.setLineDash([]);
    ctx.font = '600 10px "Barlow Condensed"';
    const zcText = 'ZONA DE CARGA';
    const zcW = ctx.measureText(zcText).width;
    ctx.fillStyle = 'rgba(13, 99, 234, 0.90)';
    roundedPath(ctx, C.x + C.w / 2 - zcW / 2 - 8, C.y + C.h / 2 - 9, zcW + 16, 18, 9); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(zcText, C.x + C.w / 2, C.y + C.h / 2);

    // Estantes
    const selectedId = Store.get('selectedId');
    const editMode = Store.get('editMode');
    const colorPalette = dark ? COLORES : COLORES_LIGHT;
    for (const e of Store.get('estantes')) {
      const tipo = TIPOS[e.tipo];
      const sel = e.id === selectedId;
      const col = colorPalette[tipo.color];
      const h = e._h || 0;
      const escala = 1 + h * 0.08;
      const rot = e.rotacion === 90 ? Math.PI / 2 : 0;
      const w2 = tipo.w / 2, h2 = tipo.h / 2;
      const rad = Math.min(8, tipo.w / 4, tipo.h / 4);

      // ── Colores del estante según el tema ──
      // El relleno y la letra derivan del mismo color base (col), para
      // que el fondo "tire" al mismo tono que el texto de cada tipo.
      let fillCol, strokeCol, textCol, haloCol;
      if (dark) {
        // Modo oscuro (como la referencia): fondo = tono apagado del color,
        // letra = versión clara y brillante del MISMO color.
        fillCol  = hexAlpha(shade(col, 0.40), 0.55 + 0.15 * h);
        strokeCol = sel ? '#3b82f6' : hexAlpha(col, 0.85);
        textCol  = tint(col, 0.40);
        haloCol  = hexAlpha(shade(col, 0.55), 0.50);
      } else {
        // Modo claro: colores pastel ya claros, solo ajusta opacidad y borde.
        fillCol  = hexAlpha(col, 0.88 + 0.10 * h);
        strokeCol = sel ? '#0D63EA' : hexAlpha(shade(col, 0.22), 0.75);
        textCol  = shade(col, 0.35);
        haloCol  = hexAlpha(col, 0.25);
      }

      ctx.save();
      ctx.translate(e.pos_x, e.pos_y); ctx.rotate(rot); ctx.scale(escala, escala);
      // Sombra suave constante (les da cuerpo), un poco más al pasar el mouse
      ctx.shadowColor = hexAlpha(col, (dark ? 0.40 : 0.25) + 0.30 * h);
      ctx.shadowBlur = 8 + h * 12; ctx.shadowOffsetY = 2;
      // Relleno sólido y levemente transparente
      roundedPath(ctx, -w2, -h2, tipo.w, tipo.h, rad);
      ctx.fillStyle = fillCol;
      ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      // Borde definido del mismo color (o azul si está seleccionado)
      roundedPath(ctx, -w2, -h2, tipo.w, tipo.h, rad);
      ctx.lineWidth = sel ? 2.5 : 1.5;
      ctx.strokeStyle = strokeCol;
      ctx.stroke();
      if (sel && editMode) {
        const o = 5, L = 6;
        ctx.strokeStyle = sel && dark ? '#3b82f6' : '#0D63EA'; ctx.lineWidth = 1.5;
        for (const [cx, cy, dx, dy] of [
          [-w2 - o, -h2 - o, 1, 1], [w2 + o, -h2 - o, -1, 1],
          [-w2 - o, h2 + o, 1, -1], [w2 + o, h2 + o, -1, -1],
        ]) {
          ctx.beginPath(); ctx.moveTo(cx + dx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * L); ctx.stroke();
        }
      }
      ctx.restore();

      ctx.save();
      ctx.translate(e.pos_x, e.pos_y); ctx.scale(escala, escala);
      ctx.font = '700 12px "Barlow Condensed"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = haloCol;
      ctx.strokeText(e.nombre, 0, 0.5);
      ctx.fillStyle = textCol; ctx.fillText(e.nombre, 0, 0.5);
      ctx.restore();
    }

    // ── Anillo pulsante del estante encontrado por búsqueda ──
    const searchFocusId = Store.get('searchFocusId');
    if (searchFocusId) {
      const ef = Store.get('estantes').find((x) => x.id === searchFocusId);
      if (ef) {
        const tipo = TIPOS[ef.tipo];
        const phase = (Date.now() % 1600) / 1600;
        const pulse = Math.sin(phase * Math.PI * 2);
        const alpha = 0.55 + 0.35 * pulse;
        const expand = 5 + 3 * pulse;
        const rotf = ef.rotacion === 90 ? Math.PI / 2 : 0;
        const fw2 = tipo.w / 2, fh2 = tipo.h / 2;
        const frad = Math.min(8, tipo.w / 4, tipo.h / 4) + 4;
        ctx.save();
        ctx.translate(ef.pos_x, ef.pos_y); ctx.rotate(rotf);
        roundedPath(ctx, -fw2 - expand, -fh2 - expand, tipo.w + expand * 2, tipo.h + expand * 2, frad);
        ctx.strokeStyle = `rgba(13, 99, 234, ${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
    updateLegend();
  };

  const updateLegend = () => {
    const legend = $('legend');
    const counts = {};
    for (const e of Store.get('estantes')) counts[e.tipo] = (counts[e.tipo] || 0) + 1;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const colorPalette = dark ? COLORES : COLORES_LIGHT;
    legend.innerHTML = Object.entries(TIPOS).map(([tipo, def]) => `
      <div class="legend-item">
        <span class="legend-swatch" style="background:${colorPalette[def.color]}"></span>
        <span class="lbl">${def.label}</span>
        <span class="legend-count">${counts[tipo] || 0}</span>
      </div>`).join('');
  };

  const resizeCanvas = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();
  };

  // Llamado al entrar en la pestaña: siempre empieza centrado y ajustado
  const entrar = () => { resetView(); resizeCanvas(); };

  const setStatus = (cls, text) => {
    $('conn').className = 'status ' + cls;
    $('connText').textContent = text;
  };

  // ── Datos ──
  const load = async () => {
    try {
      const nave = Store.get('naveActual') || 1;
      const { data, error } = await Api.estantes.listar(nave);
      if (error) throw error;
      Store.set('estantes', data || []);
      Store.set('online', true);
      setStatus('ok', 'conectado');
    } catch (e) {
      Store.set('online', false);
      setStatus('err', 'sin conexión');
      Store.set('estantes', []);
    }
    draw();
  };

  const guardar = async () => {
    if (!Store.get('online')) return UI.toast({ title: 'Sin conexión', tipo: 'err' });
    try {
      for (const e of Store.get('estantes')) {
        await Api.estantes.actualizar(e.id, { nombre: e.nombre, pos_x: e.pos_x, pos_y: e.pos_y, rotacion: e.rotacion });
      }
      setStatus('ok', 'guardado');
      setTimeout(() => setStatus('ok', 'conectado'), 2000);
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  const agregarElemento = async () => {
    if (!Store.esAdmin) return UI.toast({ msg: 'Solo administradores pueden agregar estantes', tipo: 'err' });
    if (!Store.get('online')) return UI.toast({ title: 'Sin conexión', tipo: 'err' });
    const tipo = Store.get('tipoSeleccionado');
    const def = TIPOS[tipo];
    const nombre = $('nombreInput').value.trim();
    if (!nombre) return UI.toast({ msg: 'Nombre requerido', tipo: 'warn' });
    if (def.letra && !/^[A-Z]$/.test(nombre)) return UI.toast({ msg: 'Solo letras A-Z', tipo: 'warn' });
    try {
      const { WORLD_W, WORLD_H } = PLANO_CONFIG;
      const { data, error } = await Api.estantes.crear({
        nombre, tipo, color: def.color, nave: Store.get('naveActual') || 1,
        pos_x: Math.round(WORLD_W / 2), pos_y: Math.round(WORLD_H / 2),
        ancho: def.w, alto: def.h, rotacion: 0,
      });
      if (error) throw error;
      Store.get('estantes').push(data[0]);
      Store.set('selectedId', data[0].id);
      if (!Store.get('editMode')) {
        Store.set('editMode', true);
        $('editar').classList.add('active');
        canvas.style.cursor = 'grab';
      }
      closeModal();
      updateInfoPanel();
      draw();
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  const eliminarElemento = async (id) => {
    if (!Store.esAdmin) return UI.toast({ msg: 'Solo administradores pueden eliminar estantes', tipo: 'err' });
    if (!Store.get('online')) return UI.toast({ title: 'Sin conexión', tipo: 'err' });
    const ok = await UI.confirm({ title: '¿Eliminar estante?', msg: 'Esta acción no se puede deshacer.', confirmText: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      const { error } = await Api.estantes.eliminar(id);
      if (error) throw error;
      Store.set('estantes', Store.get('estantes').filter((e) => e.id !== id));
      Store.set('selectedId', null);
      updateInfoPanel();
      draw();
    } catch (e) { UI.toast({ title: 'Error', msg: e.message, tipo: 'err' }); }
  };

  // ── Modal agregar ──
  const openModal = () => {
    const selector = $('tipoSelector');
    selector.innerHTML = '';
    for (const [tipo, def] of Object.entries(TIPOS)) {
      const btn = document.createElement('button');
      btn.className = 'tipo-btn' + (tipo === Store.get('tipoSeleccionado') ? ' active' : '');
      btn.innerHTML = `<span class="sw" style="background:${COLORES[def.color]}"></span>${def.label}`;
      btn.addEventListener('click', () => {
        Store.set('tipoSeleccionado', tipo);
        $$('.tipo-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
      selector.appendChild(btn);
    }
    $('nombreInput').value = '';
    $('agregarModal').classList.add('active');
    $('nombreInput').focus();
  };
  const closeModal = () => $('agregarModal').classList.remove('active');

  // ── Panel de info (editar estante seleccionado) ──
  const updateInfoPanel = () => {
    const panel = $('infoPanel');
    const selectedId = Store.get('selectedId');
    if (!selectedId || !Store.get('editMode')) return panel.classList.remove('active');
    const e = Store.get('estantes').find((x) => x.id === selectedId);
    if (!e) return panel.classList.remove('active');
    const def = TIPOS[e.tipo];
    panel.classList.add('active');
    panel.innerHTML = `
      <div class="panel-title">Elemento</div>
      <div class="info-head">
        <div class="info-chip" style="background:${COLORES[def.color]}">${esc(e.nombre)}</div>
        <div class="meta"><b>${def.label}</b><span>ID ${e.id}</span></div>
      </div>
      <div class="field"><label>Nombre</label>
        <input type="text" id="editNombre" value="${esc(e.nombre)}" maxlength="${def.letra ? 1 : 12}"></div>
      <div class="row">
        <div class="field"><label>Pos</label><div class="readout">${Math.round(e.pos_x)}, ${Math.round(e.pos_y)}</div></div>
        <div class="field"><label>Rot</label><div class="readout">${e.rotacion}°</div></div>
      </div>
      <div class="row mt">
        <button id="rotarBtn">Rotar</button>
        <button id="eliminarBtn" class="danger">Eliminar</button>
      </div>
      <button id="actualizarBtn" class="btn-primary mt">Actualizar</button>`;
    $('editNombre').addEventListener('input', (ev) => { e.nombre = ev.target.value.toUpperCase(); ev.target.value = e.nombre; draw(); });
    $('rotarBtn').addEventListener('click', () => { e.rotacion = e.rotacion === 0 ? 90 : 0; updateInfoPanel(); draw(); });
    $('eliminarBtn').addEventListener('click', () => eliminarElemento(e.id));
    $('actualizarBtn').addEventListener('click', guardar);
  };

  // ── Permisos: ocultar herramientas para no-admin ──
  const aplicarPermisos = () => {
    if (Store.esAdmin) return;
    ['agregar', 'editar', 'guardar'].forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
    const aviso = document.createElement('div');
    aviso.className = 'plano-locked';
    aviso.textContent = '🔒 Solo administradores pueden editar el plano';
    $('infoPanel').insertAdjacentElement('afterend', aviso);
  };

  // ── Eventos del canvas ──
  const bindCanvas = () => {
    let panStart = null;   // { x, y, panX, panY }
    let panMoved = false;

    // Cursor inicial
    canvas.style.cursor = 'grab';

    // Zoom centrado en cursor (mouse wheel)
    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale = clamp(userScale * factor, 0.5, 6);
      const r = newScale / userScale;
      const cx = canvas.width / 2, cy = canvas.height / 2;
      userPanX = userPanX * r + (mx - cx) * (1 - r);
      userPanY = userPanY * r + (my - cy) * (1 - r);
      userScale = newScale;
      draw();
    }, { passive: false });

    // Doble clic → resetear vista (igual que doble-tap en touch)
    canvas.addEventListener('dblclick', () => { resetView(); draw(); });

    canvas.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      if (Store.get('editMode') && Store.esAdmin) {
        const rect = canvas.getBoundingClientRect();
        const w = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
        const draggedId = hitTest(w.x, w.y);
        Store.set('draggedId', draggedId);
        if (draggedId) { Store.set('selectedId', draggedId); canvas.style.cursor = 'grabbing'; }
        updateInfoPanel(); draw();
      } else {
        panStart = { x: ev.clientX, y: ev.clientY, panX: userPanX, panY: userPanY };
        panMoved = false;
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('mousemove', (ev) => {
      const rect = canvas.getBoundingClientRect();
      const w = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);

      // Drag estante (modo edición)
      const draggedId = Store.get('draggedId');
      if (draggedId && Store.get('editMode')) {
        const e = Store.get('estantes').find((x) => x.id === draggedId);
        if (e) {
          const { GRID } = PLANO_CONFIG;
          const tipo = TIPOS[e.tipo];
          const ew = e.rotacion === 90 ? tipo.h : tipo.w;
          const eh = e.rotacion === 90 ? tipo.w : tipo.h;
          e.pos_x = clamp(Math.round(w.x / GRID) * GRID, PLANO.wall.x + ew / 2, PLANO.wall.x + PLANO.wall.w - ew / 2);
          e.pos_y = clamp(Math.round(w.y / GRID) * GRID, PLANO.wall.y + eh / 2, PLANO.wall.y + PLANO.wall.h - eh / 2);
          updateInfoPanel(); draw();
        }
        return;
      }

      // Pan del mapa (modo vista)
      if (panStart) {
        const dx = ev.clientX - panStart.x;
        const dy = ev.clientY - panStart.y;
        if (!panMoved && Math.abs(dx) + Math.abs(dy) > 3) panMoved = true;
        userPanX = panStart.panX + dx;
        userPanY = panStart.panY + dy;
          draw();
        return;
      }

      // Hover
      const id = hitTest(w.x, w.y);
      if (id !== Store.get('hoveredId')) { Store.set('hoveredId', id); kickAnim(); }
      if (!Store.get('editMode')) canvas.style.cursor = id ? 'pointer' : 'grab';
    });

    canvas.addEventListener('mouseup', () => {
      Store.set('draggedId', null);
      panStart = null;
      canvas.style.cursor = Store.get('editMode') ? 'grab' : 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
      panStart = null;
      if (Store.get('hoveredId') !== null) { Store.set('hoveredId', null); kickAnim(); }
    });

    // ─────────── TOUCH (celular): pinch para zoom, arrastrar para mover ───────────
    let touchMode = null;          // 'pan' | 'pinch' | 'drag'
    let lastTouch = null;          // {x, y} para pan
    let pinchStart = null;         // {dist, scale} para zoom
    let touchMoved = false;        // distinguir tap de arrastre

    const touchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const touchMid = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 });

    canvas.addEventListener('touchstart', (ev) => {
      touchMoved = false;
      if (ev.touches.length === 2) {
        // Pinch: arranca zoom
        ev.preventDefault();
        touchMode = 'pinch';
        pinchStart = { dist: touchDist(ev.touches[0], ev.touches[1]), scale: userScale };
      } else if (ev.touches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const t = ev.touches[0];
        // En modo edición, si tocó un estante → arrastrarlo
        if (Store.get('editMode') && Store.esAdmin) {
          const w = toWorld(t.clientX - rect.left, t.clientY - rect.top);
          const id = hitTest(w.x, w.y);
          if (id) {
            touchMode = 'drag';
            Store.set('draggedId', id); Store.set('selectedId', id);
            updateInfoPanel(); draw();
            return;
          }
        }
        // Si no, desplazar el mapa (pan)
        touchMode = 'pan';
        lastTouch = { x: t.clientX, y: t.clientY };
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (ev) => {
      if (touchMode === 'pinch' && ev.touches.length === 2) {
        ev.preventDefault();
        const d = touchDist(ev.touches[0], ev.touches[1]);
        const factor = d / pinchStart.dist;
        userScale = clamp(pinchStart.scale * factor, 0.5, 6);
          touchMoved = true;
        draw();
      } else if (touchMode === 'pan' && ev.touches.length === 1) {
        ev.preventDefault();
        const t = ev.touches[0];
        const dx = t.clientX - lastTouch.x, dy = t.clientY - lastTouch.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) touchMoved = true;
        userPanX += dx; userPanY += dy;
          lastTouch = { x: t.clientX, y: t.clientY };
        draw();
      } else if (touchMode === 'drag' && ev.touches.length === 1) {
        ev.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const t = ev.touches[0];
        const w = toWorld(t.clientX - rect.left, t.clientY - rect.top);
        const e = Store.get('estantes').find((x) => x.id === Store.get('draggedId'));
        if (e) {
          const { GRID } = PLANO_CONFIG;
          const tipo = TIPOS[e.tipo];
          const ew = e.rotacion === 90 ? tipo.h : tipo.w;
          const eh = e.rotacion === 90 ? tipo.w : tipo.h;
          e.pos_x = clamp(Math.round(w.x / GRID) * GRID, PLANO.wall.x + ew / 2, PLANO.wall.x + PLANO.wall.w - ew / 2);
          e.pos_y = clamp(Math.round(w.y / GRID) * GRID, PLANO.wall.y + eh / 2, PLANO.wall.y + PLANO.wall.h - eh / 2);
          touchMoved = true; updateInfoPanel(); draw();
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (ev) => {
      // Tap simple (sin moverse) fuera de edición → seleccionar estante
      if (touchMode === 'pan' && !touchMoved && !Store.get('editMode') && lastTouch) {
        const rect = canvas.getBoundingClientRect();
        const w = toWorld(lastTouch.x - rect.left, lastTouch.y - rect.top);
        const id = hitTest(w.x, w.y);
        if (id) { Store.set('selectedId', id); updateInfoPanel(); draw(); Productos.abrir(id); }
      }
      if (touchMode === 'drag') Store.set('draggedId', null);
      if (ev.touches.length === 0) { touchMode = null; lastTouch = null; pinchStart = null; }
    });

    // Doble tap → reset del zoom/posición
    let lastTap = 0;
    canvas.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTap < 300) { resetView(); draw(); }
      lastTap = now;
    });

    canvas.addEventListener('click', (ev) => {
      if (panMoved) { panMoved = false; return; }
      if (Store.get('editMode')) return;
      const rect = canvas.getBoundingClientRect();
      const w = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
      const id = hitTest(w.x, w.y);
      if (id) Productos.abrir(id);
    });
  };

  const toggleEdit = () => {
    if (!Store.esAdmin) return UI.toast({ msg: 'Solo administradores pueden editar el plano', tipo: 'err' });
    Store.set('editMode', !Store.get('editMode'));
    $('editar').classList.toggle('active');
    canvas.style.cursor = 'grab';
    Store.set('selectedId', null);
    updateInfoPanel(); draw();
  };

  // ── Buscador de productos ──
  let searchCache = null;
  let searchFocusClear = null;

  const cargarCacheSearch = async () => {
    if (searchCache) return;
    try {
      const nave = Store.get('naveActual') || 1;
      const { data } = await Api.productos.inventario(nave);
      searchCache = (data || []).map((p) => ({
        id: p.id,
        nombre: p.nombre || '',
        categoria: p.categoria || '',
        estante_id: p.estante_id,
        estante_nombre: p.estantes?.nombre || '—',
      }));
    } catch { searchCache = []; }
  };

  const navegarAEstante = (estanteId) => {
    const e = Store.get('estantes').find((x) => x.id === estanteId);
    if (!e) return;
    const cw = canvas.width, ch = canvas.height;
    const { WORLD_W, WORLD_H, PAD } = PLANO_CONFIG;
    const baseScale = Math.min((cw - PAD * 2) / WORLD_W, (ch - PAD * 2) / WORLD_H);
    const baseOX = (cw - WORLD_W * baseScale) / 2;
    const baseOY = (ch - WORLD_H * baseScale) / 2;
    const cx = cw / 2, cy = ch / 2;
    const zoom = 2.4;
    userScale = zoom;
    userPanX = zoom * ((cx - baseOX) - e.pos_x * baseScale);
    userPanY = zoom * ((cy - baseOY) - e.pos_y * baseScale);
    Store.set('searchFocusId', estanteId);
    kickAnim();
    clearTimeout(searchFocusClear);
    searchFocusClear = setTimeout(() => {
      Store.set('searchFocusId', null);
      resetView();
      draw();
    }, 3200);
  };

  const initSearch = () => {
    const input = $('mapaSearchInput');
    const results = $('mapaSearchResults');
    if (!input) return;

    const hide = () => { results.innerHTML = ''; };

    input.addEventListener('focus', cargarCacheSearch);

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { hide(); return; }

      // Buscar estantes (ya están en memoria)
      const estanteMatches = Store.get('estantes')
        .filter((e) => e.nombre.toLowerCase().includes(q) ||
                       (TIPOS[e.tipo]?.label || '').toLowerCase().includes(q))
        .slice(0, 4);

      // Buscar productos (caché async)
      const prodMatches = (searchCache || [])
        .filter((p) => p.nombre.toLowerCase().includes(q) ||
                       p.categoria.toLowerCase().includes(q) ||
                       p.estante_nombre.toLowerCase().includes(q))
        .slice(0, 6);

      if (!estanteMatches.length && !prodMatches.length) {
        results.innerHTML = '<li class="search-no-results">Sin resultados para "' + esc(input.value) + '"</li>';
        return;
      }

      let html = '';
      if (estanteMatches.length) {
        html += '<li class="search-section-label">Estantes</li>';
        html += estanteMatches.map((e) => `
          <li class="search-result-item" data-estante="${e.id}">
            <span class="sri-nombre">${esc(e.nombre)}</span>
            <span class="sri-meta">
              <span class="sri-type estante">Estante</span>
              <span class="sri-sep">·</span>
              <span class="sri-cat">${esc(TIPOS[e.tipo]?.label || e.tipo)}</span>
            </span>
          </li>`).join('');
      }
      if (prodMatches.length) {
        html += '<li class="search-section-label">Productos</li>';
        html += prodMatches.map((p) => `
          <li class="search-result-item" data-estante="${p.estante_id}">
            <span class="sri-nombre">${esc(p.nombre)}</span>
            <span class="sri-meta">
              <span class="sri-cat">${esc(p.categoria || 'Sin categoría')}</span>
              <span class="sri-sep">·</span>
              <span class="sri-estante">Estante ${esc(p.estante_nombre)}</span>
            </span>
          </li>`).join('');
      }
      results.innerHTML = html;

      $$('.search-result-item', results).forEach((item) => {
        item.addEventListener('click', () => {
          const estanteId = parseInt(item.dataset.estante, 10);
          input.value = '';
          hide();
          input.blur();
          navegarAEstante(estanteId);
          setTimeout(() => Productos.abrir(estanteId), 350);
        });
      });
    });

    document.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'k') {
        if (!$('view-mapa').classList.contains('active')) return;
        ev.preventDefault();
        input.focus();
        input.select();
      }
      if (ev.key === 'Escape') { hide(); input.blur(); }
    });

    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('#mapaSearch')) hide();
    });
  };

  // ── Init ──
  const init = () => {
    canvas = $('canvas');
    ctx = canvas.getContext('2d');
    bindCanvas();
    $('agregar').addEventListener('click', openModal);
    $('editar').addEventListener('click', toggleEdit);
    $('guardar').addEventListener('click', guardar);
    $('cancelBtn').addEventListener('click', closeModal);
    $('confirmBtn').addEventListener('click', agregarElemento);
    aplicarPermisos();
    initSearch();
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    load();
  };

  return { init, resizeCanvas, entrar, draw };
})();