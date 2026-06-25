// ============================================================
// HDS Warehouse · core/auth.js
// Autenticación con Supabase Auth (sin hash casero).
// La sesión y el rol provienen del servidor; el frontend no puede
// elevar privilegios cambiando datos locales (lo impide RLS).
// ============================================================

const Auth = {
  // Devuelve el perfil del usuario logueado, o null si no hay sesión
  // válida / activa. Combina la sesión de Supabase Auth con su perfil.
  async cargarSesion() {
    const { data: { session } } = await Api.auth.getSession();
    if (!session) return null;

    const { data: perfil, error } = await Api.perfiles.miPerfil(session.user.id);
    if (error || !perfil) return null;

    return {
      id: perfil.id,
      email: perfil.email || session.user.email,
      nombre: perfil.nombre,
      rol: perfil.rol,
      estado: perfil.estado,
    };
  },

  // Protege una página: si no hay sesión activa, redirige al login.
  // Hidrata el Store con el usuario. Devuelve el usuario o null.
  async requireSession() {
    const user = await Auth.cargarSesion();
    if (!user || user.estado !== 'activo') {
      location.replace(ROUTES.login);
      return null;
    }
    Store.set('user', user);
    return user;
  },

  async logout() {
    await Api.auth.signOut();
    location.replace(ROUTES.login);
  },
};
