// ============================================================
// HDS Warehouse · core/constants.js
// Constantes centralizadas: configuración, roles, permisos,
// dimensiones del plano, tipos de estante, categorías, columnas.
// (Single source of truth — todo lo "mágico" vive acá.)
// ============================================================

// ─── Supabase ───
const SUPABASE_URL = 'https://fhzgeiitkypgdreblixg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoemdlaWl0a3lwZ2RyZWJsaXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDAzMDcsImV4cCI6MjA5NjExNjMwN30.LCMWIqw7ovwKuI10DbdZNxiFdjQ-N_aERmT-CoePys4';

// ─── Rutas ───
const ROUTES = Object.freeze({
  login: 'index.html',
  app: 'mapa.html',
});

// ─── Roles ───
const ROLES = Object.freeze({
  OPERARIO: 'operario',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
});

const ROL_LABEL = Object.freeze({
  admin: 'Administrador',
  supervisor: 'Supervisor',
  operario: 'Operario',
  pendiente: 'Pendiente',
});

// ─── Permisos de navegación por vista ───
const PERMISOS_VISTA = Object.freeze({
  mapa: [ROLES.OPERARIO, ROLES.SUPERVISOR, ROLES.ADMIN],
  stock: [ROLES.OPERARIO, ROLES.SUPERVISOR, ROLES.ADMIN],
  pedidos: [ROLES.OPERARIO, ROLES.SUPERVISOR, ROLES.ADMIN],
  dashboard: [ROLES.SUPERVISOR, ROLES.ADMIN],
  movimientos: [ROLES.SUPERVISOR, ROLES.ADMIN],
  usuarios: [ROLES.ADMIN],
  producto: [ROLES.OPERARIO, ROLES.SUPERVISOR, ROLES.ADMIN],
});

// ─── Columnas explícitas por tabla (evita select '*') ───
const COLS = Object.freeze({
  estantes: 'id,nombre,tipo,color,pos_x,pos_y,ancho,alto,rotacion',
  productos: 'id,estante_id,nombre,categoria,cantidad,ubicacion,posicion,descripcion,codigo',
  productosConEstante: 'id,estante_id,nombre,categoria,cantidad,ubicacion,posicion,descripcion,codigo,estantes(nombre,tipo,color)',
  movimientos: 'id,producto_id,producto_nombre,estante_nombre,usuario_nombre,accion,detalle,cantidad_anterior,cantidad_nueva,fecha',
  pedidos: 'id,usuario_nombre,producto,cantidad,motivo,estado,fecha,resuelto_por,fecha_resolucion',
  perfiles: 'id,nombre,email,rol,estado,fecha_creacion,fecha_aprobacion',
});

// ─── Plano (coordenadas del mundo, fijas) ───
const PLANO_CONFIG = Object.freeze({
  WORLD_W: 940,
  WORLD_H: 600,
  PAD: 40,
  GRID: 10,
});

const PLANO = Object.freeze({
  wall: { x: 84, y: 60, w: 776, h: 478 },
  door: { x1: 620, x2: 690, y: 60 },
  room: { x: 84, y: 386, w: 150, h: 152 },
  camion: { x: 582, y: 344, w: 166, h: 92 },
});

// ─── Tipos de estante ───
const TIPOS = Object.freeze({
  grande:        { label: 'Estante grande', color: 'amarillo', w: 47, h: 47, letra: true },
  chico:         { label: 'Estante chico',  color: 'morado',   w: 38, h: 24, letra: true },
  estante_largo: { label: 'Estante largo',  color: 'verde',    w: 20, h: 78, letra: true },
  armario:       { label: 'Armario',        color: 'azul',     w: 26, h: 28, letra: false },
  mesa:          { label: 'Mesa de trabajo',color: 'rosa',     w: 30, h: 30, letra: false },
});

const COLORES = Object.freeze({
  amarillo: '#ffd700', morado: '#b89fff', verde: '#4ade80',
  azul: '#60a5fa', rosa: '#fb923c',
});

// ─── Categorías de producto ───
const CAT_COLORS = Object.freeze({
  'Herrajes': '#fbbf24', 'Eléctrico': '#60a5fa', 'Electrónica': '#4dd0e1',
  'Herramientas': '#f87171', 'Consumibles': '#4ade80', 'Mecánica': '#b89fff',
  'Metal': '#94a3b8', 'Materiales': '#fb923c',
});

const CATEGORIAS = Object.freeze(Object.keys(CAT_COLORS));
const POSICIONES = Object.freeze(['izquierda', 'centro', 'derecha']);

// ─── Acciones de movimiento ───
const MOV_ACCION = Object.freeze({
  CREAR: 'crear', EDITAR: 'editar', ELIMINAR: 'eliminar',
  STOCK_MAS: 'stock+', STOCK_MENOS: 'stock-',
});

// ─── Estados de pedido ───
const PEDIDO_ESTADO = Object.freeze({
  PENDIENTE: 'pendiente', APROBADO: 'aprobado',
  RECHAZADO: 'rechazado', RECIBIDO: 'recibido',
});

// ─── QR / códigos de producto ───
// URL pública de la app online. El QR de cada producto apunta a:
//   {QR_BASE_URL}?producto={ID de Supabase}
// ⚠️ Reemplazá esto por la URL real donde publiques la app (Vercel,
//    Netlify, tu dominio, etc.). Mientras tanto es un placeholder.
const QR_BASE_URL = 'https://TU-APP-ONLINE.com/mapa.html';

// Servicio que genera la imagen del QR a partir de una URL/texto.
const QR_API = 'https://api.qrserver.com/v1/create-qr-code/';

// Genera un código corto tipo PROD-a8X1qZ (estético, visible al usuario).
function generarCodigoProducto(longitud = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < longitud; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'PROD-' + out;
}

// Construye el enlace al que apunta el QR de un producto.
function urlProducto(id) {
  return QR_BASE_URL + '?producto=' + encodeURIComponent(id);
}

// Construye la URL de la imagen del QR para un producto.
function urlQR(id, size = 150) {
  return QR_API + '?size=' + size + 'x' + size + '&data=' + encodeURIComponent(urlProducto(id));
}