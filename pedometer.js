// Шагомер для MeetUP

const Pedometer = {
    isSupported: function() {
        return 'DeviceMotionEvent' in window && 
               typeof DeviceMotionEvent.requestPermission === 'function' ? true : 
               'ondevicemotion' in window;
    },
    
    // Статистика шагов
    stats: {
        today: 0,
        week: 0,
        month: 0,
        totalDistance: 0,
        lastUpdate: Date.now(),
        goal: 10000, // цель по умолчанию: 10,000 шагов
        lastDayReset: null
    },
    
    // Состояние отслеживания
    isTracking: false,
    lastAcceleration: null,
    stepCount: 0,
    lastStepTime: 0,
    
    // Константы
    THRESHOLD: 10, // Порог для обнаружения шага
    STEP_DELAY: 300, // Минимальная задержка между шагами (мс)
    STEP_LENGTH: 0.00076, // Длина шага в километрах (0.76 метра)
    CALORIES_PER_STEP: 0.04, // Калории на шаг
    
    // Инициализация шагомера
    initialize: function() {
        if (!this.isSupported()) {
            console.warn('Шагомер не поддерживается этим устройством');
            return Promise.resolve(false);
        }
        
        this.loadStats();
        
        // Для iOS 13+ требуется разрешение
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            return DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        this.startTracking();
                        return true;
                    } else {
                        console.warn('Доступ к датчикам отклонен');
                        return false;
                    }
                })
                .catch(error => {
                    console.error('Ошибка при запросе разрешения:', error);
                    return false;
                });
        } else {
            // Для Android и других устройств
            this.startTracking();
            return Promise.resolve(true);
        }
    },
    
    // Загрузка статистики
    loadStats: function() {
        const saved = localStorage.getItem('meetup_pedometer_stats');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const now = new Date();
                const lastUpdate = new Date(parsed.lastUpdate);
                
                // Сбрасываем сегодняшние шаги если это новый день
                if (lastUpdate.getDate() !== now.getDate() || 
                    lastUpdate.getMonth() !== now.getMonth() || 
                    lastUpdate.getFullYear() !== now.getFullYear()) {
                    parsed.today = 0;
                }
                
                // Сбрасываем недельную статистику если прошла неделя
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                if (lastUpdate < weekAgo) {
                    parsed.week = 0;
                }
                
                // Сбрасываем месячную статистику если прошел месяц
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                if (lastUpdate < monthAgo) {
                    parsed.month = 0;
                }
                
                this.stats = { ...this.stats, ...parsed };
            } catch (error) {
                console.error('Ошибка при загрузке статистики:', error);
                this.resetStats();
            }
        }
    },
    
    // Сохранение статистики
    saveStats: function() {
        try {
            this.stats.lastUpdate = Date.now();
            localStorage.setItem('meetup_pedometer_stats', JSON.stringify(this.stats));
        } catch (error) {
            console.error('Ошибка при сохранении статистики:', error);
        }
    },
    
    // Начало отслеживания
    startTracking: function() {
        if (this.isTracking) {
            return;
        }
        
        const motionHandler = (event) => {
            const acceleration = event.accelerationIncludingGravity;
            
            if (!acceleration || acceleration.x === null || 
                acceleration.y === null || acceleration.z === null) {
                return;
            }
            
            // Вычисляем общее ускорение
            const totalAcceleration = Math.sqrt(
                acceleration.x * acceleration.x + 
                acceleration.y * acceleration.y + 
                acceleration.z * acceleration.z
            );
            
            if (this.lastAcceleration !== null) {
                const delta = Math.abs(totalAcceleration - this.lastAcceleration);
                const currentTime = Date.now();
                
                // Обнаружение шага
                if (delta > this.THRESHOLD && 
                    (currentTime - this.lastStepTime) > this.STEP_DELAY) {
                    this.stepCount++;
                    this.lastStepTime = currentTime;
                    
                    // Обновляем статистику каждые 10 шагов для производительности
                    if (this.stepCount >= 10) {
                        this.addSteps(this.stepCount);
                        this.stepCount = 0;
                    }
                }
            }
            
            this.lastAcceleration = totalAcceleration;
        };
        
        // Добавляем обработчик с флагом passive для производительности
        window.addEventListener('devicemotion', motionHandler, { passive: true });
        
        // Сохраняем ссылку на обработчик для удаления
        this.motionHandler = motionHandler;
        this.isTracking = true;
        
        console.log('Отслеживание шагов начато');
    },
    
    // Остановка отслеживания
    stopTracking: function() {
        if (this.motionHandler) {
            window.removeEventListener('devicemotion', this.motionHandler);
            this.motionHandler = null;
        }
        this.isTracking = false;
        this.lastAcceleration = null;
        console.log('Отслеживание шагов остановлено');
    },
    
    // Добавление шагов
    addSteps: function(steps) {
        if (steps <= 0) return;
        
        // Проверяем, не нужно ли сбросить дневную статистику
        this.checkAndResetDailyStats();
        
        this.stats.today += steps;
        this.stats.week += steps;
        this.stats.month += steps;
        
        // Расчет расстояния
        const distance = steps * this.STEP_LENGTH;
        this.stats.totalDistance += distance;
        
        this.saveStats();
        
        // Отправляем событие об обновлении
        try {
            const event = new CustomEvent('pedometerUpdate', { detail: this.getStats() });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Ошибка при отправке события:', error);
        }
    },
    
    // Проверка и сброс дневной статистики
    checkAndResetDailyStats: function() {
        const now = new Date();
        const lastUpdate = new Date(this.stats.lastUpdate);
        
        if (lastUpdate.getDate() !== now.getDate() || 
            lastUpdate.getMonth() !== now.getMonth() || 
            lastUpdate.getFullYear() !== now.getFullYear()) {
            this.stats.today = 0;
        }
    },
    
    // Ручное добавление шагов (для тестирования)
    addStepsManually: function(steps) {
        if (typeof steps !== 'number' || steps <= 0) {
            console.error('Некорректное количество шагов:', steps);
            return this.getStats();
        }
        
        this.addSteps(steps);
        return this.getStats();
    },
    
    // Получение статистики
    getStats: function() {
        this.checkAndResetDailyStats();
        
        const goalProgress = this.stats.goal > 0 ? 
            Math.min(100, (this.stats.today / this.stats.goal) * 100) : 0;
        
        return {
            today: this.stats.today,
            week: this.stats.week,
            month: this.stats.month,
            totalDistance: parseFloat(this.stats.totalDistance.toFixed(2)),
            goal: this.stats.goal,
            lastUpdate: this.stats.lastUpdate,
            calories: Math.round(this.stats.today * this.CALORIES_PER_STEP),
            distanceToday: parseFloat((this.stats.today * this.STEP_LENGTH).toFixed(2)),
            goalProgress: parseFloat(goalProgress.toFixed(1)),
            isTracking: this.isTracking
        };
    },
    
    // Сброс статистики
    resetStats: function(type = 'all') {
        switch(type) {
            case 'today':
                this.stats.today = 0;
                break;
            case 'week':
                this.stats.week = 0;
                break;
            case 'month':
                this.stats.month = 0;
                break;
            case 'all':
            default:
                this.stats = {
                    today: 0,
                    week: 0,
                    month: 0,
                    totalDistance: 0,
                    lastUpdate: Date.now(),
                    goal: this.stats.goal || 10000
                };
                break;
        }
        
        this.saveStats();
        
        // Отправляем событие о сбросе
        try {
            const event = new CustomEvent('pedometerReset', { detail: { type } });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Ошибка при отправке события:', error);
        }
        
        return this.getStats();
    },
    
    // Установка цели
    setGoal: function(steps) {
        if (typeof steps !== 'number' || steps <= 0) {
            console.error('Некорректная цель:', steps);
            return false;
        }
        
        this.stats.goal = Math.floor(steps);
        this.saveStats();
        
        // Отправляем событие об изменении цели
        try {
            const event = new CustomEvent('pedometerGoalChanged', { detail: { goal: this.stats.goal } });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Ошибка при отправке события:', error);
        }
        
        return true;
    },
    
    // Имитация шагов для устройств без датчиков
    simulateSteps: function(min = 50, max = 150) {
        const steps = Math.floor(Math.random() * (max - min + 1)) + min;
        this.addSteps(steps);
        
        console.log(`Симулировано ${steps} шагов`);
        return steps;
    },
    
    // Проверка достижения цели
    isGoalAchieved: function() {
        return this.stats.today >= this.stats.goal;
    },
    
    // Получение оставшихся шагов до цели
    getRemainingSteps: function() {
        return Math.max(0, this.stats.goal - this.stats.today);
    },
    
    // Экспорт статистики
    exportStats: function() {
        return JSON.stringify(this.getStats(), null, 2);
    },
    
    // Импорт статистики
    importStats: function(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.stats = { ...this.stats, ...imported };
            this.saveStats();
            return true;
        } catch (error) {
            console.error('Ошибка при импорте статистики:', error);
            return false;
        }
    }
};
