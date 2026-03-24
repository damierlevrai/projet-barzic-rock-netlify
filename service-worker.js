/**
 * 🎸 BARZIK SERVICE WORKER - PWA Offline-First
 * Version: 1.0.0
 */

const CACHE_VERSION = 'barzik-v1.0.0';
const CACHE_NAME = `${CACHE_VERSION}-static`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;
const CACHE_IMAGES = `${CACHE_VERSION}-images`;

// URL Supabase
const SUPABASE_URL = 'https://ffsyotnbypbiuikgxijs.supabase.co';

// Fichiers à mettre en cache immédiatement lors de l'installation
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  
  
];

// Patterns pour fichiers dynamiques (générés par Vite avec hash)
const DYNAMIC_PATTERNS = {
  js: /\/assets\/.*\.js$/,
  css: /\/assets\/.*\.css$/,
  fonts: /\/assets\/.*\.(woff2?|ttf|eot)$/
};

// 🔧 INSTALLATION
self.addEventListener('install', (event) => {
  console.log('[SW] Installation v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Mise en cache des fichiers statiques');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        console.log('[SW] Installation terminée');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Erreur installation:', error);
      })
  );
});

// ⚡ ACTIVATION
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.startsWith(CACHE_VERSION)) {
              console.log('[SW] Suppression ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation terminée');
        return self.clients.claim();
      })
  );
});

// 📥 FETCH - Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }
  
  // Ignorer chrome-extension et autres protocoles
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // IGNORER VITE EN DÉVELOPPEMENT
  if (url.pathname.startsWith('/@vite/') || 
      url.pathname.startsWith('/node_modules/') ||
      url.search.includes('?t=') ||
      url.pathname.includes('.vite')) {
    return; // Laisser passer sans interception
  }
  
  // STRATÉGIE 1: Cache First pour fichiers statiques
  if (shouldCacheFirst(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // STRATÉGIE 2: Network First pour API Supabase (pas de cache en dev)
  if (isSupabaseAPI(url)) {
    event.respondWith(fetch(request)); // Direct sans cache
    return;
  }
  
  // STRATÉGIE 3: Cache pour images Supabase Storage
  if (isSupabaseStorage(url)) {
    event.respondWith(cacheFirst(request, CACHE_IMAGES));
    return;
  }
  
  // STRATÉGIE 4: Network First pour tout le reste
  event.respondWith(networkFirst(request, CACHE_RUNTIME));
});

// 🎯 STRATÉGIE: Cache First (pour fichiers statiques)
async function cacheFirst(request, cacheName = CACHE_NAME) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Erreur cacheFirst:', error);
    
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    return new Response('Offline - Fichier non disponible', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// 🌐 STRATÉGIE: Network First (pour API)
async function networkFirst(request, cacheName = CACHE_RUNTIME) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'Pas de connexion réseau' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 🔍 Helpers: Détection types de requêtes

function shouldCacheFirst(url) {
  // Fichiers locaux avec hash Vite
  if (DYNAMIC_PATTERNS.js.test(url.pathname) || 
      DYNAMIC_PATTERNS.css.test(url.pathname) ||
      DYNAMIC_PATTERNS.fonts.test(url.pathname)) {
    return true;
  }
  
  // Fichiers statiques
  if (STATIC_CACHE.some(path => url.pathname === path || url.pathname.endsWith(path))) {
    return true;
  }
  
  // Logos et assets
  if (url.pathname.startsWith('/logos/') || 
      url.pathname.startsWith('/assets/')) {
    return true;
  }
  
  return false;
}

function isSupabaseAPI(url) {
  return url.hostname.includes('supabase.co') && 
         (url.pathname.includes('/rest/') || 
          url.pathname.includes('/auth/'));
}

function isSupabaseStorage(url) {
  return url.hostname.includes('supabase.co') && 
         url.pathname.includes('/storage/');
}

// 📨 Messages du client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    
    caches.open(CACHE_RUNTIME)
      .then((cache) => cache.addAll(urls))
      .then(() => {
        event.ports[0].postMessage({ success: true });
      })
      .catch((error) => {
        console.error('[SW] Erreur cache URLs:', error);
        event.ports[0].postMessage({ success: false, error: error.message });
      });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => {
        event.ports[0].postMessage({ success: true });
      });
  }
});

console.log('[SW] Service Worker Barzik chargé - v' + CACHE_VERSION);