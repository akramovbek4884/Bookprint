import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo.png', 'vite.svg'],
            manifest: {
                name: 'Bookprint — POS Tizimi',
                short_name: 'Bookprint',
                description: 'Bookprint uchun zamonaviy savdo nuqtasi tizimi.',
                theme_color: '#0a0e1a',
                background_color: '#0a0e1a',
                display: 'standalone',
                icons: [
                    {
                        src: 'logo.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'logo.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            devOptions: {
                enabled: true
            },
            workbox: {
                runtimeCaching: [
                    {
                        urlPattern: /\/api\/.*/,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: { maxEntries: 50, maxAgeSeconds: 300 }
                        }
                    },
                    {
                        urlPattern: /\.(js|css|png|jpg|svg|woff2?)$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'static-cache',
                            expiration: { maxEntries: 100, maxAgeSeconds: 86400 }
                        }
                    }
                ]
            }
        })
    ]
});
