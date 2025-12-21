// telegram-bot-api.js - Модуль для работы с Telegram Bot API
const TelegramBotAPI = {
    // Конфигурация бота (ВАШ_ТОКЕН из @BotFather)
    botToken: '8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0',
    botUsername: '@MeetUPpasswordbot',
    
    // Инициализация
    init: function() {
        console.log('🤖 Telegram Bot API инициализирован');
        
        // Проверяем токен
        if (!this.validateToken()) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Токен бота не настроен!');
            console.error('⚠️ Пожалуйста, установите правильный токен в TelegramBotAPI.botToken');
            console.error('📝 Получите токен у @BotFather в Telegram');
            throw new Error('Токен Telegram бота не настроен');
        }
        
        console.log('✅ Токен бота настроен корректно');
    },
    
    // Проверка валидности токена
    validateToken: function() {
        return this.botToken && 
               this.botToken !== 'ВАШ_BOT_TOKEN' && 
               this.botToken !== '8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0' && // Замените на ваш
               this.botToken.length > 30 &&
               this.botToken.startsWith('AA');
    },
    
    // Отправка сообщения пользователю через Telegram Bot API
    sendMessage: async function(chatId, text, options = {}) {
        if (!this.validateToken()) {
            throw new Error('Токен бота не настроен. Получите токен у @BotFather');
        }
        
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            
            const params = {
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...options
            };
            
            console.log(`📤 Отправка сообщения в Telegram для ${chatId}`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
            });
            
            const result = await response.json();
            
            if (!result.ok) {
                console.error('❌ Ошибка Telegram API:', result.description);
                throw new Error(`Telegram API Error: ${result.description}`);
            }
            
            console.log('✅ Сообщение успешно отправлено в Telegram');
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения в Telegram:', error);
            throw new Error(`Не удалось отправить сообщение: ${error.message}`);
        }
    },
    
    // Отправка кода верификации
    sendVerificationCode: async function(telegramUsername, code) {
        const message = `🔐 <b>Код подтверждения для MeetUP</b>\n\n` +
                       `Ваш код подтверждения: <code><b>${code}</b></code>\n\n` +
                       `Введите этот 6-значный код в приложении MeetUP для завершения привязки Telegram аккаунта.\n\n` +
                       `⏰ Код действителен <b>10 минут</b>\n` +
                       `🔒 Не сообщайте этот код никому`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Отправка кода для сброса пароля
    sendPasswordResetCode: async function(telegramUsername, code) {
        const message = `🔄 <b>Сброс пароля MeetUP</b>\n\n` +
                       `Запрос на сброс пароля для вашего аккаунта.\n\n` +
                       `Код для сброса пароля: <code><b>${code}</b></code>\n\n` +
                       `Введите этот код на странице восстановления пароля в приложении MeetUP.\n\n` +
                       `⏰ Код действителен <b>10 минут</b>\n` +
                       `⚠️ Если вы не запрашивали сброс пароля, немедленно проигнорируйте это сообщение.\n\n` +
                       `🔒 Сообщение отправлено ботом ${this.botUsername}`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Отправка уведомления об успешном сбросе пароля
    sendPasswordResetSuccess: async function(telegramUsername) {
        const message = `✅ <b>Пароль успешно изменен</b>\n\n` +
                       `Пароль для вашего аккаунта MeetUP был успешно изменен.\n\n` +
                       `Если это были не вы, немедленно свяжитесь с поддержкой.\n\n` +
                       `🕒 ${new Date().toLocaleString('ru-RU')}\n` +
                       `🔐 Будьте внимательны к безопасности аккаунта`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Проверка доступности бота
    testConnection: async function() {
        if (!this.validateToken()) {
            return { ok: false, error: 'Токен бота не настроен' };
        }
        
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/getMe`;
            const response = await fetch(url);
            const result = await response.json();
            
            return result;
        } catch (error) {
            console.error('❌ Ошибка проверки соединения с Telegram:', error);
            return { ok: false, error: error.message };
        }
    },
    
    // Проверка существования пользователя
    checkUserExists: async function(telegramUsername) {
        try {
            const result = await this.sendMessage(`@${telegramUsername}`, '🔒 Проверка аккаунта...');
            return result.ok;
        } catch (error) {
            console.error('❌ Пользователь не найден или бот заблокирован:', error);
            return false;
        }
    }
};

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramBotAPI;
}
