// ============================================
// Application State Management
// ============================================

class MemoryApp {
    constructor() {
        this.currentView = 'home';
        this.studyMode = null;
        this.currentCategory = null;
        this.sessionCards = [];
        this.currentCardIndex = 0;
        this.sessionStartTime = null;
        this.sessionStats = {
            correct: 0,
            incorrect: 0,
            total: 0
        };
        
        // Load user progress from localStorage
        this.loadProgress();
        
        // Initialize the app
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.renderCategories();
        this.updateHomeStats();
        this.updateProgressView();
        this.checkDailyStreak();
    }
    
    // ============================================
    // Data Management & Spaced Repetition
    // ============================================
    
    loadProgress() {
        const saved = localStorage.getItem('memoryAppProgress');
        if (saved) {
            this.progress = JSON.parse(saved);
        } else {
            this.progress = this.initializeProgress();
        }
    }
    
    initializeProgress() {
        const progress = {
            words: {},
            stats: {
                totalStudied: 0,
                totalTime: 0,
                streak: 0,
                lastStudyDate: null,
                correctAnswers: 0,
                totalAnswers: 0
            },
            activities: []
        };
        
        // Initialize all words with default values
        Object.keys(vocabularyData).forEach(file => {
            Object.keys(vocabularyData[file]).forEach(category => {
                vocabularyData[file][category].forEach(item => {
                    const key = `${item.word}`;
                    progress.words[key] = {
                        word: item.word,
                        translation: item.translation,
                        category: category,
                        file: file,
                        level: 0, // 0: new, 1: learning, 2: familiar, 3: mastered
                        correctCount: 0,
                        incorrectCount: 0,
                        lastReviewed: null,
                        nextReview: Date.now(), // Available immediately
                        interval: 0, // Days until next review
                        easeFactor: 2.5 // SM-2 algorithm ease factor
                    };
                });
            });
        });
        
        return progress;
    }
    
    saveProgress() {
        localStorage.setItem('memoryAppProgress', JSON.stringify(this.progress));
    }
    
    // Spaced Repetition Algorithm (based on SM-2)
    updateWordProgress(word, difficulty) {
        const wordData = this.progress.words[word];
        if (!wordData) return;
        
        const now = Date.now();
        wordData.lastReviewed = now;
        
        // Update statistics
        if (difficulty >= 3) {
            wordData.correctCount++;
            this.progress.stats.correctAnswers++;
        } else {
            wordData.incorrectCount++;
        }
        this.progress.stats.totalAnswers++;
        
        // SM-2 Algorithm implementation
        let interval = wordData.interval;
        let easeFactor = wordData.easeFactor;
        
        if (difficulty >= 3) {
            // Correct answer
            if (interval === 0) {
                interval = 1;
            } else if (interval === 1) {
                interval = 6;
            } else {
                interval = Math.round(interval * easeFactor);
            }
            
            // Update ease factor
            easeFactor = easeFactor + (0.1 - (4 - difficulty) * (0.08 + (4 - difficulty) * 0.02));
            if (easeFactor < 1.3) easeFactor = 1.3;
            
            // Update level
            if (wordData.correctCount >= 1 && wordData.level === 0) wordData.level = 1;
            if (wordData.correctCount >= 3 && wordData.level === 1) wordData.level = 2;
            if (wordData.correctCount >= 6 && wordData.level === 2) wordData.level = 3;
            
        } else {
            // Incorrect answer - reset interval but keep level
            interval = 0;
            easeFactor = Math.max(1.3, easeFactor - 0.2);
        }
        
        wordData.interval = interval;
        wordData.easeFactor = easeFactor;
        wordData.nextReview = now + (interval * 24 * 60 * 60 * 1000); // Convert days to milliseconds
        
        this.saveProgress();
    }
    
    getDueWords() {
        const now = Date.now();
        return Object.values(this.progress.words).filter(word => word.nextReview <= now);
    }
    
    getNewWords(limit = 10) {
        return Object.values(this.progress.words)
            .filter(word => word.level === 0 && word.correctCount === 0)
            .slice(0, limit);
    }
    
    getWordsByCategory(category) {
        return Object.values(this.progress.words).filter(word => word.category === category);
    }
    
    getCategoryProgress(category) {
        const words = this.getWordsByCategory(category);
        const total = words.length;
        const mastered = words.filter(w => w.level === 3).length;
        const learning = words.filter(w => w.level === 1 || w.level === 2).length;
        const newWords = words.filter(w => w.level === 0).length;
        
        return {
            total,
            mastered,
            learning,
            newWords,
            percentage: total > 0 ? Math.round((mastered / total) * 100) : 0
        };
    }
    
    checkDailyStreak() {
        const lastDate = this.progress.stats.lastStudyDate;
        if (!lastDate) return;
        
        const today = new Date().setHours(0, 0, 0, 0);
        const lastStudy = new Date(lastDate).setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - lastStudy) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
            // Streak broken
            this.progress.stats.streak = 0;
            this.saveProgress();
        }
    }
    
    updateDailyStreak() {
        const today = new Date().setHours(0, 0, 0, 0);
        const lastDate = this.progress.stats.lastStudyDate;
        
        if (!lastDate) {
            this.progress.stats.streak = 1;
            this.progress.stats.lastStudyDate = Date.now();
        } else {
            const lastStudy = new Date(lastDate).setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today - lastStudy) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                this.progress.stats.streak++;
                this.progress.stats.lastStudyDate = Date.now();
            } else if (diffDays === 0) {
                // Same day, just update timestamp
                this.progress.stats.lastStudyDate = Date.now();
            }
        }
        
        this.saveProgress();
    }
    
    addActivity(type, details) {
        const activity = {
            type,
            details,
            timestamp: Date.now()
        };
        
        this.progress.activities.unshift(activity);
        if (this.progress.activities.length > 50) {
            this.progress.activities = this.progress.activities.slice(0, 50);
        }
        
        this.saveProgress();
    }
    
    // ============================================
    // UI Event Listeners
    // ============================================
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
        
        // Home page action cards
        document.querySelector('[data-action="daily-review"]')?.addEventListener('click', () => {
            this.startDailyReview();
        });
        
        document.querySelector('[data-action="new-words"]')?.addEventListener('click', () => {
            this.startNewWords();
        });
        
        document.querySelector('[data-action="browse-categories"]')?.addEventListener('click', () => {
            this.switchView('categories');
        });
        
        // Study mode selection
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.startStudyMode(mode);
            });
        });
        
        // Back buttons
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => {
                this.exitStudyMode();
            });
        });
        
        // Flashcard interaction
        const flashcard = document.getElementById('flashcard');
        flashcard?.addEventListener('click', () => {
            flashcard.classList.toggle('flipped');
        });
        
        // Difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = parseInt(e.currentTarget.dataset.difficulty);
                this.handleFlashcardResponse(difficulty);
            });
        });
        
        // Quiz next button
        document.getElementById('nextQuizBtn')?.addEventListener('click', () => {
            this.nextQuizCard();
        });
        
        // Typing mode
        document.getElementById('checkTypingBtn')?.addEventListener('click', () => {
            this.checkTypingAnswer();
        });
        
        document.getElementById('typingInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkTypingAnswer();
            }
        });
        
        document.getElementById('nextTypingBtn')?.addEventListener('click', () => {
            this.nextTypingCard();
        });
        
        // Listening mode
        document.getElementById('listenBtn')?.addEventListener('click', () => {
            this.playWordAudio();
        });
        
        document.getElementById('checkListeningBtn')?.addEventListener('click', () => {
            this.checkListeningAnswer();
        });
        
        document.getElementById('listeningInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkListeningAnswer();
            }
        });
        
        document.getElementById('nextListeningBtn')?.addEventListener('click', () => {
            this.nextListeningCard();
        });
        
        // Session complete buttons
        document.getElementById('studyAgainBtn')?.addEventListener('click', () => {
            this.exitStudyMode();
        });
        
        document.getElementById('backHomeBtn')?.addEventListener('click', () => {
            this.switchView('home');
        });
    }
    
    // ============================================
    // View Management
    // ============================================
    
    switchView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === viewName) {
                btn.classList.add('active');
            }
        });
        
        // Switch view
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}View`).classList.add('active');
        
        this.currentView = viewName;
        
        // Update view-specific content
        if (viewName === 'home') {
            this.updateHomeStats();
        } else if (viewName === 'progress') {
            this.updateProgressView();
        }
    }
    
    // ============================================
    // Home View
    // ============================================
    
    updateHomeStats() {
        const dueWords = this.getDueWords();
        const newWords = this.getNewWords();
        const allWords = Object.values(this.progress.words);
        const mastered = allWords.filter(w => w.level === 3).length;
        const learning = allWords.filter(w => w.level === 1 || w.level === 2).length;
        const totalWords = allWords.length;
        
        // Update header stats
        document.getElementById('totalLearned').textContent = mastered;
        document.getElementById('streakDays').textContent = this.progress.stats.streak;
        
        // Update quick action cards
        document.getElementById('dueCards').textContent = `${dueWords.length} كلمة للمراجعة`;
        document.getElementById('newWordsCount').textContent = `${newWords.length} كلمة جديدة`;
        
        // Update progress overview
        document.getElementById('statsNew').textContent = allWords.filter(w => w.level === 0).length;
        document.getElementById('statsLearning').textContent = learning;
        document.getElementById('statsMastered').textContent = mastered;
        
        // Update circular progress
        const percentage = totalWords > 0 ? Math.round((mastered / totalWords) * 100) : 0;
        const progressCircle = document.querySelector('.progress-circle');
        const progressBar = progressCircle?.querySelector('.progress-bar');
        const progressText = progressCircle?.querySelector('.progress-text');
        
        if (progressBar && progressText) {
            const circumference = 283;
            const offset = circumference - (percentage / 100) * circumference;
            progressBar.style.strokeDashoffset = offset;
            progressText.textContent = `${percentage}%`;
        }
    }
    
    // ============================================
    // Categories View
    // ============================================
    
    renderCategories() {
        const grid = document.getElementById('categoriesGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        Object.keys(vocabularyData).forEach(file => {
            Object.keys(vocabularyData[file]).forEach(category => {
                const progress = this.getCategoryProgress(category);
                const icon = categoryIcons[category] || '📚';
                const displayName = formatCategoryName(category);
                
                const card = document.createElement('div');
                card.className = 'category-card';
                card.dataset.category = category;
                card.innerHTML = `
                    <div class="category-header">
                        <h3>${displayName}</h3>
                        <div class="category-icon">${icon}</div>
                    </div>
                    <p class="category-count">${progress.total} كلمة</p>
                    <div class="category-progress-bar">
                        <div class="category-progress-fill" style="width: ${progress.percentage}%"></div>
                    </div>
                    <div class="category-stats">
                        <span>متقنة: ${progress.mastered}</span>
                        <span>قيد التعلم: ${progress.learning}</span>
                    </div>
                `;
                
                card.addEventListener('click', () => {
                    this.startCategoryStudy(category);
                });
                
                grid.appendChild(card);
            });
        });
    }
    
    startCategoryStudy(category) {
        this.currentCategory = category;
        const words = this.getWordsByCategory(category);
        
        // Prioritize due words, then new words
        const dueWords = words.filter(w => w.nextReview <= Date.now());
        const newWords = words.filter(w => w.level === 0 && w.correctCount === 0).slice(0, 5);
        
        this.sessionCards = [...dueWords, ...newWords].slice(0, 20);
        
        if (this.sessionCards.length === 0) {
            alert('لا توجد كلمات جديدة في هذه الفئة!');
            return;
        }
        
        this.shuffleArray(this.sessionCards);
        this.switchView('practice');
    }
    
    // ============================================
    // Study Sessions
    // ============================================
    
    startDailyReview() {
        const dueWords = this.getDueWords();
        
        if (dueWords.length === 0) {
            alert('رائع! لا توجد كلمات للمراجعة اليوم. جرب تعلم كلمات جديدة!');
            return;
        }
        
        this.sessionCards = dueWords.slice(0, 20);
        this.shuffleArray(this.sessionCards);
        this.currentCategory = null;
        this.switchView('practice');
    }
    
    startNewWords() {
        const newWords = this.getNewWords(15);
        
        if (newWords.length === 0) {
            alert('مبروك! لقد بدأت بتعلم جميع الكلمات. راجع الكلمات السابقة!');
            return;
        }
        
        this.sessionCards = newWords;
        this.shuffleArray(this.sessionCards);
        this.currentCategory = null;
        this.switchView('practice');
    }
    
    startStudyMode(mode) {
        if (this.sessionCards.length === 0) {
            alert('الرجاء اختيار فئة أو بدء جلسة مراجعة أولاً');
            return;
        }
        
        this.studyMode = mode;
        this.currentCardIndex = 0;
        this.sessionStartTime = Date.now();
        this.sessionStats = { correct: 0, incorrect: 0, total: this.sessionCards.length };
        
        // Hide mode selection
        document.getElementById('modeSelection').classList.add('hidden');
        
        // Show appropriate mode
        document.getElementById(`${mode}Mode`).classList.remove('hidden');
        
        // Start the session
        if (mode === 'flashcard') {
            this.showFlashcard();
        } else if (mode === 'quiz') {
            this.showQuizCard();
        } else if (mode === 'typing') {
            this.showTypingCard();
        } else if (mode === 'listening') {
            this.showListeningCard();
        }
        
        // Start timer
        this.startSessionTimer();
    }
    
    exitStudyMode() {
        // Hide all study modes
        document.querySelectorAll('.study-mode').forEach(mode => {
            mode.classList.add('hidden');
        });
        
        // Show mode selection
        document.getElementById('modeSelection').classList.remove('hidden');
        
        // Reset state
        this.studyMode = null;
        this.currentCardIndex = 0;
        
        // Stop timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
    
    startSessionTimer() {
        const timerElement = document.getElementById('sessionTimer');
        if (!timerElement) return;
        
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    // ============================================
    // Flashcard Mode
    // ============================================
    
    showFlashcard() {
        if (this.currentCardIndex >= this.sessionCards.length) {
            this.showSessionComplete();
            return;
        }
        
        const card = this.sessionCards[this.currentCardIndex];
        
        document.getElementById('currentCard').textContent = this.currentCardIndex + 1;
        document.getElementById('totalCards').textContent = this.sessionCards.length;
        document.getElementById('cardWord').textContent = card.word;
        document.getElementById('cardTranslation').textContent = card.translation;
        document.getElementById('cardCategory').textContent = formatCategoryName(card.category);
        
        // Reset flip
        document.getElementById('flashcard').classList.remove('flipped');
    }
    
    handleFlashcardResponse(difficulty) {
        const card = this.sessionCards[this.currentCardIndex];
        this.updateWordProgress(card.word, difficulty);
        
        if (difficulty >= 3) {
            this.sessionStats.correct++;
        } else {
            this.sessionStats.incorrect++;
        }
        
        this.currentCardIndex++;
        this.showFlashcard();
    }
    
    // ============================================
    // Quiz Mode
    // ============================================
    
    showQuizCard() {
        if (this.currentCardIndex >= this.sessionCards.length) {
            this.showSessionComplete();
            return;
        }
        
        const card = this.sessionCards[this.currentCardIndex];
        const allWords = Object.values(this.progress.words);
        
        // Generate options
        const correctAnswer = card.translation;
        const wrongAnswers = allWords
            .filter(w => w.translation !== correctAnswer)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(w => w.translation);
        
        const options = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
        
        document.getElementById('quizCurrentCard').textContent = this.currentCardIndex + 1;
        document.getElementById('quizTotalCards').textContent = this.sessionCards.length;
        document.getElementById('quizWord').textContent = card.word;
        document.getElementById('quizScore').textContent = this.sessionStats.correct;
        
        const optionsContainer = document.getElementById('quizOptions');
        optionsContainer.innerHTML = '';
        
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.textContent = option;
            btn.addEventListener('click', () => this.handleQuizAnswer(option, correctAnswer));
            optionsContainer.appendChild(btn);
        });
        
        document.getElementById('quizFeedback').classList.add('hidden');
    }
    
    handleQuizAnswer(selected, correct) {
        const isCorrect = selected === correct;
        const card = this.sessionCards[this.currentCardIndex];
        
        // Disable all options
        document.querySelectorAll('.quiz-option').forEach(btn => {
            btn.style.pointerEvents = 'none';
            if (btn.textContent === correct) {
                btn.classList.add('correct');
            } else if (btn.textContent === selected && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });
        
        // Show feedback
        const feedback = document.getElementById('quizFeedback');
        feedback.classList.remove('hidden', 'correct', 'incorrect');
        feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
        feedback.querySelector('.feedback-content').textContent = isCorrect 
            ? '✅ إجابة صحيحة! ممتاز!' 
            : `❌ خطأ. الإجابة الصحيحة: ${correct}`;
        
        // Update progress
        this.updateWordProgress(card.word, isCorrect ? 4 : 1);
        
        if (isCorrect) {
            this.sessionStats.correct++;
        } else {
            this.sessionStats.incorrect++;
        }
    }
    
    nextQuizCard() {
        this.currentCardIndex++;
        this.showQuizCard();
    }
    
    // ============================================
    // Typing Mode
    // ============================================
    
    showTypingCard() {
        if (this.currentCardIndex >= this.sessionCards.length) {
            this.showSessionComplete();
            return;
        }
        
        const card = this.sessionCards[this.currentCardIndex];
        
        document.getElementById('typingCurrentCard').textContent = this.currentCardIndex + 1;
        document.getElementById('typingTotalCards').textContent = this.sessionCards.length;
        document.getElementById('typingTranslation').textContent = card.translation;
        document.getElementById('typingScore').textContent = this.sessionStats.correct;
        document.getElementById('typingInput').value = '';
        document.getElementById('typingInput').disabled = false;
        document.getElementById('checkTypingBtn').style.display = 'block';
        
        document.getElementById('typingFeedback').classList.add('hidden');
        document.getElementById('typingInput').focus();
    }
    
    checkTypingAnswer() {
        const card = this.sessionCards[this.currentCardIndex];
        const userAnswer = document.getElementById('typingInput').value.trim().toLowerCase();
        const correctAnswer = card.word.toLowerCase();
        
        const isCorrect = userAnswer === correctAnswer;
        
        // Disable input
        document.getElementById('typingInput').disabled = true;
        document.getElementById('checkTypingBtn').style.display = 'none';
        
        // Show feedback
        const feedback = document.getElementById('typingFeedback');
        feedback.classList.remove('hidden', 'correct', 'incorrect');
        feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
        feedback.querySelector('.feedback-content').textContent = isCorrect 
            ? '✅ إجابة صحيحة! ممتاز!' 
            : `❌ خطأ. الإجابة الصحيحة: ${card.word}`;
        
        // Update progress
        this.updateWordProgress(card.word, isCorrect ? 4 : 1);
        
        if (isCorrect) {
            this.sessionStats.correct++;
        } else {
            this.sessionStats.incorrect++;
        }
    }
    
    nextTypingCard() {
        this.currentCardIndex++;
        this.showTypingCard();
    }
    
    // ============================================
    // Listening Mode
    // ============================================
    
    showListeningCard() {
        if (this.currentCardIndex >= this.sessionCards.length) {
            this.showSessionComplete();
            return;
        }
        
        const card = this.sessionCards[this.currentCardIndex];
        
        document.getElementById('listeningCurrentCard').textContent = this.currentCardIndex + 1;
        document.getElementById('listeningTotalCards').textContent = this.sessionCards.length;
        document.getElementById('listeningScore').textContent = this.sessionStats.correct;
        document.getElementById('listeningInput').value = '';
        document.getElementById('listeningInput').disabled = false;
        document.getElementById('checkListeningBtn').style.display = 'block';
        
        document.getElementById('listeningFeedback').classList.add('hidden');
        document.getElementById('listeningInput').focus();
        
        // Auto-play audio once when card loads
        setTimeout(() => this.playWordAudio(), 500);
    }
    
    playWordAudio() {
        const card = this.sessionCards[this.currentCardIndex];
        if (!card) return;
        
        // Use Web Speech API for text-to-speech
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(card.word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8; // Slower for learning
            utterance.pitch = 1;
            utterance.volume = 1;
            
            // Add visual feedback
            const btn = document.getElementById('listenBtn');
            btn.style.transform = 'scale(0.95)';
            
            utterance.onend = () => {
                btn.style.transform = 'scale(1)';
            };
            
            window.speechSynthesis.speak(utterance);
        } else {
            alert('المتصفح لا يدعم النطق الصوتي. جرب متصفح Chrome أو Edge.');
        }
    }
    
    checkListeningAnswer() {
        const card = this.sessionCards[this.currentCardIndex];
        const userAnswer = document.getElementById('listeningInput').value.trim().toLowerCase();
        const correctAnswer = card.word.toLowerCase();
        
        // Check for exact match or close match
        const isCorrect = userAnswer === correctAnswer || 
                         this.calculateSimilarity(userAnswer, correctAnswer) > 0.85;
        
        // Disable input
        document.getElementById('listeningInput').disabled = true;
        document.getElementById('checkListeningBtn').style.display = 'none';
        
        // Show feedback
        const feedback = document.getElementById('listeningFeedback');
        feedback.classList.remove('hidden', 'correct', 'incorrect');
        feedback.classList.add(isCorrect ? 'correct' : 'incorrect');
        feedback.querySelector('.feedback-content').textContent = isCorrect 
            ? '✅ إجابة صحيحة! ممتاز!' 
            : '❌ خطأ. استمع مرة أخرى:';
        
        // Show correct word
        document.getElementById('listeningCorrectWord').textContent = card.word;
        
        // Update progress
        this.updateWordProgress(card.word, isCorrect ? 4 : 1);
        
        if (isCorrect) {
            this.sessionStats.correct++;
        } else {
            this.sessionStats.incorrect++;
            // Play the word again for incorrect answers
            setTimeout(() => this.playWordAudio(), 500);
        }
    }
    
    nextListeningCard() {
        this.currentCardIndex++;
        this.showListeningCard();
    }
    
    // Helper function to calculate string similarity (Levenshtein distance)
    calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = [];
        
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        const maxLen = Math.max(len1, len2);
        return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
    }
    
    // ============================================
    // Session Complete
    // ============================================
    
    showSessionComplete() {
        // Hide current mode
        document.querySelectorAll('.study-mode').forEach(mode => {
            if (!mode.id.includes('Complete')) {
                mode.classList.add('hidden');
            }
        });
        
        // Show complete screen
        document.getElementById('sessionComplete').classList.remove('hidden');
        
        // Calculate stats
        const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const accuracy = this.sessionStats.total > 0 
            ? Math.round((this.sessionStats.correct / this.sessionStats.total) * 100) 
            : 0;
        
        document.getElementById('sessionWords').textContent = this.sessionStats.total;
        document.getElementById('sessionTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('sessionAccuracy').textContent = `${accuracy}%`;
        
        // Update global stats
        this.progress.stats.totalStudied += this.sessionStats.total;
        this.progress.stats.totalTime += Math.floor(duration / 60);
        this.updateDailyStreak();
        
        // Add activity
        this.addActivity('study_session', {
            mode: this.studyMode,
            words: this.sessionStats.total,
            correct: this.sessionStats.correct,
            duration: duration
        });
        
        this.saveProgress();
        this.updateHomeStats();
        
        // Stop timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
    
    // ============================================
    // Progress View
    // ============================================
    
    updateProgressView() {
        // Update stats cards
        document.getElementById('totalWordsStudied').textContent = this.progress.stats.totalStudied;
        document.getElementById('currentStreak').textContent = this.progress.stats.streak;
        document.getElementById('totalTimeStudied').textContent = this.progress.stats.totalTime;
        
        const accuracy = this.progress.stats.totalAnswers > 0 
            ? Math.round((this.progress.stats.correctAnswers / this.progress.stats.totalAnswers) * 100) 
            : 0;
        document.getElementById('accuracyRate').textContent = `${accuracy}%`;
        
        // Update category progress
        this.renderCategoryProgress();
        
        // Update activity list
        this.renderActivityList();
    }
    
    renderCategoryProgress() {
        const container = document.getElementById('categoryProgressList');
        if (!container) return;
        
        container.innerHTML = '';
        
        const categories = new Set();
        Object.values(this.progress.words).forEach(word => {
            categories.add(word.category);
        });
        
        categories.forEach(category => {
            const progress = this.getCategoryProgress(category);
            const displayName = formatCategoryName(category);
            const icon = categoryIcons[category] || '📚';
            
            const item = document.createElement('div');
            item.className = 'category-progress-item';
            item.innerHTML = `
                <div class="category-header">
                    <h3>${icon} ${displayName}</h3>
                </div>
                <div class="category-progress-bar">
                    <div class="category-progress-fill" style="width: ${progress.percentage}%"></div>
                </div>
                <div class="category-stats">
                    <span>جديدة: ${progress.newWords}</span>
                    <span>قيد التعلم: ${progress.learning}</span>
                    <span>متقنة: ${progress.mastered}</span>
                </div>
            `;
            
            container.appendChild(item);
        });
    }
    
    renderActivityList() {
        const container = document.getElementById('activityList');
        if (!container) return;
        
        if (this.progress.activities.length === 0) {
            container.innerHTML = '<p class="no-activity">لم تبدأ الدراسة بعد. ابدأ الآن!</p>';
            return;
        }
        
        container.innerHTML = '';
        
        this.progress.activities.slice(0, 10).forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            
            const timeAgo = this.getTimeAgo(activity.timestamp);
            let description = '';
            
            if (activity.type === 'study_session') {
                const mode = activity.details.mode === 'flashcard' ? 'بطاقات تعليمية' :
                            activity.details.mode === 'quiz' ? 'اختبار' :
                            activity.details.mode === 'typing' ? 'كتابة' : 'استماع';
                description = `درست ${activity.details.words} كلمة باستخدام ${mode}`;
            }
            
            item.innerHTML = `
                <span>${description}</span>
                <span class="activity-time">${timeAgo}</span>
            `;
            
            container.appendChild(item);
        });
    }
    
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'الآن';
        if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
        if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
        return `منذ ${Math.floor(seconds / 86400)} يوم`;
    }
    
    // ============================================
    // Utility Functions
    // ============================================
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MemoryApp();
});
