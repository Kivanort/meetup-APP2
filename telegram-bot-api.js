// telegram-bot-api.js - Браузерная версия для MeetUP с поддержкой Widget Login
const TelegramBotAPI = {
    // Конфигурация
    botToken: '8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0',
    botUsername: 'MeetUPpasswordbot',
    isInitialized: false,
    isDemoMode: false,
    widgetScriptLoaded: false,
    
    // Инициализация
    init: function(token = null) {
        try {
            console.log('🤖 Инициализация Telegram Bot API для MeetUP...');
            
            // Загружаем Telegram Widget Script
            this.loadTelegramWidget();
            
            // Используем переданный токен или наш по умолчанию
            this.botToken = token || this.botToken;
            
            // Проверяем токен
            if (this.validateToken()) {
                this.isInitialized = true;
                this.isDemoMode = false;
                
                console.log('✅ Telegram Bot API инициализирован');
                console.log('🤖 Бот:', this.botUsername);
                console.log('🔐 Токен:', this.maskToken(this.botToken));
                
                // Проверяем есть ли сохраненный Telegram пользователь
                this.checkSavedTelegramUser();
                
                // Проверяем соединение с ботом
                setTimeout(() => {
                    this.testConnection().then(result => {
                        if (result.ok) {
                            console.log('🎉 Бот доступен! Username: @' + result.result.username);
                            console.log('📱 Для привязки используйте Telegram Widget на сайте');
                            
                            // Обновляем username если изменился
                            if (result.result.username !== this.botUsername) {
                                this.botUsername = result.result.username;
                                console.log('🔄 Username обновлен:', this.botUsername);
                            }
                        } else {
                            console.warn('⚠️ Бот недоступен. Переключаемся в демо-режим');
                            this.switchToDemoMode();
                        }
                    });
                }, 1000);
                
                return { success: true, mode: 'real' };
            } else {
                throw new Error('Неверный формат токена');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации Telegram Bot API:', error);
            console.log('🔄 Переключаемся в демо-режим для тестирования');
            this.switchToDemoMode();
            return { success: true, mode: 'demo' };
        }
    },
    
    // Загрузка Telegram Widget Script
    loadTelegramWidget: function() {
        if (this.widgetScriptLoaded) return;
        
        try {
            // Проверяем, не загружен ли уже скрипт
            if (!document.querySelector('script[src*="telegram-widget"]')) {
                const script = document.createElement('script');
                script.src = 'https://telegram.org/js/telegram-widget.js?22';
                script.async = true;
                document.head.appendChild(script);
                console.log('📱 Telegram Widget Script загружен');
            }
            
            this.widgetScriptLoaded = true;
        } catch (error) {
            console.error('❌ Ошибка загрузки Telegram Widget:', error);
        }
    },
    
    // Проверка сохраненного Telegram пользователя
    checkSavedTelegramUser: function() {
        try {
            const savedUser = localStorage.getItem('telegram_user');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                console.log('👤 Найден сохраненный Telegram пользователь:', user.username || user.first_name);
                return user;
            }
        } catch (error) {
            console.error('❌ Ошибка чтения сохраненного Telegram пользователя:', error);
        }
        return null;
    },
    
    // Обработка авторизации через Telegram Widget
    handleTelegramAuth: function(userData) {
        try {
            console.log('✅ Получены данные от Telegram Widget:', userData);
            
            // Сохраняем данные пользователя
            const telegramUser = {
                id: userData.id,
                first_name: userData.first_name,
                last_name: userData.last_name || '',
                username: userData.username || '',
                photo_url: userData.photo_url || '',
                auth_date: userData.auth_date,
                hash: userData.hash,
                verified: true,
                verified_at: new Date().toISOString()
            };
            
            // Сохраняем в localStorage
            localStorage.setItem('telegram_user', JSON.stringify(telegramUser));
            localStorage.setItem('telegram_verified', 'true');
            localStorage.setItem('telegram_auth_date', new Date().toISOString());
            
            // Сохраняем chat_id для отправки сообщений
            // При авторизации через Widget мы получаем chat_id пользователя
            localStorage.setItem('telegram_chat_id', userData.id.toString());
            
            console.log('✅ Telegram пользователь сохранен. Chat ID:', userData.id);
            
            // Отправляем приветственное сообщение
            this.sendWelcomeMessage(userData.id, userData.username || userData.first_name);
            
            return {
                success: true,
                user: telegramUser,
                message: 'Telegram успешно привязан'
            };
        } catch (error) {
            console.error('❌ Ошибка обработки авторизации Telegram:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // Отправка приветственного сообщения
    sendWelcomeMessage: async function(chatId, userName) {
        try {
            const message = `👋 <b>Добро пожаловать в MeetUP, ${userName}!</b>\n\n` +
                           `✅ Ваш Telegram успешно привязан к аккаунту MeetUP.\n\n` +
                           `📱 <b>Что теперь доступно:</b>\n` +
                           `• Получение кодов подтверждения\n` +
                           `• Сброс пароля через Telegram\n` +
                           `• Уведомления о безопасности\n\n` +
                           `🔐 <b>Ваш Chat ID:</b> <code>${chatId}</code>\n\n` +
                           `💡 Сохраните этот Chat ID для будущих обращений в поддержку.\n\n` +
                           `🙏 Спасибо за использование MeetUP!`;
            
            const result = await this.sendMessage(chatId, message);
            
            if (result.ok) {
                console.log('✅ Приветственное сообщение отправлено');
            } else {
                console.warn('⚠️ Не удалось отправить приветственное сообщение:', result.error);
            }
            
            return result;
        } catch (error) {
            console.error('❌ Ошибка отправки приветственного сообщения:', error);
            return { ok: false, error: error.message };
        }
    },
    
    // Проверка привязан ли Telegram
    isTelegramVerified: function() {
        return localStorage.getItem('telegram_verified') === 'true';
    },
    
    // Получение данных Telegram пользователя
    getTelegramUser: function() {
        try {
            const userJson = localStorage.getItem('telegram_user');
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('❌ Ошибка получения данных Telegram:', error);
            return null;
        }
    },
    
    // Получение chat_id (из Widget авторизации или localStorage)
    getChatId: function() {
        // Пробуем получить chat_id из сохраненного пользователя
        const user = this.getTelegramUser();
        if (user && user.id) {
            return user.id.toString();
        }
        
        // Пробуем получить из localStorage
        const savedChatId = localStorage.getItem('telegram_chat_id');
        if (savedChatId) {
            return savedChatId;
        }
        
        return null;
    },
    
    // Переключение в демо-режим
    switchToDemoMode: function() {
        this.botToken = 'demo_token_' + Date.now();
        this.botUsername = 'MeetUPpasswordbot';
        this.isDemoMode = true;
        this.isInitialized = true;
        
        console.log('📱 ДЕМО-РЕЖИМ АКТИВЕН');
        console.log('💡 Коды будут показываться в консоли');
        console.log('🔧 Для реальной работы используйте Telegram Widget на сайте');
    },
    
    // Валидация токена
    validateToken: function() {
        if (!this.botToken) return false;
        
        // Проверяем формат токена: 8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0
        const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
        return tokenRegex.test(this.botToken);
    },
    
    // Тестирование соединения
    testConnection: async function() {
        try {
            // Проверяем, не демо-режим ли
            if (this.isDemoMode) {
                console.log('🔗 Демо-режим: имитация соединения с ботом');
                return {
                    ok: true,
                    result: {
                        id: 8431099911,
                        is_bot: true,
                        first_name: 'MeetUP Password Bot',
                        username: this.botUsername,
                        can_join_groups: true,
                        can_read_all_group_messages: false,
                        supports_inline_queries: false
                    }
                };
            }
            
            console.log('🌐 Проверяем соединение с Telegram API...');
            
            // Реальный запрос к Telegram API
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.ok) {
                console.log('✅ Telegram Bot доступен:', '@' + data.result.username);
                this.botUsername = data.result.username;
            } else {
                throw new Error(data.description || 'Unknown error');
            }
            
            return data;
        } catch (error) {
            console.error('❌ Ошибка соединения с Telegram:', error.message);
            
            // Определяем тип ошибки
            if (error.name === 'AbortError') {
                console.error('⏰ Таймаут запроса к Telegram API');
            } else if (error.message.includes('401')) {
                console.error('🔐 Неверный токен бота');
            } else if (error.message.includes('404')) {
                console.error('🔍 Токен не найден');
            }
            
            return {
                ok: false,
                description: error.message,
                error_code: 500
            };
        }
    },
    
    // Отправка сообщения (улучшенная версия)
    sendMessage: async function(chatId, text, options = {}) {
        try {
            console.log(`📤 Отправка сообщения через Telegram...`);
            
            // Если передан объект пользователя, извлекаем chat_id
            if (typeof chatId === 'object' && chatId.id) {
                chatId = chatId.id;
            }
            
            // Если chatId не указан, пробуем получить из сохраненных данных
            if (!chatId) {
                chatId = this.getChatId();
                if (!chatId) {
                    throw new Error('Chat ID не найден. Привяжите Telegram через Widget');
                }
            }
            
            console.log(`👤 Получатель: ${chatId}`);
            console.log(`📝 Текст: ${text.substring(0, 80)}...`);
            
            // Проверяем, не пустое ли сообщение
            if (!text || text.trim().length === 0) {
                throw new Error('Пустой текст сообщения');
            }
            
            // Проверяем режим работы
            if (this.isDemoMode) {
                console.log('📱 ДЕМО-РЕЖИМ: Сообщение показано в консоли');
                console.log('='.repeat(50));
                console.log(`👤 Кому: ${chatId}`);
                console.log(`💬 Текст:\n${text}`);
                console.log('='.repeat(50));
                console.log('⚠️ В реальном режиме это сообщение придет в Telegram');
                
                // Имитируем задержку сети
                await new Promise(resolve => setTimeout(resolve, 800));
                
                return {
                    ok: true,
                    result: {
                        message_id: Date.now(),
                        from: {
                            id: 8431099911,
                            is_bot: true,
                            first_name: 'MeetUP Bot',
                            username: this.botUsername
                        },
                        chat: {
                            id: chatId,
                            first_name: 'User',
                            username: 'demo_user',
                            type: 'private'
                        },
                        date: Math.floor(Date.now() / 1000),
                        text: text
                    },
                    demo: true
                };
            }
            
            console.log(`🌐 Отправка реального сообщения через Telegram API...`);
            
            // Реальный запрос к Telegram API
            const params = {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...options
            };
            
            // Добавляем таймаут для запроса
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(params),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { description: errorText };
                }
                
                console.error('❌ Ошибка Telegram API:', errorData.description || 'Unknown error');
                throw new Error(errorData.description || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.ok) {
                console.error('❌ Telegram API вернул ошибку:', data.description);
                throw new Error(data.description || 'Unknown Telegram API error');
            }
            
            console.log('✅ Сообщение успешно отправлено через Telegram API');
            return data;
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения в Telegram:', error.message);
            
            // Детализируем ошибку
            let userMessage = error.message;
            let debugInfo = '';
            
            if (error.name === 'AbortError') {
                userMessage = 'Таймаут запроса к Telegram API';
                debugInfo = 'Проверьте интернет соединение';
            } else if (error.message.includes('chat not found')) {
                userMessage = 'Чат не найден';
                debugInfo = 'Пользователь не привязывал Telegram через Widget';
            } else if (error.message.includes('bot was blocked')) {
                userMessage = 'Бот заблокирован';
                debugInfo = 'Пользователь заблокировал бота';
            }
            
            return {
                ok: false,
                error: userMessage,
                description: debugInfo,
                debug: this.getErrorMessage(error)
            };
        }
    },
    
    // Отправка кода верификации (улучшенная)
    sendVerificationCode: async function(identifier, code) {
        try {
            console.log(`🔐 Отправка кода верификации...`);
            console.log(`🔢 Код: ${code}`);
            
            // Определяем получателя
            let chatId = identifier;
            
            // Если передан username, пробуем найти chat_id
            if (identifier.startsWith('@')) {
                const user = this.getTelegramUser();
                if (user && user.username === identifier.replace('@', '')) {
                    chatId = user.id;
                } else {
                    // Если не нашли, используем сохраненный chat_id
                    chatId = this.getChatId();
                    if (!chatId) {
                        throw new Error('Telegram не привязан. Используйте Widget авторизацию');
                    }
                }
            }
            
            const message = `🔐 <b>Код подтверждения для MeetUP</b>\n\n` +
                           `🆔 <b>Код:</b> <code><b>${code}</b></code>\n\n` +
                           `⏰ <b>Действует:</b> 10 минут\n` +
                           `🔒 <b>Безопасность:</b> Никому не передавайте этот код\n\n` +
                           `💡 <b>Инструкция:</b>\n` +
                           `1. Вернитесь на сайт MeetUP\n` +
                           `2. Введите этот код в поле подтверждения\n` +
                           `3. Нажмите "Подтвердить"\n\n` +
                           `🤖 <b>Бот:</b> @${this.botUsername}`;
            
            return await this.sendMessage(chatId, message);
        } catch (error) {
            console.error('❌ Ошибка отправки кода верификации:', error);
            return {
                ok: false,
                error: error.message
            };
        }
    },
    
    // Отправка кода сброса пароля (улучшенная)
    sendPasswordResetCode: async function(identifier, code) {
        try {
            console.log(`🔄 Отправка кода сброса пароля...`);
            console.log(`🔢 Код: ${code}`);
            
            let chatId = identifier;
            
            if (identifier.startsWith('@')) {
                const user = this.getTelegramUser();
                if (user && user.username === identifier.replace('@', '')) {
                    chatId = user.id;
                } else {
                    chatId = this.getChatId();
                }
            }
            
            const message = `🔄 <b>Сброс пароля MeetUP</b>\n\n` +
                           `🔐 <b>Код для сброса:</b> <code><b>${code}</b></code>\n\n` +
                           `⏰ <b>Действует:</b> 10 минут\n` +
                           `⚠️ <b>Внимание:</b> Если это не вы, проигнорируйте\n\n` +
                           `📝 <b>Инструкция:</b>\n` +
                           `1. Вернитесь на сайт MeetUP\n` +
                           `2. Введите этот код\n` +
                           `3. Установите новый пароль\n\n` +
                           `🤖 <b>Бот:</b> @${this.botUsername}`;
            
            return await this.sendMessage(chatId, message);
        } catch (error) {
            console.error('❌ Ошибка отправки кода сброса:', error);
            return {
                ok: false,
                error: error.message
            };
        }
    },
    
    // Получение читаемого сообщения об ошибке
    getErrorMessage: function(error) {
        const msg = error.message || '';
        
        if (msg.includes('chat not found')) return 'Пользователь не привязывал Telegram';
        if (msg.includes('bot was blocked')) return 'Бот заблокирован';
        if (msg.includes('401')) return 'Неверный токен бота';
        if (msg.includes('404')) return 'Токен не найден';
        if (msg.includes('429')) return 'Лимит запросов';
        
        if (msg.includes('NetworkError')) return 'Проблемы с сетью';
        if (msg.includes('AbortError')) return 'Таймаут запроса';
        
        return 'Неизвестная ошибка';
    },
    
    // Маскировка токена
    maskToken: function(token) {
        if (!token || token.length < 10) return '***INVALID***';
        return token.substring(0, 4) + '***' + token.substring(token.length - 4);
    },
    
    // Создание Telegram Widget
    createTelegramWidget: function(elementId, onAuthCallback) {
        try {
            const container = document.getElementById(elementId);
            if (!container) {
                console.error('❌ Контейнер для Telegram Widget не найден:', elementId);
                return false;
            }
            
            // Очищаем контейнер
            container.innerHTML = '';
            
            // Создаем кнопку Telegram Widget
            const widgetHTML = `
                <script async src="https://telegram.org/js/telegram-widget.js?22" 
                    data-telegram-login="${this.botUsername}" 
                    data-size="large" 
                    data-radius="8"
                    data-onauth="${onAuthCallback}" 
                    data-request-access="write"
                    data-userpic="true">
                </script>
            `;
            
            container.innerHTML = widgetHTML;
            
            // Перезагружаем скрипт если нужно
            if (!this.widgetScriptLoaded) {
                this.loadTelegramWidget();
            }
            
            console.log('✅ Telegram Widget создан в элементе:', elementId);
            return true;
        } catch (error) {
            console.error('❌ Ошибка создания Telegram Widget:', error);
            return false;
        }
    }
};

// Глобальная функция для обработки авторизации Telegram
window.onTelegramAuth = function(user) {
    console.log('✅ Telegram Widget авторизация:', user);
    
    const result = TelegramBotAPI.handleTelegramAuth(user);
    
    if (result.success) {
        // Показываем успех
        const event = new CustomEvent('telegram-auth-success', { 
            detail: { user: result.user } 
        });
        window.dispatchEvent(event);
        
        // Вызываем пользовательский callback если есть
        if (window.telegramAuthCallback) {
            window.telegramAuthCallback(result.user);
        }
    } else {
        const event = new CustomEvent('telegram-auth-error', { 
            detail: { error: result.error } 
        });
        window.dispatchEvent(event);
    }
    
    return result;
};

// Автоматическая инициализация
if (typeof window !== 'undefined') {
    // Инициализируем при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                TelegramBotAPI.init();
            }, 1000);
        });
    } else {
        setTimeout(() => {
            TelegramBotAPI.init();
        }, 1000);
    }
    
    // Экспортируем для глобального доступа
    window.TelegramBotAPI = TelegramBotAPI;
}
