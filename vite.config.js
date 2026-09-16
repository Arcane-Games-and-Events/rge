import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { purgeCss } from 'vite-plugin-tailwind-purgecss';

export default defineConfig({
	plugins: [sveltekit(), purgeCss()],
	build: {
		// Keep flag SVGs as separate files. Inlined as data URIs they added 400KB to
		// the stylesheet, which every view would download to show at most one flag;
		// as files the browser fetches only the flags actually in use.
		assetsInlineLimit: (filePath) => (filePath.includes('flag-icons') ? false : undefined)
	}
});
