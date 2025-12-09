// ============================================
// ПОЛНАЯ СИСТЕМА УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ С ИСПРАВЛЕНИЯМИ
// ============================================

const UserSystem = {
    
    // ============ ОСНОВНЫЕ ФУНКЦИИ ============
    
    // Получить всех пользователей (БЕЗ КЕШИРОВАНИЯ)
    getUsers: function() {
        try {
            const usersJson = localStorage.getItem('meetup_users');
            if (!usersJson) {
                // Создаем тестового пользователя если нет ни одного
                const testUser = {
                    id: 'test_user_' + Date.now(),
                    email: 'test@test.com',
                    nickname: 'Тестовый',
                    password: this.hashPassword('Test12345'),
                    avatar: '',
                    status: 'online',
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
                        meetingCount: 0,
                        referralsCount: 0,
                        referralBonus: 0,
                        qrInvitations: 0,
                        qrInvitationsReceived: 0,
                        sentRequests: 0
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
                    referralCode: null,
                    referralGeneratedAt: null,
                    referredBy: null,
                    isVerified: false,
                    isActive: true
                };
                
                localStorage.setItem('meetup_users', JSON.stringify([testUser]));
                console.log('✅ Тестовый пользователь создан');
                console.log('📧 Email: test@test.com');
                console.log('🔑 Пароль: Test12345');
                
                return [testUser];
            }
            
            const users = JSON.parse(usersJson);
            
            // Валидация данных пользователей
            return users.map(user => this.validateUserData(user));
            
        } catch (error) {
            console.error('❌ Ошибка загрузки пользователей:', error);
            return [];
        }
    },

    // Сохранить всех пользователей
    saveUsers: function(users) {
        try {
            // Валидация перед сохранением
            const validatedUsers = users.map(user => this.validateUserData(user));
            
            localStorage.setItem('meetup_users', JSON.stringify(validatedUsers));
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения пользователей:', error);
            return false;
        }
    },

    // Валидация данных пользователя
    validateUserData: function(user) {
        if (!user || typeof user !== 'object') {
            return this.getDefaultUser();
        }

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
                meetingCount: Number(user.stats?.meetingCount) || 0,
                referralsCount: Number(user.stats?.referralsCount) || 0,
                referralBonus: Number(user.stats?.referralBonus) || 0,
                qrInvitations: Number(user.stats?.qrInvitations) || 0,
                qrInvitationsReceived: Number(user.stats?.qrInvitationsReceived) || 0,
                sentRequests: Number(user.stats?.sentRequests) || 0
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
            referralCode: user.referralCode || null,
            referralGeneratedAt: user.referralGeneratedAt || null,
            referredBy: user.referredBy || null,
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
                meetingCount: 0,
                referralsCount: 0,
                referralBonus: 0,
                qrInvitations: 0,
                qrInvitationsReceived: 0,
                sentRequests: 0
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
            referralCode: null,
            referralGeneratedAt: null,
            referredBy: null,
            isVerified: false,
            isActive: true
        };
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

            // Хэшируем пароль перед сохранением
            const hashedPassword = this.hashPassword(userData.password);
            
            console.log('🔐 Регистрация:', {
                email: userData.email,
                nickname: userData.nickname,
                passwordHash: hashedPassword
            });

            // Создаем полный объект пользователя
            const newUser = {
                id: this.generateUserId(),
                email: userData.email.toLowerCase().trim(),
                nickname: userData.nickname.trim(),
                password: hashedPassword,
                avatar: userData.avatar || '',
                status: 'online',
                invisible: false,
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
                    meetingCount: 0,
                    referralsCount: 0,
                    referralBonus: 0,
                    qrInvitations: 0,
                    qrInvitationsReceived: 0,
                    sentRequests: 0
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
                referralCode: this.generateReferralCode(),
                referralGeneratedAt: Date.now(),
                referredBy: userData.referredBy || null,
                isVerified: false,
                isActive: true
            };

            users.push(newUser);
            
            if (this.saveUsers(users)) {
                console.log('✅ Пользователь создан:', newUser.email);
                return newUser;
            } else {
                throw new Error('Не удалось сохранить пользователя');
            }
            
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
                'position', 'about', 'settings', 'stats',
                'referralCode', 'referralGeneratedAt', 'referredBy',
                'password', 'lastSeen', 'lastActive'
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
        
        // Ищем по email, nickname или ID
        const user = users.find(user => 
            (user.email && user.email.toLowerCase() === searchTerm) ||
            (user.nickname && user.nickname.toLowerCase() === searchTerm) ||
            (user.id && user.id.toLowerCase() === searchTerm)
        );
        
        if (user) {
            console.log('✅ Пользователь найден:', user.email);
        } else {
            console.log('❌ Пользователь не найден');
        }
        
        return user;
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
        
        const searchNickname = nickname.toLowerCase().trim();
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
            if (!userJson) {
                console.log('👤 Текущий пользователь не найден');
                return null;
            }
            
            const user = JSON.parse(userJson);
            console.log('👤 Текущий пользователь:', user.email);
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
            
            console.log('✅ Текущий пользователь установлен:', validatedUser.email);
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения текущего пользователя:', error);
            return false;
        }
    },

    // Вход в систему
    login: function(identifier, password) {
        try {
            console.log('🔐 Попытка входа для:', identifier);
            
            // Ищем пользователя по email или никнейму
            const user = this.findUser(identifier);
            
            if (!user) {
                console.log('❌ Пользователь не найден:', identifier);
                throw new Error('Пользователь не найден');
            }

            // Хэшируем введенный пароль для сравнения
            const hashedPassword = this.hashPassword(password);
            
            console.log('🔐 Сравнение паролей:', {
                identifier: identifier,
                userEmail: user.email,
                storedHash: user.password,
                inputHash: hashedPassword,
                match: user.password === hashedPassword
            });

            if (user.password !== hashedPassword) {
                console.log('❌ Неверный пароль для пользователя:', user.email);
                throw new Error('Неверный пароль');
            }

            if (!user.isActive) {
                throw new Error('Аккаунт деактивирован');
            }

            // Обновляем данные пользователя
            const updatedUser = this.updateUser(user.id, {
                status: 'online',
                lastSeen: new Date().toISOString(),
                lastActive: Date.now()
            });

            if (!updatedUser) {
                throw new Error('Ошибка обновления данных пользователя');
            }

            // Устанавливаем как текущего
            this.setCurrentUser(updatedUser);
            
            console.log('✅ Успешный вход:', updatedUser.email);
            return updatedUser;
            
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
                // Устанавливаем статус "не в сети"
                this.updateUser(currentUser.id, {
                    status: 'offline',
                    lastSeen: new Date().toISOString()
                });
                
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
    
    // Генерация ID пользователя
    generateUserId: function() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `usr_${timestamp}_${random}`;
    },

    // Хэширование пароля
    hashPassword: function(password) {
        if (!password || typeof password !== 'string') {
            console.log('⚠️ Пустой пароль для хеширования');
            return '';
        }
        
        // Стабильный алгоритм
        const salt = 'meetup_secure_salt_2024_v2';
        const saltedPassword = password + salt;
        
        let hash = 0;
        for (let i = 0; i < saltedPassword.length; i++) {
            const char = saltedPassword.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & 0xFFFFFFFF;
        }
        
        const result = hash.toString(16);
        console.log('🔐 Хеширование:', { пароль: password, хеш: result });
        return result;
    },

    // Генерация реферального кода
    generateReferralCode: function() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 6);
        return `REF_${timestamp}_${random}`.toUpperCase();
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
                    viaQR: false
                }
            };

            requests.push(newRequest);
            localStorage.setItem('meetup_friend_requests', JSON.stringify(requests));
            
            console.log('✅ Запрос в друзья отправлен');
            return newRequest;
        } catch (error) {
            console.error('❌ Ошибка отправки запроса в друзья:', error);
            throw error;
        }
    },

    // ============ РЕФЕРАЛЬНАЯ СИСТЕМА ============
    
    // Использовать реферальную ссылку
    useReferralLink: function(code, newUserId) {
        try {
            console.log('🔗 Использование реферальной ссылки:', { code, newUserId });
            
            // Находим пользователя по реферальному коду
            const users = this.getUsers();
            const referrer = users.find(u => u.referralCode === code);
            
            if (!referrer) {
                console.log('❌ Реферальный код не найден:', code);
                return { success: false, message: 'Неверный реферальный код' };
            }
            
            // Проверяем срок действия (30 дней)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            if (referrer.referralGeneratedAt && referrer.referralGeneratedAt < thirtyDaysAgo) {
                console.log('⚠️ Ссылка устарела');
                return { success: false, message: 'Ссылка устарела' };
            }
            
            // Обновляем статистику пригласившего
            this.updateUser(referrer.id, {
                stats: {
                    ...referrer.stats,
                    referralsCount: (referrer.stats.referralsCount || 0) + 1,
                    referralBonus: (referrer.stats.referralBonus || 0) + 1
                }
            });
            
            // Обновляем профиль нового пользователя
            this.updateUser(newUserId, {
                referredBy: referrer.id
            });
            
            // Создаем автоматический запрос в друзья
            setTimeout(() => {
                try {
                    this.sendFriendRequest(referrer.id, newUserId);
                    this.sendFriendRequest(newUserId, referrer.id);
                } catch (error) {
                    console.log('Автоматическое добавление в друзья не удалось:', error);
                }
            }, 1000);
            
            return { 
                success: true, 
                message: 'Ссылка успешно использована',
                referrer: {
                    id: referrer.id,
                    nickname: referrer.nickname,
                    email: referrer.email
                },
                bonus: 1
            };
        } catch (error) {
            console.error('❌ Ошибка использования реферальной ссылки:', error);
            return { success: false, message: 'Ошибка обработки ссылки' };
        }
    },

    // Получить реферальную ссылку
    getReferralLink: function(userId) {
        const user = this.findUser(userId);
        if (!user) return null;
        
        let code = user.referralCode;
        if (!code) {
            code = this.generateReferralCode();
            this.updateUser(userId, {
                referralCode: code,
                referralGeneratedAt: Date.now()
            });
        }
        
        const currentDomain = window.location.origin;
        return `${currentDomain}/index.html?ref=${code}`;
    },

    // ============ ГЕОЛОКАЦИЯ ============
    
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
    }
};

// ============ ИНИЦИАЛИЗАЦИЯ ============

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
