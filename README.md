cat > README.md << 'EOF'
# HDS Warehouse Control — Frontend

Sistema de gestión de almacén con mapa interactivo, inventario y gestión de pedidos.

**Stack**: HTML, CSS, JavaScript vanilla, Supabase

**Deploy**: https://hds-warehouse-frontend.vercel.app

## Instalación local

Simplemente abre `index.html` en el navegador (o en Tauri).

## Variables de entorno

En `js/core/constants.js`:
- `SUPABASE_URL`: Tu proyecto Supabase
- `SUPABASE_ANON_KEY`: Anon key de Supabase

## Deploy a Vercel

```bash
git push origin main
```

Vercel redeploya automáticamente.
EOF
