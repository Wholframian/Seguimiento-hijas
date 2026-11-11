import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa: funciona igual en Vercel, Netlify o GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
})
