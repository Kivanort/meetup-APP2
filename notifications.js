/**
 * Усовершенствованная система уведомлений для MeetUP
 * Версия 2.0
 * Поддерживает браузерные и PUSH уведомления
 */

const NotificationSystem = (function() {
    // Константы для ключей хранилища
    const STORAGE_KEYS = {
        SETTINGS: 'meetup_notifications_v2',
        PERMISSION_HISTORY: 'meetup_notifications_permission_history',
        SENT_NOTIFICATIONS: 'meetup_sent_notifications',
        SUBSCRIPTION: 'meetup_push_subscription'
    };
    
    // Типы уведомлений
    const NOTIFICATION_TYPES = {
        FRIEND_REQUEST: 'friend_request',
        NEARBY_FRIEND: 'nearby_friend',
        NEW_MESSAGE: 'new_message',
        EVENT_REMINDER: 'event_reminder',
        SYSTEM: 'system',
        MEETUP_INVITE: 'meetup_invite',
        FRIEND_ACCEPTED: 'friend_accepted',
        MESSAGE_LIKE: 'message_like',
        EVENT_UPDATE: 'event_update'
    };
    
    // Категории уведомлений
    const NOTIFICATION_CATEGORIES = {
        SOCIAL: 'social',
        MESSAGES: 'messages',
        EVENTS: 'events',
        SYSTEM: 'system',
        LOCATION: 'location'
    };
    
    // Настройки по умолчанию
    const DEFAULT_SETTINGS = {
        enabled: true,
        sound: true,
        vibration: true,
        popup: true,
        categories: {
            [NOTIFICATION_CATEGORIES.SOCIAL]: true,
            [NOTIFICATION_CATEGORIES.MESSAGES]: true,
            [NOTIFICATION_CATEGORIES.EVENTS]: true,
            [NOTIFICATION_CATEGORIES.SYSTEM]: true,
            [NOTIFICATION_CATEGORIES.LOCATION]: false
        },
        quietHours: {
            enabled: false,
            start: '23:00',
            end: '08:00'
        },
        priorityLevel: 'medium', // 'low', 'medium', 'high'
        displayDuration: 7000, // мс
        maxPerMinute: 5
    };
    
    // Кэш и состояние
    let state = {
        settings: null,
        permission: null,
        serviceWorker: null,
        pushSubscription: null,
        notificationQueue: [],
        lastNotificationTime: 0,
        notificationCount: 0
    };
    
    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
    
    // Безопасное сохранение в localStorage
    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Ошибка сохранения ${key}:`, e);
            return false;
        }
    }
    
    // Безопасное чтение из localStorage
    function safeGetItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error(`Ошибка чтения ${key}:`, e);
            return defaultValue;
        }
    }
    
    // Генерация уникального ID
    function generateNotificationId() {
        return 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Проверка поддержки уведомлений
    function isBrowserSupported() {
        return 'Notification' in window;
    }
    
    // Проверка поддержки PUSH уведомлений
    function isPushSupported() {
        return 'serviceWorker' in navigator && 'PushManager' in window;
    }
    
    // Проверка поддержки вибрации
    function isVibrationSupported() {
        return 'vibrate' in navigator;
    }
    
    // Проверка, находятся ли мы в тихих часах
    function isQuietHours() {
        const settings = getSettings();
        if (!settings.quietHours.enabled) return false;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startHour, startMinute] = settings.quietHours.start.split(':').map(Number);
        const [endHour, endMinute] = settings.quietHours.end.split(':').map(Number);
        
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;
        
        if (startTime <= endTime) {
            return currentTime >= startTime && currentTime < endTime;
        } else {
            return currentTime >= startTime || currentTime < endTime;
        }
    }
    
    // Проверка ограничения частоты уведомлений
    function isRateLimited() {
        const settings = getSettings();
        const now = Date.now();
        
        // Сброс счетчика, если прошла минута
        if (now - state.lastNotificationTime > 60000) {
            state.notificationCount = 0;
            state.lastNotificationTime = now;
        }
        
        return state.notificationCount >= settings.maxPerMinute;
    }
    
    // Получение настроек (с кэшированием)
    function getSettings() {
        if (!state.settings) {
            const savedSettings = safeGetItem(STORAGE_KEYS.SETTINGS);
            
            // Миграция со старой версии
            if (!savedSettings) {
                const oldSetting = localStorage.getItem('meetup_notifications');
                if (oldSetting !== null) {
                    const migratedSettings = {
                        ...DEFAULT_SETTINGS,
                        enabled: oldSetting === 'true'
                    };
                    saveSettings(migratedSettings);
                    state.settings = migratedSettings;
                    return migratedSettings;
                }
            }
            
            state.settings = {
                ...DEFAULT_SETTINGS,
                ...savedSettings,
                categories: {
                    ...DEFAULT_SETTINGS.categories,
                    ...(savedSettings?.categories || {})
                }
            };
        }
        
        return state.settings;
    }
    
    // Сохранение настроек
    function saveSettings(newSettings) {
        const mergedSettings = {
            ...getSettings(),
            ...newSettings,
            categories: {
                ...getSettings().categories,
                ...newSettings.categories
            }
        };
        
        state.settings = mergedSettings;
        safeSetItem(STORAGE_KEYS.SETTINGS, mergedSettings);
        
        // Обновление в профиле пользователя (если есть доступ к UserSystem)
        updateUserProfileSettings(mergedSettings);
        
        return mergedSettings;
    }
    
    // Обновление настроек в профиле пользователя
    function updateUserProfileSettings(settings) {
        try {
            // Проверяем наличие UserSystem и текущего пользователя
            if (window.UserSystem && window.UserSystem.getCurrentUser) {
                const currentUser = window.UserSystem.getCurrentUser();
                if (currentUser) {
                    const users = window.UserSystem.getUsers();
                    const userIndex = users.findIndex(u => u.id === currentUser.id);
                    
                    if (userIndex !== -1) {
                        users[userIndex].notificationSettings = settings;
                        window.UserSystem.saveUsers(users);
                        window.UserSystem.setCurrentUser(users[userIndex]);
                    }
                }
            }
        } catch (e) {
            console.warn('Не удалось обновить настройки в профиле пользователя:', e);
        }
    }
    
    // Получение текущего разрешения
    function getPermission() {
        if (!isBrowserSupported()) return 'unsupported';
        if (state.permission === null) {
            state.permission = Notification.permission;
        }
        return state.permission;
    }
    
    // ===== УПРАВЛЕНИЕ РАЗРЕШЕНИЯМИ =====
    
    // Запрос разрешения с улучшенным UX
    function requestPermission(options = {}) {
        if (!isBrowserSupported()) {
            return Promise.reject(new Error('Уведомления не поддерживаются вашим браузером'));
        }
        
        const currentPermission = getPermission();
        
        // Если уже есть разрешение, возвращаем его
        if (currentPermission === 'granted') {
            return Promise.resolve('granted');
        }
        
        // Если разрешение было отклонено, предлагаем инструкцию
        if (currentPermission === 'denied' && options.showInstructions !== false) {
            showPermissionInstructions();
            return Promise.reject(new Error('Разрешение было отклонено ранее'));
        }
        
        // Сохраняем историю запроса
        savePermissionHistory('requested', options.reason);
        
        return Notification.requestPermission()
            .then(permission => {
                state.permission = permission;
                
                // Сохраняем результат в историю
                savePermissionHistory(permission, options.reason);
                
                // Обновляем настройки
                if (permission === 'granted') {
                    const settings = getSettings();
                    settings.enabled = true;
                    saveSettings(settings);
                    
                    // Инициализируем PUSH уведомления, если поддерживаются
                    if (isPushSupported() && options.registerPush !== false) {
                        initializePushNotifications();
                    }
                }
                
                // Вызываем кастомный коллбек, если предоставлен
                if (typeof options.onComplete === 'function') {
                    options.onComplete(permission);
                }
                
                return permission;
            })
            .catch(error => {
                console.error('Ошибка при запросе разрешения:', error);
                savePermissionHistory('error', error.message);
                throw error;
            });
    }
    
    // Сохранение истории разрешений
    function savePermissionHistory(status, reason = null) {
        const history = safeGetItem(STORAGE_KEYS.PERMISSION_HISTORY, []);
        
        history.push({
            timestamp: Date.now(),
            status,
            reason,
            userAgent: navigator.userAgent,
            platform: navigator.platform
        });
        
        // Ограничиваем историю последними 50 записями
        if (history.length > 50) {
            history.shift();
        }
        
        safeSetItem(STORAGE_KEYS.PERMISSION_HISTORY, history);
    }
    
    // Показ инструкции по настройке разрешений
    function showPermissionInstructions() {
        // Создаем кастомное модальное окно с инструкциями
        const modalHtml = `
            <div class="notification-permission-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            ">
                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                ">
                    <h3 style="margin-top: 0; color: #333;">Разрешите уведомления</h3>
                    <p>Для получения уведомлений необходимо разрешить их в настройках браузера:</p>
                    <ol style="text-align: left; margin-left: 20px;">
                        <li>Нажмите на значок 🔒 рядом с адресной строкой</li>
                        <li>Выберите "Настройки сайта" или "Разрешения"</li>
                        <li>Найдите "Уведомления" и установите "Разрешить"</li>
                        <li>Обновите страницу</li>
                    </ol>
                    <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                            padding: 8px 16px;
                            background: #f0f0f0;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                        ">Закрыть</button>
                        <button onclick="NotificationSystem.requestPermission({showInstructions: false})" style="
                            padding: 8px 16px;
                            background: #007bff;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                        ">Попробовать снова</button>
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer.firstElementChild);
    }
    
    // Проверка, включены ли уведомления для конкретной категории
    function isCategoryEnabled(category) {
        const settings = getSettings();
        return settings.enabled && settings.categories[category] !== false;
    }
    
    // ===== СОЗДАНИЕ И ОТПРАВКА УВЕДОМЛЕНИЙ =====
    
    // Создание уведомления
    function createNotification(title, options = {}) {
        const settings = getSettings();
        const notificationId = generateNotificationId();
        
        // Проверяем возможность отправки
        if (!canSendNotification(options.type, options.category)) {
            console.log(`Уведомление отложено: ${title}`, options);
            return null;
        }
        
        // Подготавливаем параметры уведомления
        const notificationOptions = {
            icon: options.icon || 'meetup-logo.png',
            badge: options.badge || 'meetup-logo.png',
            image: options.image,
            body: options.body || '',
            tag: options.tag || 'meetup-general',
            data: {
                id: notificationId,
                type: options.type || NOTIFICATION_TYPES.SYSTEM,
                category: options.category || NOTIFICATION_CATEGORIES.SYSTEM,
                source: options.source || 'app',
                actionUrl: options.actionUrl,
                timestamp: Date.now(),
                ...options.data
            },
            requireInteraction: options.requireInteraction || false,
            silent: !settings.sound,
            vibrate: settings.vibration && isVibrationSupported() ? [200, 100, 200] : []
        };
        
        // Добавляем действия, если поддерживается
        if ('actions' in Notification.prototype && options.actions) {
            notificationOptions.actions = options.actions.map(action => ({
                action: action.action,
                title: action.title,
                icon: action.icon
            }));
        }
        
        // Создаем и показываем уведомление
        let notification;
        try {
            notification = new Notification(title, notificationOptions);
            state.notificationCount++;
            
            // Обработчики событий уведомления
            notification.onclick = function(event) {
                handleNotificationClick(this.data, event);
            };
            
            notification.onclose = function() {
                handleNotificationClose(this.data);
            };
            
            notification.onshow = function() {
                handleNotificationShow(this.data);
            };
            
            // Вибрируем, если поддерживается
            if (settings.vibration && isVibrationSupported()) {
                navigator.vibrate(notificationOptions.vibrate);
            }
            
            // Сохраняем информацию об отправленном уведомлении
            saveSentNotification(notificationId, title, options);
            
            return notification;
        } catch (error) {
            console.error('Ошибка при создании уведомления:', error);
            return null;
        }
    }
    
    // Проверка возможности отправки уведомления
    function canSendNotification(type, category) {
        const permission = getPermission();
        const settings = getSettings();
        
        // Базовые проверки
        if (!isBrowserSupported()) return false;
        if (permission !== 'granted') return false;
        if (!settings.enabled) return false;
        if (isQuietHours()) return false;
        if (isRateLimited()) return false;
        
        // Проверка категории
        if (category && !isCategoryEnabled(category)) return false;
        
        return true;
    }
    
    // Сохранение информации об отправленных уведомлениях
    function saveSentNotification(id, title, options) {
        const sentNotifications = safeGetItem(STORAGE_KEYS.SENT_NOTIFICATIONS, []);
        
        const notificationRecord = {
            id,
            title,
            type: options.type || NOTIFICATION_TYPES.SYSTEM,
            category: options.category || NOTIFICATION_CATEGORIES.SYSTEM,
            timestamp: Date.now(),
            delivered: true,
            clicked: false,
            interacted: false,
            data: options.data || {}
        };
        
        sentNotifications.push(notificationRecord);
        
        // Ограничиваем историю последними 100 уведомлениями
        if (sentNotifications.length > 100) {
            sentNotifications.shift();
        }
        
        safeSetItem(STORAGE_KEYS.SENT_NOTIFICATIONS, sentNotifications);
    }
    
    // Обработчик клика по уведомлению
    function handleNotificationClick(notificationData, event) {
        console.log('Уведомление кликнуто:', notificationData);
        
        // Фокусируем окно
        window.focus();
        
        // Обновляем статистику
        updateNotificationStats(notificationData.id, { clicked: true });
        
        // Обрабатываем действие, если оно есть
        if (event.action && notificationData.data && notificationData.data.actions) {
            const action = notificationData.data.actions.find(a => a.action === event.action);
            if (action && action.handler) {
                action.handler();
            }
        }
        
        // Перенаправляем по ссылке, если есть
        if (notificationData.actionUrl) {
            window.location.href = notificationData.actionUrl;
        }
        
        // Закрываем уведомление
        event.currentTarget.close();
    }
    
    // Обработчик закрытия уведомления
    function handleNotificationClose(notificationData) {
        console.log('Уведомление закрыто:', notificationData);
        updateNotificationStats(notificationData.id, { closed: true });
    }
    
    // Обработчик показа уведомления
    function handleNotificationShow(notificationData) {
        console.log('Уведомление показано:', notificationData);
        updateNotificationStats(notificationData.id, { shown: true });
    }
    
    // Обновление статистики уведомления
    function updateNotificationStats(notificationId, updates) {
        const sentNotifications = safeGetItem(STORAGE_KEYS.SENT_NOTIFICATIONS, []);
        const notificationIndex = sentNotifications.findIndex(n => n.id === notificationId);
        
        if (notificationIndex !== -1) {
            sentNotifications[notificationIndex] = {
                ...sentNotifications[notificationIndex],
                ...updates
            };
            safeSetItem(STORAGE_KEYS.SENT_NOTIFICATIONS, sentNotifications);
        }
    }
    
    // ===== СПЕЦИАЛИЗИРОВАННЫЕ УВЕДОМЛЕНИЯ =====
    
    // Уведомление о друге рядом
    function sendNearbyFriendNotification(friendName, distance, friendId = null) {
        if (!canSendNotification(NOTIFICATION_TYPES.NEARBY_FRIEND, NOTIFICATION_CATEGORIES.LOCATION)) {
            return null;
        }
        
        return createNotification('👋 Друг поблизости!', {
            body: `${friendName} находится в ${distance.toFixed(1)} км от вас`,
            type: NOTIFICATION_TYPES.NEARBY_FRIEND,
            category: NOTIFICATION_CATEGORIES.LOCATION,
            tag: 'nearby-friend',
            requireInteraction: false,
            icon: 'friend-nearby-icon.png',
            data: {
                friendId,
                distance,
                actionUrl: `/friend/${friendId}`
            },
            actions: [
                {
                    action: 'message',
                    title: 'Написать',
                    icon: 'message-icon.png'
                },
                {
                    action: 'profile',
                    title: 'Профиль',
                    icon: 'profile-icon.png'
                }
            ]
        });
    }
    
    // Уведомление о новом запросе в друзья
    function sendFriendRequestNotification(fromUser) {
        if (!canSendNotification(NOTIFICATION_TYPES.FRIEND_REQUEST, NOTIFICATION_CATEGORIES.SOCIAL)) {
            return null;
        }
        
        return createNotification('🆕 Новый запрос в друзья', {
            body: `${fromUser.nickname} хочет добавить вас в друзья`,
            type: NOTIFICATION_TYPES.FRIEND_REQUEST,
            category: NOTIFICATION_CATEGORIES.SOCIAL,
            tag: 'friend-request',
            requireInteraction: true,
            icon: fromUser.avatar || 'default-avatar.png',
            data: {
                userId: fromUser.id,
                actionUrl: `/friends/requests`
            },
            actions: [
                {
                    action: 'accept',
                    title: 'Принять',
                    icon: 'accept-icon.png'
                },
                {
                    action: 'decline',
                    title: 'Отклонить',
                    icon: 'decline-icon.png'
                }
            ]
        });
    }
    
    // Уведомление о новом сообщении
    function sendNewMessageNotification(senderName, messagePreview, chatId, messageId) {
        if (!canSendNotification(NOTIFICATION_TYPES.NEW_MESSAGE, NOTIFICATION_CATEGORIES.MESSAGES)) {
            return null;
        }
        
        return createNotification(`💬 ${senderName}`, {
            body: messagePreview.length > 50 ? messagePreview.substring(0, 47) + '...' : messagePreview,
            type: NOTIFICATION_TYPES.NEW_MESSAGE,
            category: NOTIFICATION_CATEGORIES.MESSAGES,
            tag: `chat-${chatId}`,
            requireInteraction: false,
            icon: 'message-icon.png',
            data: {
                chatId,
                messageId,
                actionUrl: `/chat/${chatId}`
            }
        });
    }
    
    // Уведомление о напоминании события
    function sendEventReminderNotification(eventTitle, eventTime, eventId) {
        if (!canSendNotification(NOTIFICATION_TYPES.EVENT_REMINDER, NOTIFICATION_CATEGORIES.EVENTS)) {
            return null;
        }
        
        const timeString = new Date(eventTime).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return createNotification('⏰ Напоминание о встрече', {
            body: `${eventTitle} начинается в ${timeString}`,
            type: NOTIFICATION_TYPES.EVENT_REMINDER,
            category: NOTIFICATION_CATEGORIES.EVENTS,
            tag: `event-reminder-${eventId}`,
            requireInteraction: false,
            icon: 'event-icon.png',
            data: {
                eventId,
                actionUrl: `/event/${eventId}`
            }
        });
    }
    
    // ===== PUSH УВЕДОМЛЕНИЯ =====
    
    // Инициализация Service Worker
    async function initializeServiceWorker() {
        if (!isPushSupported()) {
            console.log('PUSH уведомления не поддерживаются');
            return null;
        }
        
        try {
            const registration = await navigator.serviceWorker.register('/sw-notifications.js', {
                scope: '/'
            });
            
            state.serviceWorker = registration;
            console.log('Service Worker зарегистрирован:', registration);
            
            // Проверяем существующую подписку
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                state.pushSubscription = subscription;
                console.log('Найдена существующая PUSH подписка');
            }
            
            return registration;
        } catch (error) {
            console.error('Ошибка регистрации Service Worker:', error);
            return null;
        }
    }
    
    // Инициализация PUSH уведомлений
    async function initializePushNotifications() {
        if (!isPushSupported() || !state.serviceWorker) {
            console.log('PUSH уведомления не доступны');
            return false;
        }
        
        try {
            // Запрашиваем подписку
            const subscription = await state.serviceWorker.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('YOUR_PUBLIC_VAPID_KEY_HERE') // Замените на ваш ключ
            });
            
            state.pushSubscription = subscription;
            
            // Отправляем подписку на сервер
            await sendSubscriptionToServer(subscription);
            
            console.log('PUSH уведомления активированы');
            return true;
        } catch (error) {
            console.error('Ошибка активации PUSH уведомлений:', error);
            return false;
        }
    }
    
    // Конвертация ключа для VAPID
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        return outputArray;
    }
    
    // Отправка подписки на сервер
    async function sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription,
                    userId: window.UserSystem?.getCurrentUser()?.id,
                    userAgent: navigator.userAgent
                })
            });
            
            if (!response.ok) {
                throw new Error('Ошибка отправки подписки');
            }
            
            console.log('Подписка отправлена на сервер');
            return true;
        } catch (error) {
            console.error('Ошибка отправки подписки:', error);
            return false;
        }
    }
    
    // Отключение PUSH уведомлений
    async function disablePushNotifications() {
        if (!state.pushSubscription) {
            return true;
        }
        
        try {
            await state.pushSubscription.unsubscribe();
            state.pushSubscription = null;
            console.log('PUSH уведомления отключены');
            return true;
        } catch (error) {
            console.error('Ошибка отключения PUSH уведомлений:', error);
            return false;
        }
    }
    
    // ===== УТИЛИТЫ И СТАТИСТИКА =====
    
    // Получение статистики уведомлений
    function getNotificationStats() {
        const sentNotifications = safeGetItem(STORAGE_KEYS.SENT_NOTIFICATIONS, []);
        const permissionHistory = safeGetItem(STORAGE_KEYS.PERMISSION_HISTORY, []);
        
        const stats = {
            totalSent: sentNotifications.length,
            totalClicked: sentNotifications.filter(n => n.clicked).length,
            totalDelivered: sentNotifications.filter(n => n.delivered).length,
            byType: {},
            byCategory: {},
            clickRate: 0,
            permissionHistory: permissionHistory.length
        };
        
        // Статистика по типам
        sentNotifications.forEach(notification => {
            stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
            stats.byCategory[notification.category] = (stats.byCategory[notification.category] || 0) + 1;
        });
        
        // Расчет CTR
        if (stats.totalSent > 0) {
            stats.clickRate = (stats.totalClicked / stats.totalSent) * 100;
        }
        
        return stats;
    }
    
    // Очистка старых уведомлений
    function clearOldNotifications(days = 30) {
        const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
        const sentNotifications = safeGetItem(STORAGE_KEYS.SENT_NOTIFICATIONS, []);
        
        const filteredNotifications = sentNotifications.filter(n => n.timestamp > cutoffDate);
        
        if (filteredNotifications.length !== sentNotifications.length) {
            safeSetItem(STORAGE_KEYS.SENT_NOTIFICATIONS, filteredNotifications);
            console.log(`Очищено ${sentNotifications.length - filteredNotifications.length} старых уведомлений`);
            return sentNotifications.length - filteredNotifications.length;
        }
        
        return 0;
    }
    
    // Тестовое уведомление
    function sendTestNotification() {
        return createNotification('Тестовое уведомление MeetUP', {
            body: 'Это тестовое уведомление. Все системы работают нормально! 🚀',
            type: NOTIFICATION_TYPES.SYSTEM,
            category: NOTIFICATION_CATEGORIES.SYSTEM,
            requireInteraction: false,
            icon: 'meetup-logo.png',
            data: {
                test: true,
                timestamp: Date.now()
            }
        });
    }
    
    // ===== ИНИЦИАЛИЗАЦИЯ =====
    
    // Инициализация системы
    async function init() {
        console.log('🚀 Инициализация системы уведомлений...');
        
        // Загружаем настройки
        getSettings();
        
        // Проверяем разрешение
        getPermission();
        
        // Инициализируем Service Worker для PUSH уведомлений
        if (isPushSupported()) {
            await initializeServiceWorker();
        }
        
        // Очищаем старые уведомления
        clearOldNotifications();
        
        console.log('✅ Система уведомлений готова');
        return {
            supported: isBrowserSupported(),
            pushSupported: isPushSupported(),
            permission: getPermission(),
            settings: getSettings()
        };
    }
    
    // Публичное API
    return {
        // Инициализация
        init,
        
        // Проверка поддержки
        isSupported: isBrowserSupported,
        isPushSupported,
        isVibrationSupported,
        
        // Управление разрешениями
        getPermission,
        requestPermission,
        showPermissionInstructions,
        
        // Настройки
        getSettings,
        saveSettings,
        isCategoryEnabled,
        
        // Создание уведомлений
        createNotification,
        canSendNotification,
        
        // Специализированные уведомления
        sendNearbyFriendNotification,
        sendFriendRequestNotification,
        sendNewMessageNotification,
        sendEventReminderNotification,
        sendTestNotification,
        
        // PUSH уведомления
        initializeServiceWorker,
        initializePushNotifications,
        disablePushNotifications,
        
        // Утилиты
        getNotificationStats,
        clearOldNotifications,
        
        // Константы для использования в приложении
        TYPES: NOTIFICATION_TYPES,
        CATEGORIES: NOTIFICATION_CATEGORIES
    };
})();

// Автоматическая инициализация при загрузке
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            NotificationSystem.init();
        }, 1000); // Даем время на загрузку страницы
    });
    
    // Экспорт для глобального использования
    window.NotificationSystem = NotificationSystem;
}
