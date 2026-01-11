[file name]: notifications.js
[file content begin]
// Система уведомлений для MeetUP

const NotificationSystem = {
    // Проверяем поддержку уведомлений
    isSupported: function() {
        return 'Notification' in window && 'serviceWorker' in navigator;
    },
    
    // Проверяем разрешение
    getPermissionStatus: function() {
        if (!this.isSupported()) return 'unsupported';
        return Notification.permission;
    },
    
    // Запрашиваем разрешение
    requestPermission: function() {
        if (!this.isSupported()) return Promise.reject('Не поддерживается браузером');
        
        return Notification.requestPermission()
            .then(permission => {
                this.saveNotificationSetting(permission === 'granted');
                return permission;
            });
    },
    
    // Сохраняем настройку уведомлений
    saveNotificationSetting: function(enabled) {
        const currentUser = UserSystem.getCurrentUser();
        if (!currentUser) return;
        
        const users = UserSystem.getUsers();
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        
        if (userIndex !== -1) {
            users[userIndex].notifications = enabled;
            UserSystem.saveUsers(users);
            UserSystem.setCurrentUser(users[userIndex]);
        }
        
        localStorage.setItem('meetup_notifications', enabled.toString());
    },
    
    // Получаем настройку уведомлений
    getNotificationSetting: function() {
        const currentUser = UserSystem.getCurrentUser();
        if (currentUser && currentUser.notifications !== undefined) {
            return currentUser.notifications;
        }
        
        return localStorage.getItem('meetup_notifications') === 'true';
    },
    
    // Отправляем тестовое уведомление
    sendTestNotification: function(title, options) {
        if (!this.isSupported() || Notification.permission !== 'granted') {
            return false;
        }
        
        const notification = new Notification(title, {
            icon: 'meetup-logo.png',
            badge: 'meetup-logo.png',
            ...options
        });
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
        
        return true;
    },
    
    // Отправляем уведомление о друге рядом
    sendNearbyFriendNotification: function(friendName, distance) {
        if (this.getNotificationSetting() && Notification.permission === 'granted') {
            this.sendTestNotification('Друг поблизости!', {
                body: `${friendName} находится в ${distance.toFixed(1)} км от вас`,
                tag: 'nearby-friend',
                requireInteraction: false
            });
        }
    },
    
    // Отправляем уведомление о новом запросе в друзья
    sendFriendRequestNotification: function(fromUser) {
        if (this.getNotificationSetting() && Notification.permission === 'granted') {
            this.sendTestNotification('Новый запрос в друзья', {
                body: `${fromUser.nickname} хочет добавить вас в друзья`,
                tag: 'friend-request',
                requireInteraction: true
            });
        }
    },
    
    // Инициализация Service Worker для Push уведомлений
    initializeServiceWorker: function() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.register('sw.js').catch(error => {
                console.log('Service Worker registration failed:', error);
            });
        }
    }
};

