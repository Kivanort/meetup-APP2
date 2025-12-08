[file name]: pedometer.js
[file content begin]
// Шагомер для MeetUP

const Pedometer = {
    isSupported: function() {
        return 'DeviceMotionEvent' in window || 'ondevicemotion' in window;
    },
    
    // Статистика шагов
    stats: {
        today: 0,
        week: 0,
        month: 0,
        totalDistance: 0,
        lastUpdate: Date.now(),
        goal: 10000 // цель по умолчанию: 10,000 шагов
    },
    
    // Инициализация шагомера
    initialize: function() {
        if (!this.isSupported()) {
            console.warn('Шагомер не поддерживается этим устройством');
            return false;
        }
        
        this.loadStats();
        
        // Запрашиваем разрешение на доступ к датчикам (для iOS)
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        this.startTracking();
                    }
                })
                .catch(console.error);
        } else {
            this.startTracking();
        }
        
        return true;
    },
    
    // Загрузка статистики
    loadStats: function() {
        const saved = localStorage.getItem('meetup_pedometer_stats');
        if (saved) {
            const parsed = JSON.parse(saved);
            
            // Проверяем, нужно ли сбросить дневную статистику
            const lastUpdate = new Date(parsed.lastUpdate);
            const today = new Date();
            
            if (lastUpdate.getDate() !== today.getDate() || 
                lastUpdate.getMonth() !== today.getMonth() || 
                lastUpdate.getFullYear() !== today.getFullYear()) {
                // Новый день - сбрасываем сегодняшние шаги
                parsed.today = 0;
            }
            
            this.stats = { ...this.stats, ...parsed };
        }
    },
    
    // Сохранение статистики
    saveStats: function() {
        this.stats.lastUpdate = Date.now();
        localStorage.setItem('meetup_pedometer_stats', JSON.stringify(this.stats));
    },
    
    // Начало отслеживания
    startTracking: function() {
        let lastAcceleration = null;
        let stepCount = 0;
        const threshold = 10; // Порог для обнаружения шага
        let lastStepTime = 0;
        const stepDelay = 300; // Минимальная задержка между шагами (мс)
        
        window.addEventListener('devicemotion', (event) => {
            const acceleration = event.accelerationIncludingGravity;
            
            if (!acceleration) return;
            
            // Вычисляем общее ускорение
            const totalAcceleration = Math.sqrt(
                Math.pow(acceleration.x, 2) + 
                Math.pow(acceleration.y, 2) + 
                Math.pow(acceleration.z, 2)
            );
            
            if (lastAcceleration !== null) {
                const delta = Math.abs(totalAcceleration - lastAcceleration);
                const currentTime = Date.now();
                
                // Обнаружение шага
                if (delta > threshold && (currentTime - lastStepTime) > stepDelay) {
                    stepCount++;
                    lastStepTime = currentTime;
                    
                    // Обновляем статистику каждые 10 шагов для производительности
                    if (stepCount % 10 === 0) {
                        this.addSteps(10);
                        stepCount = 0;
                    }
                }
            }
            
            lastAcceleration = totalAcceleration;
        });
    },
    
    // Добавление шагов
    addSteps: function(steps) {
        this.stats.today += steps;
        this.stats.week += steps;
        this.stats.month += steps;
        
        // Расчет расстояния (средний шаг = 0.76 метра)
        const distance = steps * 0.00076; // в километрах
        this.stats.totalDistance += distance;
        
        this.saveStats();
        
        // Отправляем событие об обновлении
        const event = new CustomEvent('pedometerUpdate', { detail: this.stats });
        window.dispatchEvent(event);
    },
    
    // Ручное добавление шагов (для тестирования)
    addStepsManually: function(steps) {
        this.addSteps(steps);
        return this.stats;
    },
    
    // Получение статистики
    getStats: function() {
        const today = new Date();
        const lastUpdate = new Date(this.stats.lastUpdate);
        
        // Сброс статистики при новом дне
        if (lastUpdate.getDate() !== today.getDate() || 
            lastUpdate.getMonth() !== today.getMonth() || 
            lastUpdate.getFullYear() !== today.getFullYear()) {
            this.stats.today = 0;
            this.saveStats();
        }
        
        return {
            ...this.stats,
            calories: Math.round(this.stats.today * 0.04), // Примерные калории
            distanceToday: this.stats.today * 0.00076,
            goalProgress: Math.min(100, (this.stats.today / this.stats.goal) * 100)
        };
    },
    
    // Сброс статистики
    resetStats: function() {
        this.stats = {
            today: 0,
            week: 0,
            month: 0,
            totalDistance: 0,
            lastUpdate: Date.now(),
            goal: 10000
        };
        this.saveStats();
    },
    
    // Установка цели
    setGoal: function(steps) {
        this.stats.goal = steps;
        this.saveStats();
    },
    
    // Имитация шагов для устройств без датчиков
    simulateSteps: function() {
        const steps = Math.floor(Math.random() * 100) + 50; // 50-150 случайных шагов
        this.addSteps(steps);
        return steps;
    }
};
