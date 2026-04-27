import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// https://v2.tauri.app/start/frontend/sveltekit/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

	// Vite options tailored for Tauri development
	clearScreen: false,
	server: {
		host: host || false,
		port: 1420,
		strictPort: true,
		hmr: host
			? {
					protocol: 'ws',
					host: host,
					port: 1421
				}
			: undefined,
		watch: {
			ignored: ['**/src-tauri/**']
		}
	},
	// Pre-bundle these so Vite doesn't discover & reload mid-session
	optimizeDeps: {
		include: [
			'@tauri-apps/api/core',
			'@tauri-apps/plugin-opener',
			'@lucide/svelte',
			'bits-ui',
			'tailwind-merge',
			'tailwind-variants'
		]
	}
});
