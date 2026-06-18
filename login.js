// ============================================================
// HDS Warehouse · login.js
// Pantalla de acceso. Usa Supabase Auth (sin hash casero).
// Carga: constants → utils → ui → api → login (en ese orden).
// ============================================================

(() => {
  'use strict';

  // ─── Tabs login / signup ───
  const tabs = $$('.tab-btn');
  const onTab = (btn) => {
    tabs.forEach((b) => b.classList.remove('active'));
    $$('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    $(`${btn.dataset.tab}Tab`).classList.add('active');
  };
  tabs.forEach((btn) => btn.addEventListener('click', () => onTab(btn)));

  // Navegación por teclado entre tabs (accesibilidad)
  tabs.forEach((btn, i) => {
    btn.setAttribute('role', 'tab');
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : (i - 1 + tabs.length) % tabs.length;
        tabs[next].focus();
        onTab(tabs[next]);
      }
    });
  });

  // ─── Login ───
  const loginForm = $('loginForm');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;
    const msg = $('loginMsg');
    const btn = $('loginBtn');

    UI.setButtonLoading(btn, true, 'Verificando…');
    UI.showMessage(msg, 'Verificando credenciales…', 'ok');

    try {
      const { data, error } = await Api.auth.signIn(email, password);
      if (error || !data?.user) throw new Error('Email o contraseña incorrectos');

      const { data: perfil } = await Api.perfiles.miPerfil(data.user.id);
      if (!perfil) throw new Error('No se encontró el perfil del usuario');

      if (perfil.estado === 'pendiente') {
        await Api.auth.signOut();
        UI.showMessage(msg, '⏳ Tu cuenta está pendiente de aprobación', 'warn');
        UI.setButtonLoading(btn, false);
        return;
      }
      if (perfil.estado !== 'activo') {
        await Api.auth.signOut();
        UI.showMessage(msg, 'Tu cuenta está inactiva', 'err');
        UI.setButtonLoading(btn, false);
        return;
      }

      await Api.perfiles.marcarLogin(perfil.id);
      UI.showMessage(msg, '✓ Bienvenido!', 'ok');
      setTimeout(() => location.replace(ROUTES.app), 600);
    } catch (err) {
      UI.showMessage(msg, err.message, 'err');
      UI.setButtonLoading(btn, false);
    }
  });

  // ─── Signup ───
  const signupForm = $('signupForm');
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('signupNombre').value.trim();
    const email = $('signupEmail').value.trim();
    const password = $('signupPassword').value;
    const confirm = $('signupPasswordConfirm').value;
    const msg = $('signupMsg');
    const btn = $('signupBtn');

    if (password !== confirm) return UI.showMessage(msg, 'Las contraseñas no coinciden', 'err');
    if (password.length < 6) return UI.showMessage(msg, 'La contraseña debe tener al menos 6 caracteres', 'err');

    UI.setButtonLoading(btn, true, 'Creando…');
    UI.showMessage(msg, 'Creando cuenta…', 'ok');

    try {
      const { error } = await Api.auth.signUp(email, password, nombre);
      if (error) throw new Error(error.message || 'No se pudo crear la cuenta');

      // Cerramos la sesión que Supabase abre al registrarse: la cuenta
      // queda 'pendiente' y debe aprobarla un admin antes de entrar.
      await Api.auth.signOut();

      UI.showMessage(msg, '✓ Cuenta creada! Espera la aprobación del administrador.', 'ok');
      setTimeout(() => {
        signupForm.reset();
        onTab(tabs[0]);
        UI.setButtonLoading(btn, false);
      }, 1600);
    } catch (err) {
      UI.showMessage(msg, err.message, 'err');
      UI.setButtonLoading(btn, false);
    }
  });

  // ─── Sesión activa: ofrecer ir al sistema ───
  (async () => {
    const user = await Auth.cargarSesion();
    if (!user) return;
    const status = $('statusSection');
    if (!status) return;
    status.className = 'status-section logged-in';
    status.innerHTML = `
      <div class="user-info">
        Sesión activa: <strong>${esc(user.nombre)}</strong>
        <div><span class="role-badge">${esc(ROL_LABEL[user.rol] || user.rol)}</span></div>
      </div>
      <button class="btn" id="goAppBtn" style="margin-top:12px;">Ir al sistema →</button>
      <button class="btn ghost" id="logoutBtn" style="margin-top:8px;">Cerrar sesión</button>`;
    $('goAppBtn').addEventListener('click', () => location.replace(ROUTES.app));
    $('logoutBtn').addEventListener('click', async () => { await Api.auth.signOut(); location.reload(); });
  })();
})();
