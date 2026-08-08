import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages serves the site under /<repo>/ — the base must match or every
// asset and public/geo fetch 404s. Overridable for a future custom domain.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/meucadastrorural/',
  plugins: [vue()],
})
