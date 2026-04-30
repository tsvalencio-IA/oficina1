/**
 * thIAguinho ERP — Service Worker
 *
 * Permite que o sistema funcione como PWA (Progressive Web App):
 *  • Cliente pode "instalar" o site como ícone na tela do celular
 *  • Funciona offline parcialmente (cache dos arquivos visitados)
 *  • Atualização automática quando volta online
 *
 * Estratégia: Network First com fallback para Cache.
 * Isso garante que o cliente sempre vê a versão mais nova quando online,
 * mas continua tendo acesso ao último estado conhecido se cair internet.
 *
 * Powered by thIAguinho Soluções Digitais
 */
const CACHE_VERSION = 'thiaguinho-v1.4.2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Arquivos críticos que pré-carregamos na instalação
const PRECACHE_URLS = [
  './',
  './selecionar-perfil.html',
  './index.html',
  './jarvis.html',
  './equipe.html',
  './cliente.html',
  './clienteOficial.html',
  './manifest.json',
  './css/design.css',
  './js/core.js',
  './js/clientes.js',
  './js/ia.js',
  './js/financeiro.js',
  './js/exportar-pmsp.js',
  './js/os.js',
  './js/os-utils.js',
  './js/tabela-tempa.js',
  './js/ui.js',
  './js/pdf.js',
  './js/config.js',
  './js/fiscal.js',
  './assets/templates/I-30003_PLANILHA_DE_CUSTOS.xlsx',
  './elm327-service.js',
  './elm-bridge.js'
];

// ── INSTALL: pré-carrega arquivos críticos ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        // addAll falha se UM arquivo falhar; usar add() individual + catch é mais robusto
        return Promise.all(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => console.warn('SW skip:', url, err.message))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches antigos ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter(key => !key.startsWith(CACHE_VERSION))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: Network First, depois Cache ──
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Pula requisições que não são GET
  if (request.method !== 'GET') return;

  // Pula chamadas para Firebase/Cloudinary/Gemini (sempre online)
  const url = new URL(request.url);
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; // deixa o browser fazer normal sem cache
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Salva uma cópia no cache runtime para uso offline
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Sem internet: tenta cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Nem cache nem internet: fallback simples
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

/* Powered by thIAguinho Soluções Digitais */
