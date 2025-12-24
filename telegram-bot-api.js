// telegram-bot-api.js - Браузерная версия для фронтенда

const TelegramBotAPI = {
    // Конфигурация с вашими данными
    botToken: '8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0',
    botUsername: 'MeetUPpasswordbot',
    isInitialized: false,
    
    // Инициализация
    init: function(token = null) {
        try {
            // Используем переданный токен или наш по умолчанию
            this.botToken = token || this.botToken;
            
            // Сохраняем в localStorage для будущего использования
            if (!localStorage.getItem('telegram_bot_token')) {
                localStorage.setItem('telegram_bot_token', this.botToken);
            }
            if (!localStorage.getItem('telegram_bot_username')) {
                localStorage.setItem('telegram_bot_username', this.botUsername);
            }
            
            // Проверяем токен
            if (this.validateToken()) {
                this.isInitialized = true;
                console.log('✅ Telegram Bot API инициализирован для браузера');
                console.log('🤖 Бот:', this.botUsername);
                console.log('🔐 Токен:', this.maskToken(this.botToken));
                
                // Тестируем соединение
                this.testConnection().then(result => {
                    if (result.ok) {
                        console.log('🎉 Бот доступен!');
                        console.log(`👋 Начните диалог: https://t.me/${this.botUsername}`);
                    } else {
                        console.warn('⚠️ Бот недоступен, проверьте токен');
                    }
                });
                
                return { success: true, mode: 'real' };
            } else {
                throw new Error('Неверный формат токена');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации Telegram Bot API:', error);
            // В случае ошибки используем демо-режим
            console.warn('🔄 Переключаемся в демо-режим');
            this.botToken = 'demo_token_' + Date.now();
            this.botUsername = 'demo_bot';
            this.isInitialized = true;
            return { success: true, mode: 'demo' };
        }
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
            if (this.botToken.startsWith('demo_token_')) {
                console.log('🔗 Демо-режим: соединение с Telegram Bot');
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
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.ok) {
                console.log('✅ Telegram Bot доступен:', data.result.username);
                this.botUsername = data.result.username;
                localStorage.setItem('telegram_bot_username', data.result.username);
            }
            
            return data;
        } catch (error) {
            console.error('❌ Ошибка тестирования соединения с Telegram:', error);
            
            // Проверяем конкретные ошибки
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.error('🔍 Проверьте правильность токена бота');
            } else if (error.message.includes('401')) {
                console.error('🔍 Неверный токен бота');
            } else if (error.message.includes('NetworkError')) {
                console.error('🔍 Проблемы с сетью. Проверьте подключение к интернету');
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
            console.log(`📤 Отправка сообщения через Telegram: chatId=${chatId}`);
            
            // Проверяем, не пустое ли сообщение
            if (!text || text.trim().length === 0) {
                throw new Error('Пустой текст сообщения');
            }
            
            // Проверяем, не демо-режим ли
            if (this.botToken.startsWith('demo_token_')) {
                console.log('📱 ДЕМО-РЕЖИМ: Сообщение отправлено в Telegram');
                console.log(`👤 Кому: ${chatId}`);
                console.log(`💬 Текст: ${text.substring(0, 100)}...`);
                console.log('⚠️ Для реальной отправки проверьте токен бота');
                
                // Имитируем задержку сети
                await new Promise(resolve => setTimeout(resolve, 500));
                
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
                    }
                };
            }
            
            console.log(`📝 Отправка реального сообщения через API...`);
            
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
                console.error('❌ Ошибка API Telegram:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            if (!data.ok) {
                console.error('❌ Telegram API вернул ошибку:', data.description);
                throw new Error(data.description || 'Unknown Telegram API error');
            }
            
            console.log('✅ Сообщение успешно отправлено через Telegram API');
            return data;
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения в Telegram:', error);
            
            // Детализируем ошибку
            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = 'Таймаут запроса к Telegram API (10 секунд)';
            } else if (error.message.includes('chat not found')) {
                errorMessage = 'Пользователь не найден в Telegram или бот заблокирован';
            } else if (error.message.includes('bot was blocked')) {
                errorMessage = 'Бот заблокирован пользователем';
            }
            
            return {
                ok: false,
                error: errorMessage,
                description: this.getErrorMessage(error)
            };
        }
    },
    
    // Отправка кода верификации
    sendVerificationCode: async function(telegramUsername, code) {
        console.log(`🔐 Отправка кода верификации пользователю: @${telegramUsername}`);
        
        const message = `🔐 <b>Код подтверждения для MeetUP</b>\n\n` +
                       `🆔 <b>Код:</b> <code>${code}</code>\n\n` +
                       `⏰ <b>Действует:</b> 10 минут\n` +
                       `🔒 <b>Безопасность:</b> Никому не передавайте этот код\n\n` +
                       `💡 <b>Как использовать:</b>\n` +
                       `1. Вернитесь на сайт MeetUP\n` +
                       `2. Введите этот код в поле подтверждения\n` +
                       `3. Нажмите "Подтвердить"\n\n` +
                       `ℹ️ Если вы не запрашивали этот код, проигнорируйте сообщение`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Отправка кода сброса пароля
    sendPasswordResetCode: async function(telegramUsername, code) {
        console.log(`🔄 Отправка кода сброса пароля пользователю: @${telegramUsername}`);
        
        const message = `🔄 <b>Сброс пароля MeetUP</b>\n\n` +
                       `🔐 <b>Код для сброса пароля:</b> <code>${code}</code>\n\n` +
                       `⏰ <b>Действует:</b> 10 минут\n` +
                       `⚠️ <b>Внимание:</b> Если это не вы, проигнорируйте это сообщение\n\n` +
                       `📝 <b>Инструкция:</b>\n` +
                       `1. Вернитесь на сайт MeetUP\n` +
                       `2. Введите этот код\n` +
                       `3. Установите новый пароль\n\n` +
                       `🔒 Для безопасности используйте надежные пароли`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Отправка уведомления об успешном сбросе пароля
    sendPasswordResetSuccess: async function(telegramUsername) {
        console.log(`✅ Отправка уведомления об успешном сбросе: @${telegramUsername}`);
        
        const message = `✅ <b>Пароль успешно изменен</b>\n\n` +
                       `Ваш пароль в аккаунте MeetUP был успешно изменен.\n\n` +
                       `🛡️ <b>Рекомендации по безопасности:</b>\n` +
                       `• Используйте надежные уникальные пароли\n` +
                       `• Не используйте один пароль на разных сервисах\n` +
                       `• Регулярно меняйте пароли\n` +
                       `• Включите двухфакторную аутентификацию\n\n` +
                       `🔐 Если это были не вы, немедленно обратитесь в поддержку: support@meetup.com\n\n` +
                       `🙏 Спасибо, что используете MeetUP!`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Получение читаемого сообщения об ошибке
    getErrorMessage: function(error) {
        const msg = error.message || '';
        
        // Телеграм ошибки
        if (msg.includes('chat not found')) return 'Пользователь не найден в Telegram';
        if (msg.includes('bot was blocked')) return 'Бот заблокирован пользователем';
        if (msg.includes('user is deactivated')) return 'Аккаунт пользователя деактивирован';
        if (msg.includes('have no rights')) return 'Нет прав для отправки сообщения';
        if (msg.includes('Too Many Requests')) return 'Слишком много запросов, попробуйте позже';
        if (msg.includes('401')) return 'Неверный токен бота';
        if (msg.includes('404')) return 'Токен бота не найден';
        if (msg.includes('429')) return 'Превышен лимит запросов к Telegram';
        
        // Сетевые ошибки
        if (msg.includes('NetworkError')) return 'Проблемы с сетью';
        if (msg.includes('Failed to fetch')) return 'Не удалось подключиться к серверу';
        if (msg.includes('timeout')) return 'Таймаут запроса';
        if (msg.includes('AbortError')) return 'Запрос отменен по таймауту';
        
        return 'Неизвестная ошибка при отправке сообщения';
    },
    
    // Проверка существования пользователя
    checkUserExists: async function(telegramUsername) {
        try {
            console.log(`🔍 Проверка пользователя: @${telegramUsername}`);
            
            // Пытаемся отправить тестовое сообщение
            const testMessage = "🔒 Это тестовое сообщение для проверки. Пожалуйста, проигнорируйте его.";
            const result = await this.sendMessage(`@${telegramUsername}`, testMessage);
            
            return { 
                ok: result.ok, 
                exists: result.ok,
                username: telegramUsername
            };
            
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
        return this.isInitialized && this.botToken && !this.botToken.startsWith('demo_token_');
    }
};

// Автоматическая инициализация при загрузке в браузере
if (typeof window !== 'undefined') {
    // Ждем полной загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🚀 Инициализация Telegram Bot API...');
            TelegramBotAPI.init();
        });
    } else {
        console.log('🚀 Инициализация Telegram Bot API...');
        TelegramBotAPI.init();
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramBotAPI;
}
