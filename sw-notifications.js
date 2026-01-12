/**
 * Service Worker для системы уведомлений MeetUP
 * Версия 2.0
 * Обрабатывает PUSH уведомления и background синхронизацию
 */

// Кэширование статических ресурсов для работы офлайн
const CACHE_NAME = 'meetup-notifications-v2';
const STATIC_CACHE_NAME = 'meetup-static-v2';

// URL для отправки статистики уведомлений
const NOTIFICATION_STATS_URL = '/api/notifications/stats';

// ===== ИНИЦИАЛИЗАЦИЯ =====

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Установка...');
    
    event.waitUntil(
        Promise.all([
            // Кэшируем статические ресурсы для уведомлений
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                return cache.addAll([
                    '/',
                    '/meetup-logo.png',
                    '/friend-nearby-icon.png',
                    '/message-icon.png',
                    '/event-icon.png',
                    '/accept-icon.png',
                    '/decline-icon.png',
                    '/profile-icon.png',
                    '/default-avatar.png',
                    '/manifest.json'
                ]);
            }),
            // Активируем SW сразу
            self.skipWaiting()
        ])
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Активация...');
    
    event.waitUntil(
        Promise.all([
            // Очищаем старые кэши
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                            console.log('[Service Worker] Удаление старого кэша:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Заявляем права на все клиенты
            self.clients.claim()
        ])
    );
});

// ===== PUSH УВЕДОМЛЕНИЯ =====

self.addEventListener('push', (event) => {
    console.log('[Service Worker] Получено PUSH уведомление:', event);
    
    let notificationData;
    
    try {
        if (event.data) {
            notificationData = event.data.json();
        } else {
            // Если данные не пришли, создаем заглушку
            notificationData = {
                title: 'MeetUP',
                body: 'У вас новое уведомление!',
                icon: '/meetup-logo.png',
                tag: 'meetup-push',
                timestamp: Date.now(),
                data: {
                    type: 'system',
                    actionUrl: '/',
                    source: 'push'
                }
            };
        }
    } catch (error) {
        console.error('[Service Worker] Ошибка парсинга данных PUSH:', error);
        notificationData = {
            title: 'MeetUP',
            body: 'Новое уведомление',
            icon: '/meetup-logo.png',
            tag: 'meetup-push-error',
            timestamp: Date.now(),
            data: {
                type: 'system',
                actionUrl: '/',
                source: 'push'
            }
        };
    }
    
    const options = {
        body: notificationData.body,
        icon: notificationData.icon || '/meetup-logo.png',
        badge: notificationData.badge || '/meetup-logo.png',
        image: notificationData.image,
        tag: notificationData.tag || 'meetup-general',
        data: {
            ...notificationData.data,
            id: 'push_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            source: 'push',
            receivedAt: Date.now(),
            originalData: notificationData
        },
        requireInteraction: notificationData.requireInteraction || false,
        actions: notificationData.actions || [],
        vibrate: [200, 100, 200],
        silent: notificationData.silent || false
    };
    
    // Показываем уведомление
    event.waitUntil(
        self.registration.showNotification(notificationData.title || 'MeetUP', options)
            .then(() => {
                // Отправляем статистику о доставке
                sendNotificationStats('delivered', options.data);
            })
            .catch(error => {
                console.error('[Service Worker] Ошибка показа уведомления:', error);
            })
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Клик по уведомлению:', event.notification);
    
    const notification = event.notification;
    const notificationData = notification.data || {};
    
    // Закрываем уведомление
    notification.close();
    
    // Отправляем статистику о клике
    sendNotificationStats('clicked', notificationData);
    
    // Обрабатываем действия (кнопки в уведомлении)
    if (event.action) {
        console.log('[Service Worker] Выбрано действие:', event.action);
        
        switch (event.action) {
            case 'accept':
                // Обработка принятия запроса в друзья
                handleFriendRequestAction(notificationData, true);
                break;
                
            case 'decline':
                // Обработка отклонения запроса в друзья
                handleFriendRequestAction(notificationData, false);
                break;
                
            case 'message':
                // Открытие чата
                if (notificationData.friendId || notificationData.userId) {
                    openClientPage(`/chat/${notificationData.friendId || notificationData.userId}`);
                }
                break;
                
            case 'profile':
                // Открытие профиля
                if (notificationData.friendId || notificationData.userId) {
                    openClientPage(`/friend/${notificationData.friendId || notificationData.userId}`);
                }
                break;
                
            default:
                // Кастомное действие
                if (notificationData.actions) {
                    const action = notificationData.actions.find(a => a.action === event.action);
                    if (action && action.handlerUrl) {
                        openClientPage(action.handlerUrl);
                    }
                }
        }
    } else {
        // Обычный клик по телу уведомления
        if (notificationData.actionUrl) {
            openClientPage(notificationData.actionUrl);
        } else if (notificationData.source === 'push') {
            // Для PUSH уведомлений открываем главную страницу
            openClientPage('/');
        }
    }
});

// Обработка закрытия уведомлений
self.addEventListener('notificationclose', (event) => {
    console.log('[Service Worker] Уведомление закрыто:', event.notification);
    
    const notificationData = event.notification.data || {};
    
    // Отправляем статистику о закрытии
    sendNotificationStats('closed', notificationData);
});

// ===== ФОНЕВАЯ СИНХРОНИЗАЦИЯ =====

self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Синхронизация:', event.tag);
    
    switch (event.tag) {
        case 'sync-notifications':
            event.waitUntil(syncPendingNotifications());
            break;
            
        case 'sync-settings':
            event.waitUntil(syncNotificationSettings());
            break;
            
        case 'sync-friends':
            event.waitUntil(syncFriendsData());
            break;
    }
});

// ===== ПЕРЕХВАТ СЕТЕВЫХ ЗАПРОСОВ =====

self.addEventListener('fetch', (event) => {
    // Для API запросов используем network-first стратегию
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Кэшируем успешные ответы API
                    if (response.ok && event.request.method === 'GET') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                    }
                    return response;
                })
                .catch(() => {
                    // При ошибке сети пытаемся получить из кэша
                    return caches.match(event.request);
                })
        );
    }
    // Для статических ресурсов используем cache-first стратегию
    else if (event.request.destination === 'image' || 
             event.request.url.includes('.png') || 
             event.request.url.includes('.jpg') ||
             event.request.url.includes('.svg')) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    return cachedResponse || fetch(event.request)
                        .then((response) => {
                            // Кэшируем новый ресурс
                            const responseClone = response.clone();
                            caches.open(STATIC_CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                            return response;
                        });
                })
        );
    }
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Открытие страницы в клиенте
function openClientPage(url) {
    console.log('[Service Worker] Открытие страницы:', url);
    
    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            // Ищем открытое окно
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.navigate(url).then(client => client.focus());
                }
            }
            
            // Если окно не найдено, открываем новое
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
}

// Отправка статистики уведомлений на сервер
async function sendNotificationStats(action, notificationData) {
    try {
        const statsData = {
            action,
            notificationId: notificationData.id,
            type: notificationData.type,
            category: notificationData.category,
            source: notificationData.source,
            timestamp: Date.now(),
            userAgent: navigator.userAgent
        };
        
        // Отправляем статистику
        const response = await fetch(NOTIFICATION_STATS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(statsData)
        });
        
        if (!response.ok) {
            console.warn('[Service Worker] Не удалось отправить статистику');
        }
    } catch (error) {
        console.error('[Service Worker] Ошибка отправки статистики:', error);
    }
}

// Обработка действий с запросами в друзья
async function handleFriendRequestAction(notificationData, accept) {
    try {
        const response = await fetch('/api/friends/requests/action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                friendId: notificationData.userId || notificationData.friendId,
                accept: accept,
                notificationId: notificationData.id
            })
        });
        
        if (response.ok) {
            console.log(`[Service Worker] Запрос в друзья ${accept ? 'принят' : 'отклонен'}`);
            
            // Показываем подтверждение
            if (accept) {
                self.registration.showNotification('Запрос принят!', {
                    body: 'Теперь вы друзья!',
                    icon: '/accept-icon.png',
                    tag: 'friend-request-accepted',
                    silent: true
                });
            }
        }
    } catch (error) {
        console.error('[Service Worker] Ошибка обработки запроса в друзья:', error);
    }
}

// Синхронизация отложенных уведомлений
async function syncPendingNotifications() {
    try {
        // Получаем отложенные уведомления из IndexedDB
        const pendingNotifications = await getPendingNotifications();
        
        for (const notification of pendingNotifications) {
            try {
                // Отправляем уведомление на сервер
                const response = await fetch('/api/notifications/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(notification)
                });
                
                if (response.ok) {
                    // Удаляем из отложенных
                    await removePendingNotification(notification.id);
                    console.log('[Service Worker] Уведомление синхронизировано:', notification.id);
                }
            } catch (error) {
                console.error('[Service Worker] Ошибка синхронизации уведомления:', error);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Ошибка синхронизации:', error);
    }
}

// Синхронизация настроек уведомлений
async function syncNotificationSettings() {
    try {
        const response = await fetch('/api/notifications/settings/sync', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const settings = await response.json();
            
            // Сохраняем настройки в IndexedDB
            await saveNotificationSettings(settings);
            
            console.log('[Service Worker] Настройки синхронизированы');
            
            // Обновляем клиенты
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'SETTINGS_UPDATED',
                    settings: settings
                });
            });
        }
    } catch (error) {
        console.error('[Service Worker] Ошибка синхронизации настроек:', error);
    }
}

// Синхронизация данных друзей
async function syncFriendsData() {
    try {
        const response = await fetch('/api/friends/sync', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const friendsData = await response.json();
            
            // Сохраняем данные в IndexedDB
            await saveFriendsData(friendsData);
            
            console.log('[Service Worker] Данные друзей синхронизированы');
            
            // Проверяем друзей поблизости
            checkNearbyFriends(friendsData);
        }
    } catch (error) {
        console.error('[Service Worker] Ошибка синхронизации друзей:', error);
    }
}

// Проверка друзей поблизости
async function checkNearbyFriends(friendsData) {
    try {
        // Получаем текущую геопозицию
        const position = await getCurrentPosition();
        
        if (!position) return;
        
        // Проверяем каждого друга
        for (const friend of friendsData) {
            if (friend.location && friend.location.latitude && friend.location.longitude) {
                const distance = calculateDistance(
                    position.coords.latitude,
                    position.coords.longitude,
                    friend.location.latitude,
                    friend.location.longitude
                );
                
                // Если друг ближе 1 км и не уведомляли сегодня
                if (distance < 1 && !wasNotifiedToday(friend.id)) {
                    // Отправляем уведомление
                    self.registration.showNotification('👋 Друг поблизости!', {
                        body: `${friend.nickname} находится в ${distance.toFixed(1)} км от вас`,
                        icon: friend.avatar || '/default-avatar.png',
                        tag: `nearby-friend-${friend.id}`,
                        data: {
                            friendId: friend.id,
                            distance: distance,
                            actionUrl: `/friend/${friend.id}`,
                            type: 'nearby_friend'
                        },
                        actions: [
                            {
                                action: 'message',
                                title: 'Написать'
                            },
                            {
                                action: 'profile',
                                title: 'Профиль'
                            }
                        ]
                    });
                    
                    // Сохраняем факт уведомления
                    saveFriendNotification(friend.id);
                }
            }
        }
    } catch (error) {
        console.error('[Service Worker] Ошибка проверки друзей поблизости:', error);
    }
}

// Получение текущей геопозиции
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Геолокация не поддерживается'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
}

// Расчет расстояния между двумя точками (формула Хаверсина)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ===== INDEXEDDB ОПЕРАЦИИ =====

// Инициализация IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MeetUPNotificationsDB', 3);
        
        request.onerror = (event) => {
            console.error('[Service Worker] Ошибка открытия IndexedDB:', event);
            reject(event);
        };
        
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Хранилище для отложенных уведомлений
            if (!db.objectStoreNames.contains('pendingNotifications')) {
                const store = db.createObjectStore('pendingNotifications', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            // Хранилище для настроек
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'userId' });
            }
            
            // Хранилище для данных друзей
            if (!db.objectStoreNames.contains('friends')) {
                db.createObjectStore('friends', { keyPath: 'id' });
            }
            
            // Хранилище для истории уведомлений о друзьях
            if (!db.objectStoreNames.contains('friendNotifications')) {
                const store = db.createObjectStore('friendNotifications', { keyPath: 'friendId' });
                store.createIndex('lastNotified', 'lastNotified', { unique: false });
            }
        };
    });
}

// Получение отложенных уведомлений
async function getPendingNotifications() {
    try {
        const db = await initDB();
        const transaction = db.transaction(['pendingNotifications'], 'readonly');
        const store = transaction.objectStore('pendingNotifications');
        const index = store.index('timestamp');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[Service Worker] Ошибка получения отложенных уведомлений:', error);
        return [];
    }
}

// Сохранение настроек
async function saveNotificationSettings(settings) {
    try {
        const db = await initDB();
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        
        store.put(settings);
    } catch (error) {
        console.error('[Service Worker] Ошибка сохранения настроек:', error);
    }
}

// Сохранение данных друзей
async function saveFriendsData(friendsData) {
    try {
        const db = await initDB();
        const transaction = db.transaction(['friends'], 'readwrite');
        const store = transaction.objectStore('friends');
        
        for (const friend of friendsData) {
            store.put(friend);
        }
    } catch (error) {
        console.error('[Service Worker] Ошибка сохранения данных друзей:', error);
    }
}

// Проверка, уведомляли ли сегодня о друге
async function wasNotifiedToday(friendId) {
    try {
        const db = await initDB();
        const transaction = db.transaction(['friendNotifications'], 'readonly');
        const store = transaction.objectStore('friendNotifications');
        
        const request = store.get(friendId);
        
        return new Promise((resolve) => {
            request.onsuccess = () => {
                if (request.result) {
                    const lastNotified = new Date(request.result.lastNotified);
                    const today = new Date();
                    const isSameDay = 
                        lastNotified.getDate() === today.getDate() &&
                        lastNotified.getMonth() === today.getMonth() &&
                        lastNotified.getFullYear() === today.getFullYear();
                    
                    resolve(isSameDay);
                } else {
                    resolve(false);
                }
            };
            
            request.onerror = () => resolve(false);
        });
    } catch (error) {
        console.error('[Service Worker] Ошибка проверки уведомлений:', error);
        return false;
    }
}

// Сохранение факта уведомления о друге
async function saveFriendNotification(friendId) {
    try {
        const db = await initDB();
        const transaction = db.transaction(['friendNotifications'], 'readwrite');
        const store = transaction.objectStore('friendNotifications');
        
        const record = {
            friendId: friendId,
            lastNotified: Date.now()
        };
        
        store.put(record);
    } catch (error) {
        console.error('[Service Worker] Ошибка сохранения уведомления:', error);
    }
}

// Удаление отложенного уведомления
async function removePendingNotification(id) {
    try {
        const db = await initDB();
        const transaction = db.transaction(['pendingNotifications'], 'readwrite');
        const store = transaction.objectStore('pendingNotifications');
        
        store.delete(id);
    } catch (error) {
        console.error('[Service Worker] Ошибка удаления уведомления:', error);
    }
}

// ===== СООБЩЕНИЯ ОТ КЛИЕНТОВ =====

self.addEventListener('message', (event) => {
    console.log('[Service Worker] Получено сообщение от клиента:', event.data);
    
    const { type, data } = event.data || {};
    
    switch (type) {
        case 'SCHEDULE_NOTIFICATION':
            scheduleNotification(data);
            break;
            
        case 'SYNC_NOW':
            triggerSync();
            break;
            
        case 'GET_STATS':
            sendStatsToClient(event.source);
            break;
            
        case 'UPDATE_SETTINGS':
            updateSettings(data);
            break;
    }
});

// Планирование уведомления
function scheduleNotification(notificationData) {
    const { time, title, options } = notificationData;
    
    const now = Date.now();
    const delay = time - now;
    
    if (delay > 0) {
        setTimeout(() => {
            self.registration.showNotification(title, options);
        }, delay);
        
        console.log(`[Service Worker] Уведомление запланировано на ${new Date(time)}`);
    }
}

// Запуск синхронизации
function triggerSync() {
    self.registration.sync.register('sync-notifications')
        .then(() => console.log('[Service Worker] Синхронизация запущена'))
        .catch(error => console.error('[Service Worker] Ошибка запуска синхронизации:', error));
}

// Отправка статистики клиенту
async function sendStatsToClient(client) {
    try {
        const pendingNotifications = await getPendingNotifications();
        
        client.postMessage({
            type: 'STATS_DATA',
            data: {
                pendingCount: pendingNotifications.length,
                cacheStatus: await getCacheStatus()
            }
        });
    } catch (error) {
        console.error('[Service Worker] Ошибка получения статистики:', error);
    }
}

// Получение статуса кэша
async function getCacheStatus() {
    try {
        const cache = await caches.open(STATIC_CACHE_NAME);
        const keys = await cache.keys();
        
        return {
            cachedItems: keys.length,
            cacheName: STATIC_CACHE_NAME
        };
    } catch (error) {
        console.error('[Service Worker] Ошибка получения статуса кэша:', error);
        return null;
    }
}

// Обновление настроек
function updateSettings(settings) {
    console.log('[Service Worker] Обновление настроек:', settings);
    // Логика обновления настроек
}

console.log('[Service Worker] Загружен и готов к работе!');
