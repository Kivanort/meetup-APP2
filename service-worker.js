// service-worker.js
const CACHE_NAME = 'meetup-v1.0.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/map.html',
  '/profile.html',
  '/addfriend.html',
  '/notifications.html',
  '/userSystem.js',
  '/meetup-logo.png',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css?family=Inter:400,600&display=swap'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Кеширование ресурсов...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Удаляем старый кеш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Возвращаем из кеша если нашли
        if (response) {
          return response;
        }
        
        // Клонируем запрос для дальнейшего использования
        const fetchRequest = event.request.clone();
        
        // Выполняем сетевой запрос
        return fetch(fetchRequest).then((response) => {
          // Проверяем валидность ответа
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Клонируем ответ для кеширования
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        }).catch(() => {
          // Фоллбек для офлайн режима
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-user-data') {
    event.waitUntil(syncUserData());
  }
});

async function syncUserData() {
  try {
    // Здесь будет синхронизация с сервером
    console.log('🔄 Фоновая синхронизация...');
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
  }
}

// Push уведомления
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.message,
    icon: 'meetup-logo.png',
    badge: 'meetup-logo.png',
    tag: 'meetup-notification',
    data: data.url,
    actions: [
      {
        action: 'open',
        title: 'Открыть'
      },
      {
        action: 'close',
        title: 'Закрыть'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});
