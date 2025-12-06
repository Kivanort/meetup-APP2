// ============================================
// СИСТЕМА УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ
// ============================================

const UserSystem = {
    // ============ ОСНОВНЫЕ ФУНКЦИИ ============
    
    // Получить всех пользователей (с кешированием)
    getUsers: function() {
        try {
            // Проверяем кеш в памяти
            if (this._usersCache) {
                return this._usersCache;
            }
            
            const usersJson = localStorage.getItem('meetup_users');
            if (!usersJson) {
                this._usersCache = [];
                return [];
            }
            
            const users = JSON.parse(usersJson);
            
            // Валидация данных пользователей
            const validatedUsers = users.map(user => this.validateUserData(user));
            
            this._usersCache = validatedUsers;
            return validatedUsers;
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            this._usersCache = [];
            return [];
        }
    },

    // Сохранить всех пользователей
    saveUsers: function(users) {
        try {
            // Валидация перед сохранением
            const validatedUsers = users.map(user => this.validateUserData(user));
            
            localStorage.setItem('meetup_users', JSON.stringify(validatedUsers));
            
            // Обновляем кеш
            this._usersCache = validatedUsers;
            
            // Создаем резервную копию
            this.createBackup();
            
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
            
            // Проверяем уникальность email и nickname
            if (this.isEmailUsed(userData.email)) {
                throw new Error('Email уже используется');
            }
            
            if (this.isNicknameUsed(userData.nickname)) {
                throw new Error('Никнейм уже занят');
            }

            // Создаем полный объект пользователя
            const newUser = {
                id: this.generateUserId(),
                email: userData.email.toLowerCase().trim(),
                nickname: userData.nickname.trim(),
                password: this.hashPassword(userData.password),
                avatar: userData.avatar || '',
                status: userData.status || 'online',
                invisible: userData.invisible || false,
                registeredAt: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                lastActive: Date.now(),
                position: userData.position || [55.751244, 37.618423],
                about: userData.about || '',
                stats: {
                    friendsCount: 0,
                    totalDistance: 0,
                    onlineHours: 0,
                    totalFriends: 0,
                    meetingCount: 0
                },
                settings: {
                    notifications: true,
                    showOnMap: true,
                    privacy: 'public',
                    theme: 'dark'
                },
                metadata: {
                    version: 2,
                    created: Date.now(),
                    modified: Date.now()
                },
                isVerified: false,
                isActive: true
            };

            users.push(newUser);
            
            if (this.saveUsers(users)) {
                // Создаем профиль активности
                this.createUserActivityProfile(newUser.id);
                return newUser;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Ошибка создания пользователя:', error);
            throw error;
        }
    },

    // Обновить данные пользователя
    updateUser: function(userId, updates) {
        try {
            const users = this.getUsers();
            const userIndex = users.findIndex(u => u.id === userId);
            
            if (userIndex === -1) {
                throw new Error('Пользователь не найден');
            }

            // Обновляем только разрешенные поля
            const allowedFields = [
                'nickname', 'avatar', 'status', 'invisible',
                'position', 'about', 'settings', 'stats'
            ];
            
            const updatedUser = { ...users[userIndex] };
            
            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    if (key === 'nickname' && this.isNicknameUsed(updates[key], userId)) {
                        throw new Error('Никнейм уже занят');
                    }
                    updatedUser[key] = updates[key];
                }
            });

            updatedUser.metadata.modified = Date.now();
            updatedUser.lastSeen = new Date().toISOString();
            updatedUser.lastActive = Date.now();

            users[userIndex] = updatedUser;
            
            if (this.saveUsers(users)) {
                // Обновляем текущего пользователя если это он
                const currentUser = this.getCurrentUser();
                if (currentUser && currentUser.id === userId) {
                    this.setCurrentUser(updatedUser);
                }
                
                return updatedUser;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Ошибка обновления пользователя:', error);
            throw error;
        }
    },

    // Удалить пользователя
    deleteUser: function(userId) {
        try {
            const users = this.getUsers();
            const filteredUsers = users.filter(u => u.id !== userId);
            
            if (filteredUsers.length === users.length) {
                throw new Error('Пользователь не найден');
            }

            // Удаляем связанные данные
            this.cleanupUserData(userId);
            
            // Обновляем текущего пользователя если это он
            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                this.logout();
            }

            return this.saveUsers(filteredUsers);
        } catch (error) {
            console.error('❌ Ошибка удаления пользователя:', error);
            return false;
        }
    },

    // ============ ПОИСК И ПРОВЕРКИ ============
    
    // Найти пользователя
    findUser: function(identifier) {
        if (!identifier || typeof identifier !== 'string') return null;
        
        const searchTerm = identifier.trim().toLowerCase();
        const users = this.getUsers();
        
        return users.find(user => 
            (user.email && user.email.toLowerCase() === searchTerm) ||
            (user.nickname && user.nickname.toLowerCase() === searchTerm) ||
            (user.id && user.id.toLowerCase() === searchTerm)
        );
    },

    // Проверить занятость email
    isEmailUsed: function(email, excludeUserId = null) {
        if (!email || typeof email !== 'string') return false;
        
        const searchEmail = email.toLowerCase().trim();
        const users = this.getUsers();
        
        return users.some(user => 
            user.email && 
            user.email.toLowerCase() === searchEmail &&
            (!excludeUserId || user.id !== excludeUserId)
        );
    },

    // Проверить занятость никнейма
    isNicknameUsed: function(nickname, excludeUserId = null) {
        if (!nickname || typeof nickname !== 'string') return false;
        
        const searchNickname = nickname.trim().toLowerCase();
        const users = this.getUsers();
        
        return users.some(user => 
            user.nickname && 
            user.nickname.toLowerCase() === searchNickname &&
            (!excludeUserId || user.id !== excludeUserId)
        );
    },

    // ============ АВТОРИЗАЦИЯ ============
    
    // Получить текущего пользователя
    getCurrentUser: function() {
        try {
            const userJson = localStorage.getItem('meetup_current_user');
            if (!userJson) return null;
            
            const user = JSON.parse(userJson);
            return this.validateUserData(user);
        } catch (error) {
            console.error('❌ Ошибка загрузки текущего пользователя:', error);
            localStorage.removeItem('meetup_current_user');
            return null;
        }
    },

    // Установить текущего пользователя
    setCurrentUser: function(user) {
        try {
            const validatedUser = this.validateUserData(user);
            localStorage.setItem('meetup_current_user', JSON.stringify(validatedUser));
            
            // Обновляем активность
            this.updateUserActivity(user.id);
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения текущего пользователя:', error);
            return false;
        }
    },

    // Вход в систему
    login: function(identifier, password) {
        try {
            const user = this.findUser(identifier);
            
            if (!user) {
                throw new Error('Пользователь не найден');
            }

            if (user.password !== this.hashPassword(password)) {
                throw new Error('Неверный пароль');
            }

            if (!user.isActive) {
                throw new Error('Аккаунт деактивирован');
            }

            // Обновляем данные пользователя
            const updatedUser = this.updateUser(user.id, {
                status: 'online',
                lastSeen: new Date().toISOString()
            });

            if (!updatedUser) {
                throw new Error('Ошибка обновления данных пользователя');
            }

            // Устанавливаем как текущего
            this.setCurrentUser(updatedUser);
            
            return updatedUser;
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            throw error;
        }
    },

    // Выход из системы
    logout: function() {
        try {
            const currentUser = this.getCurrentUser();
            
            if (currentUser) {
                // Устанавливаем статус "не в сети"
                this.updateUser(currentUser.id, {
                    status: 'offline',
                    lastSeen: new Date().toISOString()
                });
            }
            
            localStorage.removeItem('meetup_current_user');
            return true;
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            return false;
        }
    },

    // ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
    
    // Генерация ID пользователя
    generateUserId: function() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `usr_${timestamp}_${random}`;
    },

    // Хэширование пароля
    hashPassword: function(password) {
        if (!password || typeof password !== 'string') return '';
        
        // Более безопасный хэш
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        // Добавляем соль
        const salt = 'meetup_system_2024';
        const saltedHash = hash.toString(16) + salt;
        
        // Второй проход хэширования
        let finalHash = 0;
        for (let i = 0; i < saltedHash.length; i++) {
            const char = saltedHash.charCodeAt(i);
            finalHash = ((finalHash << 5) - finalHash) + char;
            finalHash = finalHash & finalHash;
        }
        
        return finalHash.toString(16);
    },

    // Конвертация файла в base64
    fileToBase64: function(file) {
        return new Promise((resolve, reject) => {
            if (!file || !(file instanceof Blob)) {
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

    // ============ ПОИСК И ФИЛЬТРАЦИЯ ============
    
    // Поиск пользователей
    searchUsers: function(query, options = {}) {
        const {
            excludeCurrent = true,
            onlyOnline = false,
            limit = 50,
            offset = 0
        } = options;
        
        if (!query || query.trim().length < 2) {
            return [];
        }
        
        const searchTerm = query.trim().toLowerCase();
        const users = this.getUsers();
        const currentUser = this.getCurrentUser();
        
        let results = users.filter(user => {
            // Исключаем текущего пользователя
            if (excludeCurrent && currentUser && user.id === currentUser.id) {
                return false;
            }
            
            // Фильтрация по статусу
            if (onlyOnline && (user.status !== 'online' || user.invisible)) {
                return false;
            }
            
            // Поиск по никнейму
            if (user.nickname && user.nickname.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            return false;
        });
        
        // Сортировка: сначала онлайн, потом по алфавиту
        results.sort((a, b) => {
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (a.status !== 'online' && b.status === 'online') return 1;
            return (a.nickname || '').localeCompare(b.nickname || '');
        });
        
        // Применяем пагинацию
        return results.slice(offset, offset + limit);
    },

    // ============ ДРУЗЬЯ И СОЦИАЛЬНЫЕ ФУНКЦИИ ============
    
    // Получить список друзей
    getUserFriends: function(userId) {
        try {
            const requests = this.getFriendRequests();
            const users = this.getUsers();
            
            const friendRequests = requests.filter(req => 
                (req.fromUserId === userId || req.toUserId === userId) && 
                req.status === 'accepted'
            );
            
            return friendRequests.map(req => {
                const friendId = req.fromUserId === userId ? req.toUserId : req.fromUserId;
                return users.find(u => u.id === friendId);
            }).filter(friend => friend !== undefined);
        } catch (error) {
            console.error('❌ Ошибка получения друзей:', error);
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
                if (existingRequest.status === 'rejected') {
                    throw new Error('Запрос был отклонен ранее');
                }
            }

            const newRequest = {
                id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fromUserId: fromUserId,
                toUserId: toUserId,
                timestamp: Date.now(),
                status: 'pending',
                metadata: {
                    version: 1,
                    created: Date.now()
                }
            };

            requests.push(newRequest);
            localStorage.setItem('meetup_friend_requests', JSON.stringify(requests));
            
            // Обновляем статистику
            this.updateUserStats(fromUserId, 'sentRequests', 1);
            
            return newRequest;
        } catch (error) {
            console.error('❌ Ошибка отправки запроса в друзья:', error);
            throw error;
        }
    },

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

    // Получить входящие запросы
    getIncomingRequests: function(userId) {
        try {
            const requests = this.getFriendRequests();
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
                            status: fromUser.status
                        } : null
                    };
                })
                .filter(req => req.fromUser !== null);
        } catch (error) {
            console.error('❌ Ошибка получения входящих запросов:', error);
            return [];
        }
    },

    // Принять запрос в друзья
    acceptFriendRequest: function(requestId) {
        try {
            const requests = this.getFriendRequests();
            const requestIndex = requests.findIndex(req => req.id === requestId);
            
            if (requestIndex === -1) {
                throw new Error('Запрос не найден');
            }

            requests[requestIndex].status = 'accepted';
            requests[requestIndex].acceptedAt = Date.now();
            
            localStorage.setItem('meetup_friend_requests', JSON.stringify(requests));
            
            // Обновляем статистику обоих пользователей
            const request = requests[requestIndex];
            this.updateUserStats(request.fromUserId, 'friendsCount', 1);
            this.updateUserStats(request.toUserId, 'friendsCount', 1);
            
            return requests[requestIndex];
        } catch (error) {
            console.error('❌ Ошибка принятия запроса в друзья:', error);
            throw error;
        }
    },

    // Отклонить запрос в друзья
    rejectFriendRequest: function(requestId) {
        try {
            const requests = this.getFriendRequests();
            const requestIndex = requests.findIndex(req => req.id === requestId);
            
            if (requestIndex === -1) {
                throw new Error('Запрос не найден');
            }

            requests[requestIndex].status = 'rejected';
            requests[requestIndex].rejectedAt = Date.now();
            
            localStorage.setItem('meetup_friend_requests', JSON.stringify(requests));
            
            return requests[requestIndex];
        } catch (error) {
            console.error('❌ Ошибка отклонения запроса в друзья:', error);
            throw error;
        }
    },

    // ============ КАРТА И ГЕОЛОКАЦИЯ ============
    
    // Обновить позицию пользователя
    updateUserPosition: function(userId, position) {
        try {
            const user = this.findUser(userId);
            
            if (!user) {
                throw new Error('Пользователь не найден');
            }

            if (!Array.isArray(position) || position.length !== 2) {
                throw new Error('Некорректные координаты');
            }

            // Проверяем корректность координат
            const [lat, lng] = position;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                throw new Error('Некорректные координаты');
            }

            // Обновляем позицию
            const updatedUser = this.updateUser(userId, {
                position: position,
                lastSeen: new Date().toISOString(),
                lastActive: Date.now()
            });

            // Записываем в историю перемещений
            this.recordUserMovement(userId, position);
            
            return updatedUser;
        } catch (error) {
            console.error('❌ Ошибка обновления позиции:', error);
            throw error;
        }
    },

    // Получить пользователей рядом
    getNearbyUsers: function(position, radius = 10) {
        try {
            const users = this.getUsers();
            const currentUser = this.getCurrentUser();
            
            return users.filter(user => {
                // Исключаем текущего пользователя и скрытых
                if (user.id === currentUser?.id || user.invisible || !user.position) {
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

    // ============ ВАЛИДАЦИЯ И ОЧИСТКА ============
    
    // Валидация данных пользователя
    validateUserData: function(user) {
        if (!user || typeof user !== 'object') {
            return this.getDefaultUser();
        }

        // Базовые обязательные поля
        const validated = {
            id: user.id || this.generateUserId(),
            email: user.email ? user.email.toLowerCase().trim() : '',
            nickname: user.nickname ? user.nickname.trim() : 'Пользователь',
            password: user.password || '',
            avatar: user.avatar || '',
            status: ['online', 'offline', 'away'].includes(user.status) ? user.status : 'offline',
            invisible: Boolean(user.invisible),
            registeredAt: user.registeredAt || new Date().toISOString(),
            lastSeen: user.lastSeen || new Date().toISOString(),
            lastActive: user.lastActive || Date.now(),
            position: Array.isArray(user.position) ? user.position : [55.751244, 37.618423],
            about: user.about || '',
            stats: {
                friendsCount: Number(user.stats?.friendsCount) || 0,
                totalDistance: Number(user.stats?.totalDistance) || 0,
                onlineHours: Number(user.stats?.onlineHours) || 0,
                totalFriends: Number(user.stats?.totalFriends) || 0,
                meetingCount: Number(user.stats?.meetingCount) || 0
            },
            settings: {
                notifications: Boolean(user.settings?.notifications ?? true),
                showOnMap: Boolean(user.settings?.showOnMap ?? true),
                privacy: ['public', 'friends', 'private'].includes(user.settings?.privacy) 
                    ? user.settings.privacy 
                    : 'public',
                theme: ['dark', 'light', 'auto'].includes(user.settings?.theme) 
                    ? user.settings.theme 
                    : 'dark'
            },
            metadata: {
                version: 2,
                created: user.metadata?.created || Date.now(),
                modified: Date.now()
            },
            isVerified: Boolean(user.isVerified),
            isActive: Boolean(user.isActive ?? true)
        };

        return validated;
    },

    // Создать пользователя по умолчанию
    getDefaultUser: function() {
        return {
            id: this.generateUserId(),
            email: '',
            nickname: 'Пользователь',
            password: '',
            avatar: '',
            status: 'offline',
            invisible: false,
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            lastActive: Date.now(),
            position: [55.751244, 37.618423],
            about: '',
            stats: {
                friendsCount: 0,
                totalDistance: 0,
                onlineHours: 0,
                totalFriends: 0,
                meetingCount: 0
            },
            settings: {
                notifications: true,
                showOnMap: true,
                privacy: 'public',
                theme: 'dark'
            },
            metadata: {
                version: 2,
                created: Date.now(),
                modified: Date.now()
            },
            isVerified: false,
            isActive: true
        };
    },

    // Очистка данных пользователя
    cleanupUserData: function(userId) {
        try {
            // Удаляем запросы в друзья
            const requests = this.getFriendRequests();
            const filteredRequests = requests.filter(req => 
                req.fromUserId !== userId && req.toUserId !== userId
            );
            localStorage.setItem('meetup_friend_requests', JSON.stringify(filteredRequests));
            
            // Удаляем активность
            localStorage.removeItem(`user_activity_${userId}`);
            localStorage.removeItem(`user_movements_${userId}`);
            localStorage.removeItem(`user_stats_${userId}`);
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка очистки данных пользователя:', error);
            return false;
        }
    },

    // Автоматическая очистка старых данных
    cleanupOldData: function() {
        try {
            const users = this.getUsers();
            const now = Date.now();
            
            // Удаляем неактивные аккаунты (более 30 дней)
            const activeUsers = users.filter(user => {
                if (user.scheduledForDeletion && user.scheduledForDeletion <= now) {
                    console.log(`🗑️ Удален аккаунт: ${user.nickname}`);
                    this.cleanupUserData(user.id);
                    return false;
                }
                return true;
            });
            
            if (activeUsers.length !== users.length) {
                this.saveUsers(activeUsers);
            }
            
            // Очищаем старые запросы в друзья (более 30 дней)
            this.cleanupOldFriendRequests();
            
            console.log('✅ Очистка данных завершена');
        } catch (error) {
            console.error('❌ Ошибка очистки данных:', error);
        }
    },

    // ============ УТИЛИТЫ И РАСЧЕТЫ ============
    
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

    // Запись перемещения пользователя
    recordUserMovement: function(userId, position) {
        try {
            const key = `user_movements_${userId}`;
            const movements = JSON.parse(localStorage.getItem(key) || '[]');
            
            movements.push({
                position: position,
                timestamp: Date.now()
            });
            
            // Ограничиваем историю последними 100 записями
            if (movements.length > 100) {
                movements.splice(0, movements.length - 100);
            }
            
            localStorage.setItem(key, JSON.stringify(movements));
            
            // Обновляем общее расстояние
            if (movements.length >= 2) {
                const lastPos = movements[movements.length - 2].position;
                const distance = this.calculateDistance(lastPos, position);
                
                if (distance > 0) {
                    this.updateUserStats(userId, 'totalDistance', distance);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка записи перемещения:', error);
        }
    },

    // Создание профиля активности
    createUserActivityProfile: function(userId) {
        try {
            const activity = {
                userId: userId,
                created: Date.now(),
                sessions: [],
                totalOnlineTime: 0,
                lastLogin: Date.now()
            };
            
            localStorage.setItem(`user_activity_${userId}`, JSON.stringify(activity));
        } catch (error) {
            console.error('❌ Ошибка создания профиля активности:', error);
        }
    },

    // Обновление активности
    updateUserActivity: function(userId) {
        try {
            const key = `user_activity_${userId}`;
            const activity = JSON.parse(localStorage.getItem(key) || '{}');
            
            activity.lastActive = Date.now();
            activity.totalOnlineTime = (activity.totalOnlineTime || 0) + 1; // Упрощенный вариант
            
            localStorage.setItem(key, JSON.stringify(activity));
        } catch (error) {
            console.error('❌ Ошибка обновления активности:', error);
        }
    },

    // Обновление статистики
    updateUserStats: function(userId, statName, value) {
        try {
            const users = this.getUsers();
            const userIndex = users.findIndex(u => u.id === userId);
            
            if (userIndex !== -1 && users[userIndex].stats[statName] !== undefined) {
                users[userIndex].stats[statName] += value;
                this.saveUsers(users);
            }
        } catch (error) {
            console.error('❌ Ошибка обновления статистики:', error);
        }
    },

    // ============ РЕЗЕРВНОЕ КОПИРОВАНИЕ ============
    
    // Создать резервную копию
    createBackup: function() {
        try {
            const backup = {
                users: this.getUsers(),
                friendRequests: this.getFriendRequests(),
                timestamp: Date.now(),
                version: '2.0'
            };
            
            localStorage.setItem('meetup_backup', JSON.stringify(backup));
            
            // Храним только последние 5 резервных копий
            const backups = JSON.parse(localStorage.getItem('meetup_backups') || '[]');
            backups.push(backup);
            
            if (backups.length > 5) {
                backups.shift();
            }
            
            localStorage.setItem('meetup_backups', JSON.stringify(backups));
        } catch (error) {
            console.error('❌ Ошибка создания резервной копии:', error);
        }
    },

    // Восстановить из резервной копии
    restoreFromBackup: function() {
        try {
            const backup = JSON.parse(localStorage.getItem('meetup_backup') || 'null');
            
            if (!backup) {
                throw new Error('Резервная копия не найдена');
            }
            
            if (backup.users) {
                localStorage.setItem('meetup_users', JSON.stringify(backup.users));
            }
            
            if (backup.friendRequests) {
                localStorage.setItem('meetup_friend_requests', JSON.stringify(backup.friendRequests));
            }
            
            // Очищаем кеш
            this._usersCache = null;
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка восстановления из резервной копии:', error);
            return false;
        }
    },

    // Очистка старых запросов в друзья
    cleanupOldFriendRequests: function() {
        try {
            const requests = this.getFriendRequests();
            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            
            const activeRequests = requests.filter(req => {
                // Удаляем отклоненные запросы старше 7 дней
                if (req.status === 'rejected' && req.timestamp < (now - 7 * 24 * 60 * 60 * 1000)) {
                    return false;
                }
                
                // Удаляем все запросы старше 30 дней
                if (req.timestamp < thirtyDaysAgo) {
                    return false;
                }
                
                return true;
            });
            
            if (activeRequests.length !== requests.length) {
                localStorage.setItem('meetup_friend_requests', JSON.stringify(activeRequests));
                console.log(`🗑️ Удалено ${requests.length - activeRequests.length} старых запросов в друзья`);
            }
        } catch (error) {
            console.error('❌ Ошибка очистки старых запросов:', error);
        }
    },

    // ============ МИГРАЦИЯ ДАННЫХ ============
    
    // Миграция старых данных
    migrateOldData: function() {
        try {
            const users = this.getUsers();
            let migrated = false;
            
            // Проверяем версию данных
            users.forEach((user, index) => {
                if (!user.metadata || user.metadata.version < 2) {
                    // Мигрируем старые данные
                    const migratedUser = this.validateUserData(user);
                    users[index] = migratedUser;
                    migrated = true;
                    console.log(`🔄 Мигрирован пользователь: ${user.nickname}`);
                }
            });
            
            if (migrated) {
                this.saveUsers(users);
                console.log('✅ Миграция данных завершена');
            }
        } catch (error) {
            console.error('❌ Ошибка миграции данных:', error);
        }
    },

    // ============ СТАТИСТИКА ============
    
    // Получить статистику системы
    getSystemStats: function() {
        try {
            const users = this.getUsers();
            const requests = this.getFriendRequests();
            
            return {
                totalUsers: users.length,
                onlineUsers: users.filter(u => u.status === 'online' && !u.invisible).length,
                totalFriendships: requests.filter(r => r.status === 'accepted').length,
                pendingRequests: requests.filter(r => r.status === 'pending').length,
                activeToday: users.filter(u => {
                    const lastActive = new Date(u.lastActive);
                    const today = new Date();
                    return lastActive.toDateString() === today.toDateString();
                }).length,
                averageFriends: users.reduce((sum, user) => sum + user.stats.friendsCount, 0) / users.length || 0
            };
        } catch (error) {
            console.error('❌ Ошибка получения статистики:', error);
            return null;
        }
    }
};

// ============ АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ ============

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Инициализация UserSystem...');
    
    // Миграция старых данных
    UserSystem.migrateOldData();
    
    // Очистка старых данных
    UserSystem.cleanupOldData();
    
    // Создаем резервную копию
    UserSystem.createBackup();
    
    console.log('✅ UserSystem инициализирован');
    
    // Периодическая очистка (каждые 5 минут)
    setInterval(() => {
        UserSystem.cleanupOldData();
    }, 5 * 60 * 1000);
});

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserSystem;
}
