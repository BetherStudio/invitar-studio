# InvitAR Studio — Deploy en Vercel + Supabase

## Paso 1: Supabase (2 minutos)

1. Ir a https://supabase.com → New project
2. Copiar la **Project URL** y la **anon public key** (en Settings > API)
3. Ir a SQL Editor y pegar el contenido de `supabase-setup.sql` → Run

## Paso 2: Subir a GitHub

```bash
cd invitar-web
git init
git add .
git commit -m "InvitAR Studio"
git remote add origin https://github.com/TU_USUARIO/invitar-studio.git
git push -u origin main
```

## Paso 3: Vercel (3 minutos)

1. Ir a https://vercel.com → New Project → importar el repo
2. En **Environment Variables** agregar:
   - `VITE_SUPABASE_URL` = tu Project URL
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
3. Deploy

## Uso

1. Abrí la URL que te dio Vercel
2. Arrastrá cualquier HTML de invitación al área de carga
3. El editor detecta automáticamente TODOS los campos
4. Editá lo que necesitás en las solapas
5. Aplicar cambios → Exportar HTML
