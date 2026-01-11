// Усовершенствованная система чатов для MeetUP
// Версия 2.0

const ChatSystem = (function() {
    // Константы для ключей localStorage
    const STORAGE_KEYS = {
        CHATS: 'meetup_chats_v2',
        GLOBAL_CHAT: 'meetup_global_chat_v2',
        CHAT_INDEX: 'meetup_chat_index',
        USER_PREFERENCES: 'meetup_user_prefs'
    };
    
    // Кэш для быстрого доступа
    let cache = {
        chats: null,
        globalChat: null,
        userPrefs: null
    };
    
    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
    
    // Безопасный парсинг JSON
    function safeParse(jsonString, defaultValue = {}) {
        try {
            return jsonString ? JSON.parse(jsonString) : defaultValue;
        } catch (e) {
            console.error('Ошибка парсинга JSON:', e);
            return defaultValue;
        }
    }
    
    // Безопасное сохранение в localStorage
    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Ошибка сохранения в localStorage (${key}):`, e);
            // Очистка кэша при ошибке
            cache[key] = null;
            return false;
        }
    }
    
    // Генерация уникального ID
    function generateId(prefix = '') {
        return prefix + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + performance.now().toString(36).substr(2, 5);
    }
    
    // Форматирование времени (оптимизированная версия)
    function formatTime(timestamp, short = false) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Кэширование форматирования для одинаковых временных интервалов
        if (diff < 60000) return short ? '1м' : 'только что';
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return short ? `${minutes}м` : `${minutes} мин назад`;
        }
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return short ? `${hours}ч` : `${hours} ч назад`;
        }
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return short ? `${days}д` : `${days} д назад`;
        }
        
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: short ? '2-digit' : 'long',
            year: short ? '2-digit' : 'numeric'
        });
    }
    
    // Проверка валидности пользователя
    function isValidUserId(userId) {
        return userId && typeof userId === 'string' && userId.trim().length > 0;
    }
    
    // ===== ОСНОВНЫЕ ФУНКЦИИ ДЛЯ ЛИЧНЫХ ЧАТОВ =====
    
    // Получить все чаты пользователя (с кэшированием)
    function getUserChats(userId) {
        if (!isValidUserId(userId)) return [];
        
        if (!cache.chats) {
            cache.chats = safeParse(localStorage.getItem(STORAGE_KEYS.CHATS));
        }
        
        const userChats = cache.chats[userId] || [];
        
        // Сортируем по времени последнего сообщения (новые сверху)
        return userChats.sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
    }
    
    // Создать новый чат между двумя пользователями
    function createChat(userId1, userId2, chatName = null) {
        if (!isValidUserId(userId1) || !isValidUserId(userId2)) {
            throw new Error('Некорректные ID пользователей');
        }
        
        // Проверяем, существует ли уже чат
        const existingChat = findChat(userId1, userId2);
        if (existingChat) return existingChat;
        
        // Загружаем актуальные данные
        const chats = safeParse(localStorage.getItem(STORAGE_KEYS.CHATS));
        
        const chatId = generateId('chat_');
        const chat = {
            id: chatId,
            participants: [userId1, userId2],
            messages: [],
            createdAt: Date.now(),
            lastMessageAt: Date.now(),
            unreadCount: 0,
            isGroup: false,
            name: chatName || `Чат ${userId1} и ${userId2}`,
            avatar: null,
            customData: {}
        };
        
        // Инициализируем массивы чатов для пользователей, если их нет
        if (!chats[userId1]) chats[userId1] = [];
        if (!chats[userId2]) chats[userId2] = [];
        
        // Добавляем чат обоим пользователям
        chats[userId1].push(chat);
        chats[userId2].push(chat);
        
        // Сохраняем и обновляем кэш
        if (safeSetItem(STORAGE_KEYS.CHATS, chats)) {
            cache.chats = chats;
            
            // Обновляем индекс чатов
            updateChatIndex(chatId, [userId1, userId2]);
            
            console.log(`✅ Создан новый чат: ${chatId}`);
            return chat;
        }
        
        return null;
    }
    
    // Найти чат между двумя пользователями (оптимизированный поиск)
    function findChat(userId1, userId2) {
        if (!isValidUserId(userId1) || !isValidUserId(userId2)) return null;
        
        const userChats = getUserChats(userId1);
        
        // Быстрый поиск по участникам
        return userChats.find(chat => 
            !chat.isGroup && 
            chat.participants.length === 2 &&
            chat.participants.includes(userId2)
        );
    }
    
    // Обновить индекс чатов для быстрого поиска
    function updateChatIndex(chatId, participants) {
        const index = safeParse(localStorage.getItem(STORAGE_KEYS.CHAT_INDEX), {});
        
        index[chatId] = {
            participants,
            lastUpdated: Date.now()
        };
        
        safeSetItem(STORAGE_KEYS.CHAT_INDEX, index);
    }
    
    // Отправить сообщение в чат
    function sendMessage(chatId, senderId, text, attachments = null) {
        if (!chatId || !senderId || !text || text.trim().length === 0) {
            throw new Error('Некорректные данные сообщения');
        }
        
        const allChats = safeParse(localStorage.getItem(STORAGE_KEYS.CHATS));
        let chatFound = null;
        let foundInUserId = null;
        
        // Поиск чата во всех пользователях
        for (const [userId, chats] of Object.entries(allChats)) {
            const chatIndex = chats.findIndex(c => c.id === chatId);
            if (chatIndex !== -1) {
                chatFound = chats[chatIndex];
                foundInUserId = userId;
                break;
            }
        }
        
        if (!chatFound) {
            console.error(`Чат ${chatId} не найден`);
            return null;
        }
        
        // Проверяем, является ли отправитель участником чата
        if (!chatFound.participants.includes(senderId)) {
            throw new Error('Отправитель не является участником чата');
        }
        
        const message = {
            id: generateId('msg_'),
            senderId: senderId,
            text: text.trim(),
            timestamp: Date.now(),
            read: false,
            attachments: attachments,
            edited: false,
            deleted: false
        };
        
        // Добавляем сообщение в чат
        chatFound.messages.push(message);
        chatFound.lastMessageAt = message.timestamp;
        
        // Увеличиваем счетчик непрочитанных для других участников
        const otherParticipants = chatFound.participants.filter(id => id !== senderId);
        chatFound.unreadCount = (chatFound.unreadCount || 0) + otherParticipants.length;
        
        // Обновляем чат у всех участников
        for (const participantId of chatFound.participants) {
            if (allChats[participantId]) {
                const participantChatIndex = allChats[participantId].findIndex(c => c.id === chatId);
                if (participantChatIndex !== -1) {
                    allChats[participantId][participantChatIndex] = chatFound;
                } else {
                    // Если у участника почему-то нет этого чата, добавляем
                    allChats[participantId].push(chatFound);
                }
            } else {
                // Инициализируем массив чатов для нового участника
                allChats[participantId] = [chatFound];
            }
        }
        
        // Сохраняем изменения
        if (safeSetItem(STORAGE_KEYS.CHATS, allChats)) {
            cache.chats = allChats;
            
            // Обновляем последнюю активность в индексе
            if (foundInUserId) {
                updateChatIndex(chatId, chatFound.participants);
            }
            
            console.log(`✅ Сообщение отправлено в чат ${chatId}`);
            return message;
        }
        
        return null;
    }
    
    // Получить сообщения чата с пагинацией
    function getChatMessages(chatId, limit = 50, offset = 0) {
        if (!chatId) return [];
        
        const allChats = safeParse(localStorage.getItem(STORAGE_KEYS.CHATS));
        
        for (const chats of Object.values(allChats)) {
            const chat = chats.find(c => c.id === chatId);
            if (chat) {
                const messages = chat.messages || [];
                // Сортируем по времени (новые в конце)
                const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
                
                // Применяем пагинацию
                if (limit > 0) {
                    return sortedMessages.slice(offset, offset + limit);
                }
                
                return sortedMessages;
            }
        }
        
        return [];
    }
    
    // Отметить сообщения как прочитанные
    function markAsRead(chatId, userId) {
        if (!chatId || !userId) return false;
        
        const allChats = safeParse(localStorage.getItem(STORAGE_KEYS.CHATS));
        const userChats = allChats[userId] || [];
        const chatIndex = userChats.findIndex(c => c.id === chatId);
        
        if (chatIndex !== -1) {
            const chat = userChats[chatIndex];
            
            // Сбрасываем счетчик непрочитанных
            chat.unreadCount = 0;
            
            // Отмечаем сообщения как прочитанные
            chat.messages.forEach(msg => {
                if (msg.senderId !== userId && !msg.read) {
                    msg.read = true;
                    msg.readAt = Date.now();
                }
            });
            
            // Обновляем в общем хранилище
            allChats[userId] = userChats;
            
            // Также обновляем у других участников (только счетчик)
            for (const participantId of chat.participants) {
                if (participantId !== userId && allChats[participantId]) {
                    const participantChatIndex = allChats[participantId].findIndex(c => c.id === chatId);
                    if (participantChatIndex !== -1) {
                        // У других участников не сбрасываем счетчик, только у текущего
                        if (participantId === userId) {
                            allChats[participantId][participantChatIndex].unreadCount = 0;
                        }
                    }
                }
            }
            
            if (safeSetItem(STORAGE_KEYS.CHATS, allChats)) {
                cache.chats = allChats;
                return true;
            }
        }
        
        return false;
    }
    
    // Удалить чат для конкретного пользователя
    function deleteChatForUser(chatId, userId) {
        if (!chatId || !userId) return false;
        
        const allChats = safeParse(localStorage.getItem(STORAGE_KEYS.CHATS));
        
        if (allChats[userId]) {
            const initialLength = allChats[userId].length;
            allChats[userId] = allChats[userId].filter(chat => chat.id !== chatId);
            
            if (allChats[userId].length !== initialLength) {
                if (safeSetItem(STORAGE_KEYS.CHATS, allChats)) {
                    cache.chats = allChats;
                    console.log(`🗑️ Чат ${chatId} удален для пользователя ${userId}`);
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // Получить количество непрочитанных сообщений
    function getUnreadCount(userId) {
        const chats = getUserChats(userId);
        return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
    }
    
    // Получить последнее сообщение чата
    function getLastMessage(chat) {
        if (!chat || !chat.messages || chat.messages.length === 0) {
            return { 
                text: 'Нет сообщений', 
                timestamp: chat?.createdAt || Date.now(),
                isEmpty: true 
            };
        }
        
        const lastMessage = chat.messages[chat.messages.length - 1];
        
        // Если сообщение удалено, показываем заглушку
        if (lastMessage.deleted) {
            return {
                text: 'Сообщение удалено',
                timestamp: lastMessage.timestamp,
                isDeleted: true
            };
        }
        
        return lastMessage;
    }
    
    // Поиск сообщений по тексту
    function searchMessages(userId, query, limit = 20) {
        if (!query || query.trim().length < 2) return [];
        
        const userChats = getUserChats(userId);
        const results = [];
        const searchTerm = query.toLowerCase().trim();
        
        for (const chat of userChats) {
            for (const message of chat.messages || []) {
                if (message.text && message.text.toLowerCase().includes(searchTerm) && !message.deleted) {
                    results.push({
                        message: message,
                        chatId: chat.id,
                        chatName: chat.name
                    });
                    
                    if (results.length >= limit) break;
                }
            }
            
            if (results.length >= limit) break;
        }
        
        return results.sort((a, b) => b.message.timestamp - a.message.timestamp);
    }
    
    // ===== ФУНКЦИИ ДЛЯ ОБЩЕГО ЧАТА =====
    
    // Получить общий чат (с кэшированием)
    function getGlobalChat() {
        if (cache.globalChat !== null) {
            return cache.globalChat;
        }
        
        try {
            const globalChat = localStorage.getItem(STORAGE_KEYS.GLOBAL_CHAT);
            cache.globalChat = globalChat ? safeParse(globalChat) : null;
            return cache.globalChat;
        } catch (e) {
            console.error('Ошибка загрузки общего чата:', e);
            cache.globalChat = null;
            return null;
        }
    }
    
    // Сохранить общий чат
    function saveGlobalChat(chatData) {
        if (!chatData) return false;
        
        try {
            if (safeSetItem(STORAGE_KEYS.GLOBAL_CHAT, chatData)) {
                cache.globalChat = chatData;
                return true;
            }
            return false;
        } catch (e) {
            console.error('Ошибка сохранения общего чата:', e);
            cache.globalChat = null;
            return false;
        }
    }
    
    // Добавить сообщение в общий чат
    function addMessageToGlobalChat(message) {
        let globalChat = getGlobalChat();
        
        if (!globalChat) {
            // Если общего чата нет, инициализируем его
            initializeGlobalChat();
            globalChat = getGlobalChat();
        }
        
        if (!globalChat) return false;
        
        // Инициализируем массив сообщений, если его нет
        if (!globalChat.messages) {
            globalChat.messages = [];
        }
        
        // Добавляем сообщение
        globalChat.messages.push(message);
        
        // Обновляем метаданные
        globalChat.lastMessageAt = message.timestamp;
        globalChat.totalMessages = (globalChat.totalMessages || 0) + 1;
        globalChat.participantCount = globalChat.participants ? globalChat.participants.length : 0;
        
        // Ограничиваем количество сообщений (оставляем последние 1000)
        if (globalChat.messages.length > 1000) {
            globalChat.messages = globalChat.messages.slice(-1000);
        }
        
        return saveGlobalChat(globalChat);
    }
    
    // Получить сообщения общего чата с пагинацией
    function getGlobalChatMessages(limit = 50, offset = 0) {
        const globalChat = getGlobalChat();
        
        if (globalChat && globalChat.messages) {
            const messages = globalChat.messages.sort((a, b) => a.timestamp - b.timestamp);
            
            if (limit > 0) {
                return messages.slice(offset, offset + limit);
            }
            
            return messages;
        }
        
        return [];
    }
    
    // Инициализировать общий чат при первом запуске
    function initializeGlobalChat() {
        if (getGlobalChat()) {
            return getGlobalChat();
        }
        
        const initialGlobalChat = {
            id: 'global_chat_meetup',
            name: 'Общий чат MeetUP',
            description: 'Основной чат сообщества MeetUP. Здесь могут общаться все пользователи.',
            avatar: 'meetup-logo.png',
            participants: [], // Пустой массив означает, что чат доступен всем
            messages: [
                {
                    id: 'welcome_message_1',
                    senderId: 'system',
                    senderName: 'Система MeetUP',
                    text: 'Добро пожаловать в общий чат MeetUP! Здесь вы можете общаться со всеми пользователями сообщества.',
                    timestamp: Date.now(),
                    type: 'system',
                    read: true,
                    isWelcome: true
                },
                {
                    id: 'welcome_message_2',
                    senderId: 'system',
                    senderName: 'Система MeetUP',
                    text: 'Правила чата: 1. Уважайте других участников. 2. Не спамьте. 3. Делитесь полезной информацией о встречах.',
                    timestamp: Date.now() + 1000,
                    type: 'system',
                    read: true,
                    isWelcome: true
                }
            ],
            createdAt: Date.now(),
            lastMessageAt: Date.now(),
            isGlobal: true,
            totalMessages: 2,
            participantCount: 0,
            cannotBeDeleted: true,
            settings: {
                allowImages: true,
                maxMessageLength: 1000,
                rateLimit: 3 // сообщений в секунду
            }
        };
        
        if (saveGlobalChat(initialGlobalChat)) {
            console.log('✅ Общий чат инициализирован');
            return initialGlobalChat;
        }
        
        return null;
    }
    
    // ===== УНИВЕРСАЛЬНЫЕ ФУНКЦИИ =====
    
    // Получить чат по ID (поддерживает как личные, так и общие чаты)
    function getChatById(chatId, userId = null) {
        if (chatId === 'global_chat_meetup') {
            return getGlobalChat();
        }
        
        if (userId) {
            const userChats = getUserChats(userId);
            return userChats.find(chat => chat.id === chatId);
        }
        
        // Поиск во всех чатах (менее эффективно)
        const allChats = safeParse(localStorage.getItem(STORAGE_KEYS.CHATS));
        for (const chats of Object.values(allChats)) {
            const chat = chats.find(c => c.id === chatId);
            if (chat) return chat;
        }
        
        return null;
    }
    
    // Отправить сообщение в любой чат (общий или личный)
    function sendMessageToChat(chatId, senderId, senderName, text, isGlobal = false) {
        if (chatId === 'global_chat_meetup' || isGlobal) {
            const message = {
                id: generateId('global_msg_'),
                senderId: senderId,
                senderName: senderName || `Пользователь ${senderId}`,
                text: text.trim(),
                timestamp: Date.now(),
                read: false,
                type: 'user'
            };
            
            return addMessageToGlobalChat(message);
        } else {
            return sendMessage(chatId, senderId, text);
        }
    }
    
    // Получить сообщения любого чата
    function getMessages(chatId, userId = null, limit = 50, offset = 0) {
        if (chatId === 'global_chat_meetup') {
            return getGlobalChatMessages(limit, offset);
        } else {
            return getChatMessages(chatId, limit, offset);
        }
    }
    
    // Очистить кэш (например, при выходе пользователя)
    function clearCache() {
        cache = {
            chats: null,
            globalChat: null,
            userPrefs: null
        };
    }
    
    // Получить статистику системы
    function getStats() {
        const allChats = safeParse(localStorage.getItem(STORAGE_KEYS.CHATS));
        const globalChat = getGlobalChat();
        
        let totalUsers = 0;
        let totalPrivateChats = 0;
        let totalMessages = 0;
        
        // Статистика по личным чатам
        for (const [userId, chats] of Object.entries(allChats)) {
            if (chats && chats.length > 0) {
                totalUsers++;
                totalPrivateChats += chats.length;
                
                for (const chat of chats) {
                    totalMessages += (chat.messages || []).length;
                }
            }
        }
        
        // Добавляем статистику общего чата
        if (globalChat) {
            totalMessages += (globalChat.messages || []).length;
        }
        
        return {
            totalUsers,
            totalPrivateChats,
            totalMessages,
            globalChatMessages: globalChat ? (globalChat.messages || []).length : 0,
            storageKeys: Object.keys(STORAGE_KEYS).map(key => STORAGE_KEYS[key])
        };
    }
    
    // Миграция данных со старой версии
    function migrateFromV1() {
        try {
            const oldChats = localStorage.getItem('meetup_chats');
            const oldGlobalChat = localStorage.getItem('meetup_global_chat');
            
            if (oldChats) {
                console.log('🔄 Обнаружены данные старой версии, начинаю миграцию...');
                
                const parsedOldChats = safeParse(oldChats);
                if (parsedOldChats && Object.keys(parsedOldChats).length > 0) {
                    safeSetItem(STORAGE_KEYS.CHATS, parsedOldChats);
                    console.log('✅ Чаты мигрированы');
                }
            }
            
            if (oldGlobalChat) {
                const parsedOldGlobalChat = safeParse(oldGlobalChat);
                if (parsedOldGlobalChat) {
                    safeSetItem(STORAGE_KEYS.GLOBAL_CHAT, parsedOldGlobalChat);
                    console.log('✅ Общий чат мигрирован');
                }
            }
            
            // Инициализируем общий чат, если его нет
            initializeGlobalChat();
            
            console.log('✅ Миграция завершена');
            return true;
        } catch (e) {
            console.error('Ошибка миграции:', e);
            return false;
        }
    }
    
    // Инициализация системы
    function init() {
        console.log('🚀 Инициализация системы чатов...');
        
        // Пытаемся мигрировать данные со старой версии
        migrateFromV1();
        
        // Инициализируем общий чат
        initializeGlobalChat();
        
        console.log('✅ Система чатов готова');
        return getStats();
    }
    
    // Публичное API
    return {
        // Основные функции
        init,
        getUserChats,
        createChat,
        findChat,
        sendMessage,
        getChatMessages,
        markAsRead,
        getUnreadCount,
        getLastMessage,
        
        // Функции общего чата
        getGlobalChat,
        getGlobalChatMessages,
        initializeGlobalChat,
        addMessageToGlobalChat,
        
        // Универсальные функции
        getChatById,
        sendMessageToChat,
        getMessages,
        
        // Дополнительные функции
        deleteChatForUser,
        searchMessages,
        formatTime,
        getStats,
        clearCache,
        
        // Утилиты
        generateId,
        safeParse,
        safeSetItem
    };
})();

// Автоматическая инициализация при загрузке
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            ChatSystem.init();
        }, 100);
    });
}
