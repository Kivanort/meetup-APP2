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
    }
};
