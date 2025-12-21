// telegram-bot-api.js - Модуль для работы с Telegram Bot API
const TelegramBotAPI = {
    // Конфигурация бота (ВАШ_ТОКЕН из @BotFather)
    botToken: '8431099911:AAFGMszkfzgTzoWEBZcgn7ENvVCr7faWqL0',
    botUsername: '@MeetUPpasswordbot',
    
    // Кэш для временного хранения кодов
    resetCodes: new Map(),
    
    // Инициализация
    init: function(botToken, botUsername) {
        if (botToken) this.botToken = botToken;
        if (botUsername) this.botUsername = botUsername;
        console.log('🤖 Telegram Bot API инициализирован с токеном:', this.botToken ? '***' + this.botToken.slice(-4) : 'не установлен');
    },
    
    // Проверка валидности токена
    validateToken: function() {
        return this.botToken && this.botToken !== 'ВАШ_BOT_TOKEN' && this.botToken.length > 30;
    },
    
    // Отправка сообщения пользователю через Telegram Bot API
    sendMessage: async function(chatId, text, options = {}) {
        if (!this.validateToken()) {
            console.warn('⚠️ Токен бота не настроен. Включен демо-режим.');
            return this.demoSendMessage(chatId, text);
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
            
            console.log(`📤 Отправка сообщения в Telegram: ${chatId}`);
            
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
                throw new Error(result.description || 'Ошибка отправки сообщения');
            }
            
            console.log('✅ Сообщение успешно отправлено в Telegram');
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения в Telegram:', error);
            // При ошибке переключаемся в демо-режим
            return this.demoSendMessage(chatId, text);
        }
    },
    
    // Демо-режим отправки (код в консоль)
    demoSendMessage: function(chatId, text) {
        console.log(`📤 ДЕМО-РЕЖИМ: Сообщение для ${chatId}:`);
        console.log(`📝 Текст: ${text}`);
        console.log('👉 Для реальной отправки настройте токен бота в TelegramBotAPI.botToken');
        
        // Извлекаем код из сообщения для демо-режима
        const codeMatch = text.match(/код[:\s]*(\d{6})/i) || text.match(/(\d{6})/);
        if (codeMatch) {
            console.log(`🔐 Код для демо: ${codeMatch[1]}`);
        }
        
        return { ok: true, result: { message_id: Date.now(), isDemo: true } };
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
    
    // Генерация и сохранение кода сброса
    generateAndStoreResetCode: function(userId, telegramUsername) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + (10 * 60 * 1000); // 10 минут
        
        const resetData = {
            code: code,
            userId: userId,
            telegramUsername: telegramUsername,
            expiresAt: expiresAt,
            createdAt: Date.now(),
            attempts: 0,
            verified: false
        };
        
        // Сохраняем код в localStorage для проверки
        localStorage.setItem(`tg_reset_${telegramUsername}`, JSON.stringify(resetData));
        
        // Также сохраняем в памяти для быстрого доступа
        this.resetCodes.set(`tg_${telegramUsername}`, resetData);
        
        console.log(`🔐 Сгенерирован код сброса для @${telegramUsername}: ${code}`);
        
        return { code, expiresAt };
    },
    
    // Проверка кода сброса
    verifyResetCode: function(telegramUsername, code) {
        const storageKey = `tg_reset_${telegramUsername}`;
        const storedData = localStorage.getItem(storageKey);
        
        if (!storedData) {
            return { valid: false, error: 'Код не найден или истек' };
        }
        
        const resetData = JSON.parse(storedData);
        
        // Проверяем срок действия
        if (Date.now() > resetData.expiresAt) {
            localStorage.removeItem(storageKey);
            this.resetCodes.delete(`tg_${telegramUsername}`);
            return { valid: false, error: 'Срок действия кода истек' };
        }
        
        // Проверяем код
        if (resetData.code !== code) {
            resetData.attempts = (resetData.attempts || 0) + 1;
            
            // Сохраняем обновленные данные
            localStorage.setItem(storageKey, JSON.stringify(resetData));
            this.resetCodes.set(`tg_${telegramUsername}`, resetData);
            
            // Блокируем после 5 неудачных попыток
            if (resetData.attempts >= 5) {
                localStorage.removeItem(storageKey);
                this.resetCodes.delete(`tg_${telegramUsername}`);
                return { valid: false, error: 'Слишком много попыток. Запросите новый код' };
            }
            
            return { valid: false, error: 'Неверный код' };
        }
        
        // Код верный
        resetData.verified = true;
        resetData.verifiedAt = Date.now();
        
        localStorage.setItem(storageKey, JSON.stringify(resetData));
        this.resetCodes.set(`tg_${telegramUsername}`, resetData);
        
        return { 
            valid: true, 
            userId: resetData.userId,
            telegramUsername: resetData.telegramUsername 
        };
    },
    
    // Получение информации о пользователе из Telegram
    getUserInfo: async function(telegramUsername) {
        if (!this.validateToken()) {
            // Демо-режим
            return {
                ok: true,
                result: {
                    username: telegramUsername.replace('@', ''),
                    first_name: 'Пользователь',
                    last_name: 'Telegram'
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
            console.error('❌ Ошибка получения информации о пользователе:', error);
            return { ok: false };
        }
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
    
    // Очистка старых кодов
    cleanupExpiredCodes: function() {
        const now = Date.now();
        const keysToRemove = [];
        
        // Очищаем localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('tg_reset_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.expiresAt && now > data.expiresAt) {
                        localStorage.removeItem(key);
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            }
        }
        
        // Очищаем кэш в памяти
        for (const [key, data] of this.resetCodes.entries()) {
            if (data.expiresAt && now > data.expiresAt) {
                this.resetCodes.delete(key);
            }
        }
        
        if (keysToRemove.length > 0) {
            console.log(`🗑️ Очищено ${keysToRemove.length} устаревших кодов`);
        }
    },
    
    // Получение статистики
    getStats: function() {
        let validCodes = 0;
        let expiredCodes = 0;
        const now = Date.now();
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('tg_reset_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data) {
                        if (data.expiresAt && now < data.expiresAt) {
                            validCodes++;
                        } else {
                            expiredCodes++;
                        }
                    }
                } catch (e) {
                    // Игнорируем ошибки
                }
            }
        }
        
        return {
            totalCodes: validCodes + expiredCodes,
            validCodes: validCodes,
            expiredCodes: expiredCodes,
            memoryCacheSize: this.resetCodes.size,
            botConfigured: this.validateToken()
        };
    }
};

// Автоматическая очистка устаревших кодов каждые 5 минут
setInterval(() => {
    TelegramBotAPI.cleanupExpiredCodes();
}, 5 * 60 * 1000);

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramBotAPI;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    TelegramBotAPI.init();
    TelegramBotAPI.cleanupExpiredCodes();
    console.log('🤖 Telegram Bot API готов к работе');
});
