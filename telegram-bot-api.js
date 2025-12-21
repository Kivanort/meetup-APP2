// telegram-bot-api.js - Модуль для работы с Telegram Bot API
const TelegramBotAPI = {
    // Конфигурация бота (замените на свои данные)
    botToken: '8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0',
    botUsername: '@MeetUPpasswordbot',
    
    // Кэш для демо-режима
    demoMessages: {},
    
    // Инициализация
    init: function(botToken, botUsername) {
        if (botToken) this.botToken = botToken;
        if (botUsername) this.botUsername = botUsername;
        console.log('🤖 Telegram Bot API инициализирован');
    },
    
    // Отправка сообщения пользователю
    sendMessage: async function(chatId, message, options = {}) {
        if (!this.botToken || this.botToken === 'ВАШ_BOT_TOKEN') {
            // Демо-режим - сохраняем сообщение в кэш
            const demoKey = `demo_${chatId}_${Date.now()}`;
            this.demoMessages[demoKey] = {
                chatId,
                message,
                options,
                timestamp: Date.now()
            };
            
            console.log(`📤 Демо: Сообщение для ${chatId}: ${message}`);
            
            // Очистка старых демо-сообщений
            this.cleanupDemoMessages();
            
            return { ok: true, result: { message_id: Date.now() } };
        }
        
        // Реальная отправка через Telegram Bot API
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            const params = {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                ...options
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
            });
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка отправки сообщения в Telegram:', error);
            return { ok: false, description: error.message };
        }
    },
    
    // Отправка кода верификации
    sendVerificationCode: async function(telegramUsername, code) {
        const message = `🔐 <b>Код подтверждения для MeetUP</b>\n\n` +
                       `Ваш код: <code>${code}</code>\n\n` +
                       `Введите этот код в приложении для подтверждения Telegram аккаунта.\n` +
                       `⏰ Код действителен 10 минут`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Отправка кода для сброса пароля
    sendPasswordResetCode: async function(telegramUsername, code) {
        const message = `🔄 <b>Сброс пароля MeetUP</b>\n\n` +
                       `Код для сброса пароля: <code>${code}</code>\n\n` +
                       `Введите этот код на странице восстановления пароля.\n` +
                       `⏰ Код действителен 10 минут\n\n` +
                       `⚠️ Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.`;
        
        return await this.sendMessage(`@${telegramUsername}`, message);
    },
    
    // Получение информации о пользователе
    getUserInfo: async function(telegramUsername) {
        if (!this.botToken || this.botToken === 'ВАШ_BOT_TOKEN') {
            // Демо-режим
            return {
                ok: true,
                result: {
                    username: telegramUsername.replace('@', ''),
                    first_name: 'Демо',
                    last_name: 'Пользователь'
                }
            };
        }
        
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/getChat`;
            const params = {
                chat_id: `@${telegramUsername}`
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
            });
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения информации о пользователе:', error);
            return { ok: false };
        }
    },
    
    // Очистка старых демо-сообщений
    cleanupDemoMessages: function() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        Object.keys(this.demoMessages).forEach(key => {
            if (now - this.demoMessages[key].timestamp > oneHour) {
                delete this.demoMessages[key];
            }
        });
    },
    
    // Получение последних демо-сообщений для пользователя
    getDemoMessagesForUser: function(telegramUsername) {
        const messages = [];
        const searchUsername = telegramUsername.replace('@', '');
        
        Object.values(this.demoMessages).forEach(msg => {
            if (msg.chatId === `@${searchUsername}`) {
                messages.push(msg);
            }
        });
        
        return messages.sort((a, b) => b.timestamp - a.timestamp);
    }
};

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramBotAPI;
}