import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Served at the root of the custom domain meucadastrorural.com.br.
// (Under the default <owner>.github.io/<repo>/ URL the base would need to
// be '/meucadastrorural/' — override with VITE_BASE if the domain is removed.)
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue()],
})
