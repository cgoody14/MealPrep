const CACHE = 'rouxlo-v2'
const PRECACHE = ['/', '/index.html']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Skip non-GET and cross-origin requests (Supabase, Groq, etc.)
  if (e.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  const isAsset = /\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?)(\?|$)/.test(url.pathname)

  if (isAsset) {
    // Cache-first for static assets (Vite adds content hashes so they're immutable)
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
      })
    )
  } else {
    // Network-first for HTML — always get the latest shell, fall back to cache
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
        .catch(() => caches.match(e.request))
    )
  }
})
