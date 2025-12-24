// telegram-bot-api.js - Браузерная версия для фронтенда MeetUP

const TelegramBotAPI = {
    // Конфигурация с вашими данными
    botToken: '8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0',
    botUsername: 'MeetUPpasswordbot',
    isInitialized: false,
    isDemoMode: false,
    
    // Инициализация
    init: function(token = null) {
        try {
            console.log('🤖 Инициализация Telegram Bot API для MeetUP...');
            
            // Используем переданный токен или наш по умолчанию
            this.botToken = token || this.botToken;
            
            // Проверяем токен
            if (this.validateToken()) {
                this.isInitialized = true;
                this.isDemoMode = false;
                
                console.log('✅ Telegram Bot API инициализирован');
                console.log('🤖 Бот:', this.botUsername);
                console.log('🔐 Токен:', this.maskToken(this.botToken));
                
                // Проверяем соединение с ботом
                setTimeout(() => {
                    this.testConnection().then(result => {
                        if (result.ok) {
                            console.log('🎉 Бот доступен! Username: @' + result.result.username);
                            console.log('📱 Начните диалог: https://t.me/' + result.result.username);
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
    
    // Переключение в демо-режим
    switchToDemoMode: function() {
        this.botToken = 'demo_token_' + Date.now();
        this.botUsername = 'MeetUPpasswordbot';
        this.isDemoMode = true;
        this.isInitialized = true;
        
        console.log('📱 ДЕМО-РЕЖИМ АКТИВЕН');
        console.log('💡 Коды будут показываться в консоли');
        console.log('🔧 Для реальной работы убедитесь что:');
        console.log('   1. Бот @MeetUPpasswordbot активен');
        console.log('   2. Пользователь написал боту /start');
        console.log('   3. Username указан правильно без @');
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
    
    // Отправка сообщения
    sendMessage: async function(chatId, text, options = {}) {
        try {
            console.log(`📤 Отправка сообщения через Telegram...`);
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
                            username: chatId.replace('@', ''),
                            type: 'private'
                        },
                        date: Math.floor(Date.now() / 1000),
                        text: text
                    },
                    demo: true
                };
            }
            
            console.log(`🌐 Отправка реального сообщения через Telegram API...`);
            
            // Проверяем chatId - если это username, убеждаемся что пользователь писал боту
            if (chatId.startsWith('@')) {
                console.log('ℹ️ Отправка по username. Убедитесь что:');
                console.log('   1. Пользователь написал боту /start');
                console.log('   2. Username правильный: ' + chatId);
                console.log('   3. Бот не заблокирован пользователем');
            }
            
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
                
                // Если ошибка "chat not found", даем подробные инструкции
                if (errorData.description && errorData.description.includes('chat not found')) {
                    console.error('🔍 Возможные причины:');
                    console.error('   1. Пользователь не писал боту /start');
                    console.error('   2. Username указан неверно');
                    console.error('   3. Бот заблокирован пользователем');
                    console.error('   4. Пользователь не имеет username в Telegram');
                    console.error('💡 Решение: Попросите пользователя написать /start боту');
                }
                
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
                userMessage = 'Пользователь не найден';
                debugInfo = 'Убедитесь что пользователь написал /start боту';
            } else if (error.message.includes('bot was blocked')) {
                userMessage = 'Бот заблокирован';
                debugInfo = 'Пользователь заблокировал бота';
            } else if (error.message.includes('user is deactivated')) {
                userMessage = 'Аккаунт неактивен';
                debugInfo = 'Аккаунт Telegram деактивирован';
            }
            
            return {
                ok: false,
                error: userMessage,
                description: debugInfo,
                debug: this.getErrorMessage(error)
            };
        }
    },
    
    // Отправка кода верификации
    sendVerificationCode: async function(telegramUsername, code) {
        console.log(`🔐 Отправка кода верификации...`);
        console.log(`👤 Пользователь: @${telegramUsername}`);
        console.log(`🔢 Код: ${code}`);
        
        const message = `🔐 <b>Код подтверждения для MeetUP</b>\n\n` +
                       `🆔 <b>Код:</b> <code><b>${code}</b></code>\n\n` +
                       `⏰ <b>Действует:</b> 10 минут\n` +
                       `🔒 <b>Безопасность:</b> Никому не передавайте этот код\n\n` +
                       `💡 <b>Инструкция:</b>\n` +
                       `1. Вернитесь на сайт MeetUP\n` +
                       `2. Введите этот код в поле подтверждения\n` +
                       `3. Нажмите "Подтвердить"\n\n` +
                       `⚠️ <b>Внимание:</b>\n` +
                       `Если вы не запрашивали привязку Telegram, проигнорируйте это сообщение\n\n` +
                       `🤖 <b>Бот:</b> @MeetUPpasswordbot`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Отправка кода сброса пароля
    sendPasswordResetCode: async function(telegramUsername, code) {
        console.log(`🔄 Отправка кода сброса пароля...`);
        console.log(`👤 Пользователь: @${telegramUsername}`);
        console.log(`🔢 Код: ${code}`);
        
        const message = `🔄 <b>Сброс пароля MeetUP</b>\n\n` +
                       `🔐 <b>Код для сброса:</b> <code><b>${code}</b></code>\n\n` +
                       `⏰ <b>Действует:</b> 10 минут\n` +
                       `⚠️ <b>Внимание:</b> Если это не вы, проигнорируйте сообщение\n\n` +
                       `📝 <b>Инструкция:</b>\n` +
                       `1. Вернитесь на сайт MeetUP\n` +
                       `2. Введите этот код в поле ввода\n` +
                       `3. Установите новый пароль\n\n` +
                       `🔒 <b>Рекомендации:</b>\n` +
                       `• Используйте надежный пароль\n` +
                       `• Не используйте старые пароли\n` +
                       `• Включите двухфакторную аутентификацию\n\n` +
                       `🤖 <b>Бот:</b> @MeetUPpasswordbot`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Отправка уведомления об успешном сбросе пароля
    sendPasswordResetSuccess: async function(telegramUsername) {
        console.log(`✅ Отправка уведомления об успешном сбросе...`);
        console.log(`👤 Пользователь: @${telegramUsername}`);
        
        const message = `✅ <b>Пароль успешно изменен</b>\n\n` +
                       `Ваш пароль в аккаунте MeetUP был изменен.\n\n` +
                       `🛡️ <b>Рекомендации по безопасности:</b>\n` +
                       `• Используйте уникальные пароли\n` +
                       `• Регулярно меняйте пароли\n` +
                       `• Включите двухфакторную аутентификацию\n\n` +
                       `🔐 <b>Если это были не вы:</b>\n` +
                       `Немедленно обратитесь в поддержку\n\n` +
                       `🙏 Спасибо, что используете MeetUP!`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Получение читаемого сообщения об ошибке
    getErrorMessage: function(error) {
        const msg = error.message || '';
        
        // Телеграм ошибки
        if (msg.includes('chat not found')) return 'Пользователь не писал боту /start';
        if (msg.includes('bot was blocked')) return 'Бот заблокирован';
        if (msg.includes('user is deactivated')) return 'Аккаунт Telegram деактивирован';
        if (msg.includes('have no rights')) return 'Нет прав для отправки';
        if (msg.includes('Too Many Requests')) return 'Слишком много запросов';
        if (msg.includes('401')) return 'Неверный токен бота';
        if (msg.includes('404')) return 'Токен не найден';
        if (msg.includes('429')) return 'Лимит запросов исчерпан';
        
        // Сетевые ошибки
        if (msg.includes('NetworkError')) return 'Проблемы с сетью';
        if (msg.includes('Failed to fetch')) return 'Не удалось подключиться';
        if (msg.includes('timeout')) return 'Таймаут запроса';
        if (msg.includes('AbortError')) return 'Запрос отменен';
        
        return 'Неизвестная ошибка';
    },
    
    // Проверка существования пользователя
    checkUserExists: async function(telegramUsername) {
        try {
            console.log(`🔍 Проверка пользователя: @${telegramUsername}`);
            
            // В реальном режиме пробуем отправить тестовое сообщение
            if (!this.isDemoMode) {
                const testMessage = "🔒 Это тестовое сообщение для проверки. Проигнорируйте его.";
                const result = await this.sendMessage(`@${telegramUsername}`, testMessage);
                
                return { 
                    ok: result.ok, 
                    exists: result.ok,
                    username: telegramUsername,
                    message: result.ok ? 'Пользователь найден' : 'Пользователь не найден'
                };
            } else {
                // В демо-режиме всегда возвращаем true
                console.log('📱 Демо-режим: пользователь считается существующим');
                return { 
                    ok: true, 
                    exists: true,
                    username: telegramUsername,
                    message: 'Демо-режим: проверка пройдена',
                    demo: true
                };
            }
            
        } catch (error) {
            console.error('❌ Ошибка проверки пользователя:', error);
            return { 
                ok: false, 
                exists: false, 
                username: telegramUsername,
                error: error.message 
            };
        }
    },
    
    // Маскировка токена для логирования
    maskToken: function(token) {
        if (!token || token.length < 10) return '***INVALID***';
        return token.substring(0, 4) + '***' + token.substring(token.length - 4);
    },
    
    // Проверка, активен ли бот
    isBotActive: function() {
        return this.isInitialized && !this.isDemoMode;
    },
    
    // Получение режима работы
    getMode: function() {
        return this.isDemoMode ? 'demo' : 'real';
    },
    
    // Принудительное переключение в демо-режим (для тестирования)
    forceDemoMode: function() {
        this.switchToDemoMode();
        console.log('🔄 Принудительно переключен в демо-режим');
        return { mode: 'demo', message: 'Демо-режим активирован' };
    },
    
    // Принудительное переключение в реальный режим
    forceRealMode: function() {
        this.botToken = '8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0';
        this.botUsername = 'MeetUPpasswordbot';
        this.isDemoMode = false;
        console.log('🔄 Принудительно переключен в реальный режим');
        return { mode: 'real', message: 'Реальный режим активирован' };
    }
};

// Автоматическая инициализация при загрузке в браузере
if (typeof window !== 'undefined') {
    console.log('🚀 Загрузка Telegram Bot API для MeetUP...');
    
    // Ждем полной загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 DOM загружен, инициализируем Telegram Bot API...');
            setTimeout(() => {
                TelegramBotAPI.init();
            }, 500);
        });
    } else {
        console.log('📄 DOM уже загружен, инициализируем Telegram Bot API...');
        setTimeout(() => {
            TelegramBotAPI.init();
        }, 500);
    }
    
    // Экспортируем для глобального доступа
    window.TelegramBotAPI = TelegramBotAPI;
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramBotAPI;
}
