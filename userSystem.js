// Единая система управления пользователями для MeetUP
const UserSystem = {
    // Получить всех пользователей
    getUsers: function() {
        try {
            return JSON.parse(localStorage.getItem('meetup_users') || '[]');
        } catch(e) {
            return [];
        }
    },

    // Сохранить пользователей
    saveUsers: function(users) {
        localStorage.setItem('meetup_users', JSON.stringify(users));
    },

    // Создать ID пользователя
    generateUserId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Найти пользователя по email/никнейму
    findUser: function(identity) {
        identity = identity.trim().toLowerCase();
        const users = this.getUsers();
        return users.find(u => 
            (u.email && u.email.toLowerCase() === identity) ||
            (u.nickname && u.nickname.toLowerCase() === identity)
        );
    },

    // Проверить занятость email
    isEmailUsed: function(email) {
        const users = this.getUsers();
        return users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    },

    // Проверить занятость никнейма
    isNicknameUsed: function(nickname) {
        const users = this.getUsers();
        return users.some(u => u.nickname && u.nickname.toLowerCase() === nickname.toLowerCase());
    },

    // Получить текущего пользователя
    getCurrentUser: function() {
        try {
            return JSON.parse(localStorage.getItem('meetup_current_user'));
        } catch(e) {
            return null;
        }
    },

    // Установить текущего пользователя
    setCurrentUser: function(user) {
        localStorage.setItem('meetup_current_user', JSON.stringify(user));
    },

    // Выйти из системы
    logout: function() {
        localStorage.removeItem('meetup_current_user');
    },

    // Хэш пароля (упрощенный для демо)
    hashPassword: function(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            hash = ((hash << 5) - hash) + password.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString();
    },

    // Запомнить файл аватара как base64
    fileToBase64: function(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    },

    // Поиск пользователей по никнейму (для добавления в друзья)
    searchUsers: function(query, excludeCurrent = true) {
        const users = this.getUsers();
        const currentUser = this.getCurrentUser();
        const queryLower = query.toLowerCase().trim();
        
        return users.filter(user => {
            // Исключаем текущего пользователя если нужно
            if (excludeCurrent && currentUser && user.id === currentUser.id) {
                return false;
            }
            
            // Поиск по никнейму
            return user.nickname && user.nickname.toLowerCase().includes(queryLower);
        });
    },

    // Добавить в друзья
    addFriendRequest: function(fromUserId, toUserId) {
        const requests = JSON.parse(localStorage.getItem('meetup_friend_requests') || '[]');
        
        // Проверяем, нет ли уже такого запроса
        const existingRequest = requests.find(req => 
            req.fromUserId === fromUserId && req.toUserId === toUserId
        );
        
        if (!existingRequest) {
            requests.push({
                fromUserId,
                toUserId,
                timestamp: Date.now(),
                status: 'pending'
            });
            localStorage.setItem('meetup_friend_requests', JSON.stringify(requests));
            return true;
        }
        return false;
    },

    // Получить входящие запросы в друзья
    getIncomingRequests: function(userId) {
        const requests = JSON.parse(localStorage.getItem('meetup_friend_requests') || '[]');
        const users = this.getUsers();
        
        return requests
            .filter(req => req.toUserId === userId && req.status === 'pending')
            .map(req => {
                const fromUser = users.find(u => u.id === req.fromUserId);
                return {
                    ...req,
                    fromUser: fromUser ? {
                        id: fromUser.id,
                        nickname: fromUser.nickname,
                        avatar: fromUser.avatar,
                        status: fromUser.status || 'offline'
                    } : null
                };
            })
            .filter(req => req.fromUser !== null);
    },

    // Обновить позицию пользователя на карте
    updateUserPosition: function(userId, position) {
        const users = this.getUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex !== -1) {
            users[userIndex].position = position;
            users[userIndex].lastSeen = new Date().toISOString();
            this.saveUsers(users);
            
            // Обновляем текущего пользователя если это он
            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                this.setCurrentUser(users[userIndex]);
            }
        }
    },

    // Получить друзей пользователя
    getUserFriends: function(userId) {
        // Временная реализация - возвращаем пустой массив
        // Можно расширить для реальной системы друзей
        return [];
    },

    // Очистка удаленных аккаунтов
    cleanupDeletedAccounts: function() {
        const users = this.getUsers();
        const now = Date.now();
        
        const activeUsers = users.filter(user => {
            if (user.scheduledForDeletion && user.scheduledForDeletion <= now) {
                console.log('Удален аккаунт:', user.nickname);
                return false;
            }
            return true;
        });
        
        if (activeUsers.length !== users.length) {
            this.saveUsers(activeUsers);
        }
    }
};

// Автоматическая очистка при загрузке
document.addEventListener('DOMContentLoaded', function() {
    UserSystem.cleanupDeletedAccounts();
});