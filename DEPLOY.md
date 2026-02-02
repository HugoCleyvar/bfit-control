# Guía de Despliegue - BFIT Control

Esta aplicación está construida con **Vite + React + TypeScript**.
La forma más fácil y robusta de desplegarla es usando **Vercel** o **Netlify**.

## Requisitos Previos
1.  Tener una cuenta en [Vercel](https://vercel.com) o [Netlify](https://netlify.com).
2.  Tener el proyecto subido a GitHub (recomendado).

## Opción 1: Despliegue Automático con Vercel (Recomendado)

1.  Sube tu código a un repositorio de GitHub.
2.  Entra a Vercel y haz clic en "Add New Project".
3.  Importa tu repositorio de GitHub.
4.  En "Framework Preset", Vercel detectará automáticamente **Vite**.
5.  **Variables de Entorno**:
    Es CRÍTICO que agregues las mismas variables que tienes en tu `.env`:
    *   `VITE_SUPABASE_URL`
    *   `VITE_SUPABASE_ANON_KEY`
    *(Copia estos valores de tu archivo local `.env` o de tu dashboard de Supabase)*.
6.  Haz clic en **Deploy**.

## Opción 2: Despliegue Manual (Drag & Drop) en Netlify

1.  Ejecuta el comando de construcción en tu terminal local:
    ```bash
    npm run build
    ```
2.  Esto generará una carpeta llamada `dist/`.
3.  Ve a [Nelify Drop](https://app.netlify.com/drop).
4.  Arrastra la carpeta `dist` completa al área de subida.
5.  Una vez subido, ve a "Site Settings" -> "Build & Deploy" -> "Environment".
6.  Agrega las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Configuración Especial (SPA Routing)
Si usas Netlify y tienes problemas al recargar páginas (Error 404), necesitas agregar un archivo `_redirects` en la carpeta `public/` con este contenido:
```
/*  /index.html  200
```
*(Ya hemos verificado que Vite maneja esto, pero es bueno tenerlo en cuenta si usas un servidor estático genérico)*.

## Verificación Post-Despliegue
1.  Abre la URL que te provee Vercel/Netlify.
2.  Intenta iniciar sesión.
3.  Si falla, verifica la consola del navegador (F12) para errores de conexión a Supabase (usualmente es por falta de variables de entorno).
