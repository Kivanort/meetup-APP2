// ============================================
// ПРОСТАЯ И РАБОЧАЯ СИСТЕМА УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ
// ============================================

const UserSystem = {
    
    // ============ ОСНОВНЫЕ ФУНКЦИИ ============
    
    // Получить всех пользователей
    getUsers: function() {
        try {
            const usersJson = localStorage.getItem('meetup_users');
            if (!usersJson) {
                console.log('📁 Пользователи не найдены, создаем тестового...');
                
                // Создаем тестового пользователя
                const testUser = {
                    id: 'test_user_' + Date.now(),
                    email: 'test@test.com',
                    nickname: 'Тестовый',
                    password: this.hashPassword('Test12345'),
                    avatar: '',
                    status: 'online',
                    registeredAt: new Date().toISOString(),
                    lastSeen: new Date().toISOString(),
                    position: [55.751244, 37.618423],
                    stats: {
                        friendsCount: 0,
                        totalDistance: 0,
                        onlineHours: 0
                    },
                    settings: {
                        notifications: true,
                        showOnMap: true
                    }
                };
                
                localStorage.setItem('meetup_users', JSON.stringify([testUser]));
                console.log('✅ Тестовый пользователь создан');
                console.log('📧 Email: test@test.com');
                console.log('🔑 Пароль: Test12345');
                
                return [testUser];
            }
            
            const users = JSON.parse(usersJson);
            
            // Убедимся, что все пользователи имеют корректные данные
            return users.map(user => ({
                id: user.id || 'usr_' + Date.now(),
                email: (user.email || '').toLowerCase().trim(),
                nickname: user.nickname || 'Пользователь',
                password: user.password || '',
                avatar: user.avatar || '',
                status: user.status || 'offline',
                registeredAt: user.registeredAt || new Date().toISOString(),
                lastSeen: user.lastSeen || new Date().toISOString(),
                position: user.position || [55.751244, 37.618423],
                stats: user.stats || { friendsCount: 0 },
                settings: user.settings || { notifications: true }
            }));
            
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            return [];
        }
    },

    // Сохранить всех пользователей
    saveUsers: function(users) {
        try {
            localStorage.setItem('meetup_users', JSON.stringify(users));
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения пользователей:', error);
            return false;
        }
    },

    // Создать нового пользователя
    createUser: function(userData) {
        try {
            const users = this.getUsers();
            
            console.log('📝 Создание пользователя:', {
                email: userData.email,
                nickname: userData.nickname
            });
            
            // Проверяем уникальность email
            if (this.isEmailUsed(userData.email)) {
                console.log('❌ Email уже используется:', userData.email);
                throw new Error('Email уже используется');
            }
            
            // Проверяем уникальность никнейма
            if (this.isNicknameUsed(userData.nickname)) {
                console.log('❌ Никнейм уже занят:', userData.nickname);
                throw new Error('Никнейм уже занят');
            }

            // Хешируем пароль
            const hashedPassword = this.hashPassword(userData.password);
            
            console.log('🔐 Хеширование пароля:', {
                оригинал: userData.password,
                хеш: hashedPassword
            });

            // Создаем объект пользователя
            const newUser = {
                id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                email: userData.email.toLowerCase().trim(),
                nickname: userData.nickname.trim(),
                password: hashedPassword,
                avatar: userData.avatar || '',
                status: 'online',
                registeredAt: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                position: userData.position || [55.751244, 37.618423],
                stats: {
                    friendsCount: 0,
                    totalDistance: 0,
                    onlineHours: 0
                },
                settings: {
                    notifications: true,
                    showOnMap: true,
                    privacy: 'public',
                    theme: 'dark'
                }
            };

            users.push(newUser);
            
            if (this.saveUsers(users)) {
                console.log('✅ Пользователь создан:', newUser.email);
                return newUser;
            } else {
                throw new Error('Не удалось сохранить пользователя');
            }
            
        } catch (error) {
            console.error('❌ Ошибка создания пользователя:', error.message);
            throw error;
        }
    },

    // ============ ПОИСК И ПРОВЕРКИ ============
    
    // Найти пользователя
    findUser: function(identifier) {
        if (!identifier || typeof identifier !== 'string') {
            console.log('⚠️ Пустой идентификатор для поиска');
            return null;
        }
        
        const searchTerm = identifier.toLowerCase().trim();
        const users = this.getUsers();
        
        console.log('🔍 Поиск пользователя:', searchTerm);
        
        // Сначала ищем по email
        let user = users.find(u => u.email && u.email.toLowerCase() === searchTerm);
        
        // Если не нашли по email, ищем по nickname
        if (!user) {
            user = users.find(u => u.nickname && u.nickname.toLowerCase() === searchTerm);
        }
        
        if (user) {
            console.log('✅ Пользователь найден:', user.email);
        } else {
            console.log('❌ Пользователь не найден');
        }
        
        return user;
    },

    // Проверить занятость email
    isEmailUsed: function(email) {
        if (!email) return false;
        
        const searchEmail = email.toLowerCase().trim();
        const users = this.getUsers();
        
        return users.some(user => user.email === searchEmail);
    },

    // Проверить занятость никнейма
    isNicknameUsed: function(nickname) {
        if (!nickname) return false;
        
        const searchNickname = nickname.toLowerCase().trim();
        const users = this.getUsers();
        
        return users.some(user => user.nickname.toLowerCase() === searchNickname);
    },

    // ============ АВТОРИЗАЦИЯ ============
    
    // Получить текущего пользователя
    getCurrentUser: function() {
        try {
            const userJson = localStorage.getItem('meetup_current_user');
            if (!userJson) {
                console.log('👤 Текущий пользователь не найден');
                return null;
            }
            
            const user = JSON.parse(userJson);
            console.log('👤 Текущий пользователь:', user.email);
            return user;
        } catch (error) {
            console.error('❌ Ошибка загрузки текущего пользователя:', error);
            localStorage.removeItem('meetup_current_user');
            return null;
        }
    },

    // Установить текущего пользователя
    setCurrentUser: function(user) {
        try {
            localStorage.setItem('meetup_current_user', JSON.stringify(user));
            console.log('✅ Текущий пользователь установлен:', user.email);
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения текущего пользователя:', error);
            return false;
        }
    },

    // Вход в систему (РАБОЧАЯ ВЕРСИЯ)
    login: function(identifier, password) {
        try {
            console.log('🔐 Попытка входа для:', identifier);
            
            // Ищем пользователя
            const user = this.findUser(identifier);
            
            if (!user) {
                console.log('❌ Пользователь не найден:', identifier);
                throw new Error('Пользователь не найден');
            }

            // Хешируем введенный пароль
            const hashedPassword = this.hashPassword(password);
            
            console.log('🔐 Сравнение паролей:', {
                email: user.email,
                storedHash: user.password,
                inputHash: hashedPassword,
                match: user.password === hashedPassword
            });

            if (user.password !== hashedPassword) {
                console.log('❌ Неверный пароль для пользователя:', user.email);
                throw new Error('Неверный пароль');
            }

            // Обновляем статус и время последнего входа
            const users = this.getUsers();
            const userIndex = users.findIndex(u => u.id === user.id);
            
            if (userIndex !== -1) {
                users[userIndex].status = 'online';
                users[userIndex].lastSeen = new Date().toISOString();
                this.saveUsers(users);
            }

            // Устанавливаем как текущего пользователя
            this.setCurrentUser({
                ...user,
                status: 'online',
                lastSeen: new Date().toISOString()
            });
            
            console.log('✅ Успешный вход:', user.email);
            return user;
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error.message);
            throw error;
        }
    },

    // Выход из системы
    logout: function() {
        try {
            const currentUser = this.getCurrentUser();
            
            if (currentUser) {
                // Обновляем статус пользователя
                const users = this.getUsers();
                const userIndex = users.findIndex(u => u.id === currentUser.id);
                
                if (userIndex !== -1) {
                    users[userIndex].status = 'offline';
                    users[userIndex].lastSeen = new Date().toISOString();
                    this.saveUsers(users);
                }
                
                console.log('👋 Выход пользователя:', currentUser.email);
            }
            
            localStorage.removeItem('meetup_current_user');
            return true;
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            return false;
        }
    },

    // ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
    
    // Хеширование пароля (ОДИНАКОВЫЙ АЛГОРИТМ ВЕЗДЕ)
    hashPassword: function(password) {
        if (!password || typeof password !== 'string') {
            console.log('⚠️ Пустой пароль для хеширования');
            return '';
        }
        
        // Простой и стабильный алгоритм
        const salt = 'meetup_simple_salt';
        const saltedPassword = password + salt;
        
        let hash = 0;
        for (let i = 0; i < saltedPassword.length; i++) {
            const char = saltedPassword.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & 0xFFFFFFFF; // 32-битное целое
        }
        
        const result = hash.toString(16);
        console.log('🔐 Хеширование:', { пароль: password, хеш: result });
        return result;
    },

    // Конвертация файла в base64
    fileToBase64: function(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve('');
                return;
            }

            if (!(file instanceof Blob)) {
                reject(new Error('Некорректный файл'));
                return;
            }

            if (!file.type.startsWith('image/')) {
                reject(new Error('Файл должен быть изображением'));
                return;
            }

            // Проверяем размер файла (максимум 5MB)
            if (file.size > 5 * 1024 * 1024) {
                reject(new Error('Изображение должно быть меньше 5MB'));
                return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsDataURL(file);
        });
    },

    // Обновить данные пользователя
    updateUser: function(userId, updates) {
        try {
            const users = this.getUsers();
            const userIndex = users.findIndex(u => u.id === userId);
            
            if (userIndex === -1) {
                throw new Error('Пользователь не найден');
            }

            // Обновляем разрешенные поля
            const allowedFields = ['nickname', 'avatar', 'status', 'position', 'stats', 'settings'];
            const updatedUser = { ...users[userIndex] };
            
            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    if (key === 'nickname' && this.isNicknameUsed(updates[key], userId)) {
                        throw new Error('Никнейм уже занят');
                    }
                    updatedUser[key] = updates[key];
                }
            });

            updatedUser.lastSeen = new Date().toISOString();
            users[userIndex] = updatedUser;
            
            if (this.saveUsers(users)) {
                // Обновляем текущего пользователя если это он
                const currentUser = this.getCurrentUser();
                if (currentUser && currentUser.id === userId) {
                    this.setCurrentUser(updatedUser);
                }
                
                console.log('✅ Пользователь обновлен:', updatedUser.email);
                return updatedUser;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Ошибка обновления пользователя:', error);
            throw error;
        }
    },

    // Обновить позицию пользователя
    updateUserPosition: function(userId, position) {
        return this.updateUser(userId, {
            position: position,
            lastSeen: new Date().toISOString()
        });
    },

    // Получить пользователей рядом
    getNearbyUsers: function(position, radius = 10) {
        try {
            const users = this.getUsers();
            const currentUser = this.getCurrentUser();
            
            return users.filter(user => {
                // Исключаем текущего пользователя
                if (currentUser && user.id === currentUser.id) {
                    return false;
                }
                
                // Исключаем пользователей без позиции
                if (!user.position || !Array.isArray(user.position)) {
                    return false;
                }
                
                // Вычисляем расстояние
                const distance = this.calculateDistance(position, user.position);
                return distance <= radius;
            });
        } catch (error) {
            console.error('❌ Ошибка поиска пользователей рядом:', error);
            return [];
        }
    },

    // Вычисление расстояния между координатами
    calculateDistance: function(pos1, pos2) {
        const [lat1, lon1] = pos1;
        const [lat2, lon2] = pos2;
        
        const R = 6371; // Радиус Земли в км
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Расстояние в км
    },

    // ============ ДРУЗЬЯ ============
    
    // Получить запросы в друзья
    getFriendRequests: function() {
        try {
            const requestsJson = localStorage.getItem('meetup_friend_requests');
            return requestsJson ? JSON.parse(requestsJson) : [];
        } catch (error) {
            console.error('❌ Ошибка загрузки запросов в друзья:', error);
            return [];
        }
    },

    // Отправить запрос в друзья
    sendFriendRequest: function(fromUserId, toUserId) {
        try {
            if (fromUserId === toUserId) {
                throw new Error('Нельзя добавить себя в друзья');
            }

            const requests = this.getFriendRequests();
            
            // Проверяем существующий запрос
            const existingRequest = requests.find(req => 
                (req.fromUserId === fromUserId && req.toUserId === toUserId) ||
                (req.fromUserId === toUserId && req.toUserId === fromUserId)
            );
            
            if (existingRequest) {
                if (existingRequest.status === 'pending') {
                    throw new Error('Запрос уже отправлен');
                }
                if (existingRequest.status === 'accepted') {
                    throw new Error('Уже друзья');
                }
            }

            const newRequest = {
                id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fromUserId: fromUserId,
                toUserId: toUserId,
                timestamp: Date.now(),
                status: 'pending'
            };

            requests.push(newRequest);
            localStorage.setItem('meetup_friend_requests', JSON.stringify(requests));
            
            console.log('✅ Запрос в друзья отправлен');
            return newRequest;
        } catch (error) {
            console.error('❌ Ошибка отправки запроса в друзья:', error);
            throw error;
        }
    }
};

// ============ АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ ============

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Инициализация UserSystem...');
    
    // Создаем тестового пользователя если нужно
    UserSystem.getUsers();
    
    console.log('✅ UserSystem готов к работе');
    console.log('👤 Тестовые данные для входа:');
    console.log('📧 Email: test@test.com');
    console.log('🔑 Пароль: Test12345');
});

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserSystem;
}
