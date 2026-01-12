// Шагомер для MeetUP с обновлением в реальном времени

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
        goal: 10000, // цель по умолчанию: 10,000 шагов
        activeSteps: 0, // Активные шаги с момента запуска
        isRunning: false
    },
    
    // Настройки детектора шагов
    stepDetector: {
        threshold: 12, // Порог для обнаружения шага
        stepDelay: 300, // Минимальная задержка между шагами (мс)
        smoothing: 5, // Сглаживание данных
        lastAcceleration: null,
        lastStepTime: 0,
        buffer: [],
        stepCount: 0,
        worker: null
    },
    
    // Инициализация шагомера
    initialize: function() {
        if (!this.isSupported()) {
            console.warn('Шагомер не поддерживается этим устройством');
            return false;
        }
        
        this.loadStats();
        
        // Запускаем фоновый процессор шагов через Web Worker
        this.initStepWorker();
        
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
    
    // Инициализация Web Worker для обработки шагов
    initStepWorker: function() {
        // Создаем Web Worker для обработки данных акселерометра
        const workerCode = `
            let stepCount = 0;
            let lastAcceleration = null;
            let lastStepTime = 0;
            const threshold = 12;
            const stepDelay = 300;
            const smoothing = 5;
            let buffer = [];
            
            self.onmessage = function(e) {
                const { acceleration, timestamp } = e.data;
                
                if (!acceleration) return;
                
                // Вычисляем общее ускорение
                const totalAcceleration = Math.sqrt(
                    Math.pow(acceleration.x, 2) + 
                    Math.pow(acceleration.y, 2) + 
                    Math.pow(acceleration.z, 2)
                );
                
                // Сглаживание данных
                buffer.push(totalAcceleration);
                if (buffer.length > smoothing) {
                    buffer.shift();
                }
                
                const smoothedAcceleration = buffer.reduce((a, b) => a + b, 0) / buffer.length;
                
                if (lastAcceleration !== null) {
                    const delta = Math.abs(smoothedAcceleration - lastAcceleration);
                    
                    // Обнаружение шага
                    if (delta > threshold && (timestamp - lastStepTime) > stepDelay) {
                        stepCount++;
                        lastStepTime = timestamp;
                        
                        // Отправляем шаги основному потоку
                        self.postMessage({ steps: 1, stepCount });
                    }
                }
                
                lastAcceleration = smoothedAcceleration;
            };
        `;
        
        try {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.stepDetector.worker = new Worker(URL.createObjectURL(blob));
            
            // Обработчик сообщений от Worker
            this.stepDetector.worker.onmessage = (e) => {
                const { steps } = e.data;
                if (steps > 0 && this.stats.isRunning) {
                    this.addSteps(steps);
                }
            };
        } catch (e) {
            console.log('Web Worker не поддерживается, используем основной поток');
        }
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
                parsed.activeSteps = 0;
            }
            
            // Проверяем сброс недельной статистики
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            if (lastUpdate < weekAgo) {
                parsed.week = 0;
            }
            
            // Проверяем сброс месячной статистики
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            if (lastUpdate < monthAgo) {
                parsed.month = 0;
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
        this.stats.isRunning = true;
        this.stats.activeSteps = 0;
        
        let lastTimestamp = 0;
        
        const handleMotion = (event) => {
            if (!this.stats.isRunning) return;
            
            const acceleration = event.accelerationIncludingGravity;
            const timestamp = event.timeStamp || Date.now();
            
            // Ограничиваем частоту обработки (макс 30 раз в секунду)
            if (timestamp - lastTimestamp < 33) return;
            lastTimestamp = timestamp;
            
            if (this.stepDetector.worker) {
                // Отправляем данные в Web Worker
                this.stepDetector.worker.postMessage({
                    acceleration,
                    timestamp
                });
            } else {
                // Обработка в основном потоке (запасной вариант)
                this.processStepInMainThread(acceleration, timestamp);
            }
        };
        
        window.addEventListener('devicemotion', handleMotion, { passive: true });
        
        // Сохраняем обработчик для последующего удаления
        this.stepDetector.motionHandler = handleMotion;
    },
    
    // Обработка шагов в основном потоке
    processStepInMainThread: function(acceleration, timestamp) {
        if (!acceleration) return;
        
        const totalAcceleration = Math.sqrt(
            Math.pow(acceleration.x, 2) + 
            Math.pow(acceleration.y, 2) + 
            Math.pow(acceleration.z, 2)
        );
        
        // Сглаживание данных
        this.stepDetector.buffer.push(totalAcceleration);
        if (this.stepDetector.buffer.length > this.stepDetector.smoothing) {
            this.stepDetector.buffer.shift();
        }
        
        const smoothedAcceleration = this.stepDetector.buffer.reduce((a, b) => a + b, 0) / this.stepDetector.buffer.length;
        
        if (this.stepDetector.lastAcceleration !== null) {
            const delta = Math.abs(smoothedAcceleration - this.stepDetector.lastAcceleration);
            
            // Обнаружение шага
            if (delta > this.stepDetector.threshold && 
                (timestamp - this.stepDetector.lastStepTime) > this.stepDetector.stepDelay) {
                
                this.stepDetector.lastStepTime = timestamp;
                this.stepDetector.stepCount++;
                
                // Обновляем каждые 5 шагов для производительности
                if (this.stepDetector.stepCount >= 5) {
                    if (this.stats.isRunning) {
                        this.addSteps(this.stepDetector.stepCount);
                    }
                    this.stepDetector.stepCount = 0;
                }
            }
        }
        
        this.stepDetector.lastAcceleration = smoothedAcceleration;
    },
    
    // Остановка отслеживания
    stopTracking: function() {
        this.stats.isRunning = false;
        
        if (this.stepDetector.motionHandler) {
            window.removeEventListener('devicemotion', this.stepDetector.motionHandler);
        }
        
        // Сохраняем оставшиеся шаги
        if (this.stepDetector.stepCount > 0 && this.stats.isRunning) {
            this.addSteps(this.stepDetector.stepCount);
            this.stepDetector.stepCount = 0;
        }
    },
    
    // Добавление шагов
    addSteps: function(steps) {
        if (steps <= 0) return;
        
        this.stats.today += steps;
        this.stats.week += steps;
        this.stats.month += steps;
        this.stats.activeSteps += steps;
        
        // Расчет расстояния (средний шаг = 0.76 метра)
        const distance = steps * 0.00076; // в километрах
        this.stats.totalDistance += distance;
        
        this.saveStats();
        
        // Отправляем событие об обновлении
        const event = new CustomEvent('pedometerUpdate', { 
            detail: this.getStats() 
        });
        window.dispatchEvent(event);
        
        // Также отправляем отдельное событие для каждого шага для анимации
        if (steps === 1) {
            const stepEvent = new CustomEvent('pedometerStep', { 
                detail: { step: this.stats.today }
            });
            window.dispatchEvent(stepEvent);
        }
    },
    
    // Ручное добавление шагов (для тестирования)
    addStepsManually: function(steps) {
        if (!this.stats.isRunning) {
            this.stats.isRunning = true;
        }
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
            this.stats.activeSteps = 0;
            this.saveStats();
        }
        
        const goalProgress = Math.min(100, (this.stats.today / this.stats.goal) * 100);
        
        return {
            today: this.stats.today,
            week: this.stats.week,
            month: this.stats.month,
            totalDistance: this.stats.totalDistance,
            activeSteps: this.stats.activeSteps,
            isRunning: this.stats.isRunning,
            goal: this.stats.goal,
            calories: Math.round(this.stats.today * 0.04), // Примерные калории
            distanceToday: this.stats.today * 0.00076,
            goalProgress: goalProgress,
            remainingSteps: Math.max(0, this.stats.goal - this.stats.today),
            progressPercent: goalProgress.toFixed(1)
        };
    },
    
    // Сброс статистики
    resetStats: function(type = 'today') {
        switch(type) {
            case 'today':
                this.stats.today = 0;
                this.stats.activeSteps = 0;
                break;
            case 'week':
                this.stats.week = 0;
                break;
            case 'month':
                this.stats.month = 0;
                break;
            case 'all':
                this.stats.today = 0;
                this.stats.week = 0;
                this.stats.month = 0;
                this.stats.totalDistance = 0;
                this.stats.activeSteps = 0;
                break;
        }
        
        this.saveStats();
        
        // Отправляем событие об обновлении
        const event = new CustomEvent('pedometerUpdate', { 
            detail: this.getStats() 
        });
        window.dispatchEvent(event);
        
        return this.stats;
    },
    
    // Установка цели
    setGoal: function(steps) {
        this.stats.goal = steps;
        this.saveStats();
        
        // Отправляем событие об обновлении
        const event = new CustomEvent('pedometerUpdate', { 
            detail: this.getStats() 
        });
        window.dispatchEvent(event);
    },
    
    // Имитация шагов для устройств без датчиков
    simulateSteps: function(count = 50) {
        if (!this.stats.isRunning) {
            this.stats.isRunning = true;
        }
        
        // Добавляем шаги с небольшой задержкой для реалистичности
        const addStepsWithDelay = (remaining) => {
            if (remaining <= 0) return;
            
            const batch = Math.min(5, remaining); // По 5 шагов за раз
            this.addSteps(batch);
            
            // Анимация для каждого шага
            for (let i = 0; i < batch; i++) {
                setTimeout(() => {
                    const stepEvent = new CustomEvent('pedometerStep', { 
                        detail: { step: this.stats.today, simulated: true }
                    });
                    window.dispatchEvent(stepEvent);
                }, i * 100);
            }
            
            if (remaining > batch) {
                setTimeout(() => addStepsWithDelay(remaining - batch), 500);
            }
        };
        
        addStepsWithDelay(count);
        return count;
    },
    
    // Переключение состояния отслеживания
    toggleTracking: function() {
        if (this.stats.isRunning) {
            this.stopTracking();
            return false;
        } else {
            this.startTracking();
            return true;
        }
    }
};

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pedometer;
}
