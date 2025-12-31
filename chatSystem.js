[file name]: chatSystem.js
[file content begin]
// Система чатов для MeetUP

const ChatSystem = {
    // Получить все чаты текущего пользователя
    getUserChats: function(userId) {
        const chats = JSON.parse(localStorage.getItem('meetup_chats') || '{}');
        return chats[userId] || [];
    },
    
    // Создать новый чат
    createChat: function(userId1, userId2) {
        const chats = JSON.parse(localStorage.getItem('meetup_chats') || '{}');
        
        // Проверяем, существует ли уже чат
        const existingChat = this.findChat(userId1, userId2);
        if (existingChat) return existingChat;
        
        const chatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const chat = {
            id: chatId,
            participants: [userId1, userId2],
            messages: [],
            createdAt: Date.now(),
            lastMessageAt: Date.now(),
            unreadCount: 0
        };
        
        if (!chats[userId1]) chats[userId1] = [];
        if (!chats[userId2]) chats[userId2] = [];
        
        chats[userId1].push(chat);
        chats[userId2].push(chat);
        
        localStorage.setItem('meetup_chats', JSON.stringify(chats));
        return chat;
    },
    
    // Найти чат между двумя пользователями
    findChat: function(userId1, userId2) {
        const chats = JSON.parse(localStorage.getItem('meetup_chats') || '{}');
        const userChats = chats[userId1] || [];
        
        return userChats.find(chat => 
            chat.participants.includes(userId1) && 
            chat.participants.includes(userId2)
        );
    },
    
    // Отправить сообщение
    sendMessage: function(chatId, senderId, text) {
        const allChats = JSON.parse(localStorage.getItem('meetup_chats') || '{}');
        let chatFound = null;
        let userKey = null;
        
        // Находим чат
        for (const [userId, chats] of Object.entries(allChats)) {
            const chat = chats.find(c => c.id === chatId);
            if (chat) {
                chatFound = chat;
                userKey = userId;
                break;
            }
        }
        
        if (!chatFound) return null;
        
        const message = {
            id: 'msg_' + Date.now(),
            senderId: senderId,
            text: text,
            timestamp: Date.now(),
            read: false
        };
        
        chatFound.messages.push(message);
        chatFound.lastMessageAt = Date.now();
        
        // Увеличиваем счетчик непрочитанных для другого участника
        const otherParticipant = chatFound.participants.find(id => id !== senderId);
        chatFound.unreadCount = (chatFound.unreadCount || 0) + 1;
        
        // Обновляем во всех местах
        for (const participantId of chatFound.participants) {
            if (allChats[participantId]) {
                const index = allChats[participantId].findIndex(c => c.id === chatId);
                if (index !== -1) {
                    allChats[participantId][index] = chatFound;
                }
            }
        }
        
        localStorage.setItem('meetup_chats', JSON.stringify(allChats));
        return message;
    },
    
    // Получить сообщения чата
    getChatMessages: function(chatId) {
        const allChats = JSON.parse(localStorage.getItem('meetup_chats') || '{}');
        
        for (const chats of Object.values(allChats)) {
            const chat = chats.find(c => c.id === chatId);
            if (chat) return chat.messages || [];
        }
        
        return [];
    },
    
    // Отметить сообщения как прочитанные
    markAsRead: function(chatId, userId) {
        const allChats = JSON.parse(localStorage.getItem('meetup_chats') || '{}');
        const userChats = allChats[userId] || [];
        const chatIndex = userChats.findIndex(c => c.id === chatId);
        
        if (chatIndex !== -1) {
            userChats[chatIndex].unreadCount = 0;
            
            // Обновляем сообщения как прочитанные
            userChats[chatIndex].messages.forEach(msg => {
                if (msg.senderId !== userId) {
                    msg.read = true;
                }
            });
            
            allChats[userId] = userChats;
            localStorage.setItem('meetup_chats', JSON.stringify(allChats));
        }
    },
    
    // Получить количество непрочитанных сообщений
    getUnreadCount: function(userId) {
        const chats = this.getUserChats(userId);
        return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
    },
    
    // Получить последнее сообщение чата
    getLastMessage: function(chat) {
        if (!chat.messages || chat.messages.length === 0) {
            return { text: 'Нет сообщений', timestamp: chat.createdAt };
        }
        
        return chat.messages[chat.messages.length - 1];
    },
    
    // Форматирование времени
    formatTime: function(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
        if (diff < 604800000) return Math.floor(diff / 86400000) + ' д назад';
        
        return date.toLocaleDateString('ru-RU');
    },

    // ===== ФУНКЦИИ ДЛЯ ОБЩЕГО ЧАТА =====

    // Получить общий чат
    getGlobalChat: function() {
        try {
            const globalChat = localStorage.getItem('meetup_global_chat');
            if (globalChat) {
                return JSON.parse(globalChat);
            }
        } catch (e) {
            console.error('Ошибка загрузки общего чата:', e);
        }
        return null;
    },

    // Сохранить общий чат
    saveGlobalChat: function(chatData) {
        try {
            localStorage.setItem('meetup_global_chat', JSON.stringify(chatData));
            return true;
        } catch (e) {
            console.error('Ошибка сохранения общего чата:', e);
            return false;
        }
    },

    // Добавить сообщение в общий чат
    addMessageToGlobalChat: function(message) {
        const globalChat = this.getGlobalChat();
        if (!globalChat) return false;
        
        if (!globalChat.messages) {
            globalChat.messages = [];
        }
        
        globalChat.messages.push(message);
        
        // Увеличиваем счетчик непрочитанных для всех пользователей
        // В реальном приложении здесь была бы сложная логика отслеживания
        // Для простоты просто увеличиваем счетчик
        globalChat.totalMessages = (globalChat.totalMessages || 0) + 1;
        
        return this.saveGlobalChat(globalChat);
    },

    // Получить все сообщения общего чата
    getGlobalChatMessages: function() {
        const globalChat = this.getGlobalChat();
        if (globalChat && globalChat.messages) {
            return globalChat.messages;
        }
        return [];
    },

    // Инициализировать общий чат при первом запуске
    initializeGlobalChat: function() {
        const globalChat = this.getGlobalChat();
        
        if (!globalChat) {
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
                        read: true
                    },
                    {
                        id: 'welcome_message_2',
                        senderId: 'system',
                        senderName: 'Система MeetUP',
                        text: 'Правила чата: 1. Уважайте других участников. 2. Не спамьте. 3. Делитесь полезной информацией о встречах.',
                        timestamp: Date.now() + 1000,
                        type: 'system',
                        read: true
                    }
                ],
                createdAt: Date.now(),
                lastMessageAt: Date.now(),
                isGlobal: true,
                totalMessages: 2,
                cannotBeDeleted: true
            };
            
            this.saveGlobalChat(initialGlobalChat);
            console.log('✅ Общий чат инициализирован');
        }
        
        return this.getGlobalChat();
    },

    // Получить чат по ID (поддерживает как личные, так и общие чаты)
    getChatById: function(chatId, userId) {
        if (chatId === 'global_chat_meetup') {
            return this.getGlobalChat();
        }
        
        const userChats = this.getUserChats(userId);
        return userChats.find(chat => chat.id === chatId);
    },

    // Отправить сообщение (поддерживает общие чаты)
    sendMessageToChat: function(chatId, senderId, senderName, text) {
        if (chatId === 'global_chat_meetup') {
            const message = {
                id: 'global_msg_' + Date.now(),
                senderId: senderId,
                senderName: senderName,
                text: text,
                timestamp: Date.now(),
                read: false,
                type: 'user'
            };
            
            return this.addMessageToGlobalChat(message);
        } else {
            return this.sendMessage(chatId, senderId, text);
        }
    },

    // Получить сообщения чата (поддерживает общие чаты)
    getMessages: function(chatId, userId) {
        if (chatId === 'global_chat_meetup') {
            return this.getGlobalChatMessages();
        } else {
            return this.getChatMessages(chatId);
        }
    }
};
[file content end]
