import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
// Precache the exact build, including local fonts, so the installed app works offline.
function offlinePlugin() {
  return {
    name: 'gym-hawk-offline',
    closeBundle() {
      const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
      const files = walk('dist').filter(p => !p.endsWith('_headers') && !p.endsWith('sw.js'));
      const fingerprint = createHash('sha256'); files.forEach(f => fingerprint.update(readFileSync(f)));
      const version = fingerprint.digest('hex').slice(0, 12);
      const urls = files.map(f => '/' + f.replace(/^dist\//, ''));
      writeFileSync('dist/sw.js', `const CACHE = 'gym-hawk-${version}';
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gym-hawk-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html', { ignoreVary: true }))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreVary: true })) || fetch(event.request)));
});
`);
    },
  };
}
export default defineConfig({ plugins: [react(), offlinePlugin()] });
