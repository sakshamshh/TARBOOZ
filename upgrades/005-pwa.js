const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 5 — PWA (installable on iOS)',
  apply: async () => {

    // 1. Create manifest.json
    fs.writeFileSync(path.join(ROOT, 'public/manifest.json'), JSON.stringify({
      name: 'Tarbooz',
      short_name: 'Tarbooz',
      description: 'Your Personal AI Assistant',
      start_url: '/',
      display: 'standalone',
      background_color: '#f8f7f4',
      theme_color: '#181714',
      orientation: 'portrait',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }, null, 2));

    // 2. Create SVG icon and convert to PNG-like data URI placeholder
    // We'll use a simple canvas-generated icon via an HTML file
    // For now create an SVG icon that browsers can use
    fs.writeFileSync(path.join(ROOT, 'public/icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#181714"/>
  <text x="256" y="320" font-family="Georgia,serif" font-size="280" font-weight="bold" fill="#ffffff" text-anchor="middle">T</text>
</svg>`);

    // 3. Create service worker
    fs.writeFileSync(path.join(ROOT, 'public/sw.js'), `const CACHE = 'tarbooz-v1';
const OFFLINE_URLS = ['/', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for API calls
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'You are offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }
  // Cache first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
`);

    // 4. Patch index.html — add PWA meta tags and SW registration
    const htmlPath = path.join(ROOT, 'public/index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    if (!html.includes('manifest.json')) {
      // Add meta tags to <head>
      html = html.replace(
        '<link href="https://fonts.googleapis.com',
        `<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tarbooz">
<meta name="theme-color" content="#181714">
<link rel="apple-touch-icon" href="/icon.svg">
<link href="https://fonts.googleapis.com`
      );

      // Register service worker before closing </body>
      html = html.replace(
        '</body>',
        `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('🍉 SW registered'))
      .catch(err => console.log('SW error:', err));
  });
}
</script>
</body>`
      );

      fs.writeFileSync(htmlPath, html);
    }

    console.log('  → manifest.json created');
    console.log('  → service worker created');
    console.log('  → icon.svg created');
    console.log('  → index.html patched with PWA meta tags');
  }
};
