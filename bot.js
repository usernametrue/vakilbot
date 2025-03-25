const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

const adminChatId = process.env.ADMIN_CHAT_ID;
const chats = {
    'DHF_1': process.env.DHF_1_CHAT_ID,
    'DHF_2': process.env.DHF_2_CHAT_ID,
    'DHF_3': process.env.DHF_3_CHAT_ID,
    'DHF_4': process.env.DHF_4_CHAT_ID,
    'DB_1': process.env.DB_1_CHAT_ID,
    'DB_2': process.env.DB_2_CHAT_ID,
    'DB_3': process.env.DB_3_CHAT_ID,
    'DB_4': process.env.DB_4_CHAT_ID,
};

const userState = {};
const statsFile = 'data/stats.json';
const MIN_PART_LENGTH = 30; // Минимальная длина каждой части обращения

const ensureDataDirectoryExists = () => {
    if (!fs.existsSync('data')) {
        try {
            fs.mkdirSync('data', { recursive: true });
            console.log('Created data directory');
        } catch (error) {
            console.error(`Error creating data directory: ${error.message}`);
        }
    }
};

const loadStats = () => {
    if (fs.existsSync(statsFile)) {
        return JSON.parse(fs.readFileSync(statsFile));
    }
    return { total: 0, DHF: { 1: 0, 2: 0, 3: 0, 4: 0 }, DB: { 1: 0, 2: 0, 3: 0, 4: 0 } };
};

const saveStats = (stats) => {
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
};

ensureDataDirectoryExists();
const stats = loadStats();

// Расширенное логирование с информацией о пользователе
const logMessage = (msg, telegramUser = null) => {
    let userInfo = '';
    if (telegramUser) {
        const username = telegramUser.username ? '@' + telegramUser.username : 'NoUsername';
        const firstName = telegramUser.first_name || '';
        const lastName = telegramUser.last_name || '';
        userInfo = `[${username} | ${firstName} ${lastName}] `;
    }
    
    const logEntry = `${new Date().toISOString()} - ${userInfo}${msg}\n`;
    fs.appendFileSync('data/bot.log', logEntry);
};

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userState[chatId] = {};
    bot.sendMessage(chatId, 'Выберите язык / Tilni tanlang:', {
        reply_markup: {
            keyboard: [[{ text: 'Русский' }, { text: 'O`zbekcha' }]],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
});

// Обработка команды /stats
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() === adminChatId) {
        const statsMessage = `📊 Статистика обращений:\n` +
            `Общее: ${stats.total}\n` +
            `DHF: 1 курс - ${stats.DHF[1]}, 2 курс - ${stats.DHF[2]}, 3 курс - ${stats.DHF[3]}, 4 курс - ${stats.DHF[4]}\n` +
            `DB: 1 курс - ${stats.DB[1]}, 2 курс - ${stats.DB[2]}, 3 курс - ${stats.DB[3]}, 4 курс - ${stats.DB[4]}`;
        bot.sendMessage(chatId, statsMessage);
    } else {
        bot.sendMessage(chatId, '❌ У вас нет доступа к этой команде.');
    }
});

// Обработка команды /logs - выгрузка логов для администратора
bot.onText(/\/logs/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (chatId.toString() === adminChatId) {
        try {
            // Проверка наличия файла логов
            if (!fs.existsSync('data/bot.log')) {
                bot.sendMessage(chatId, '📂 Файл логов еще не создан.');
                return;
            }
            
            // Получение размера файла
            const stats = fs.statSync('data/bot.log');
            const fileSizeInMB = stats.size / (1024 * 1024);
            
            // Информирование о начале отправки
            bot.sendMessage(chatId, `📤 Отправка файла логов (${fileSizeInMB.toFixed(2)} МБ)...`);
            
            // Отправка файла
            await bot.sendDocument(chatId, 'data/bot.log', {
                caption: `📋 Файл логов бота от ${new Date().toLocaleString()}`
            });
            
            logMessage('Файл логов выгружен администратором', msg.from);
        } catch (error) {
            console.error('Ошибка при отправке файла логов:', error);
            bot.sendMessage(chatId, '❌ Произошла ошибка при отправке файла логов.');
            logMessage(`Ошибка при отправке логов: ${error.message}`, msg.from);
        }
    } else {
        bot.sendMessage(chatId, '❌ У вас нет доступа к этой команде.');
    }
});

// Функция для отправки сообщения после подтверждения
const sendConfirmedMessage = (chatId, user) => {
    const direction = userState[chatId].direction;
    const course = userState[chatId].course;
    const targetChatId = chats[`${direction}_${course}`];
    
    const positiveText = userState[chatId].positiveText;
    const negativeText = userState[chatId].negativeText;
    
    // Формирование сообщения в зависимости от языка
    const messageTitle = userState[chatId].language === 'Русский' 
        ? '📩 Анонимное обращение:' 
        : '📩 Anonim murojaat:';
        
    const positiveTitle = userState[chatId].language === 'Русский' 
        ? '✅ Положительный опыт:' 
        : '✅ Ijobiy tajriba:';
        
    const negativeTitle = userState[chatId].language === 'Русский' 
        ? '⚠️ Что хотелось бы улучшить:' 
        : '⚠️ Nimani yaxshilashni istaysiz:';
    
    const fullMessage = `${messageTitle}

${positiveTitle}
${positiveText}

${negativeTitle}
${negativeText}`;
    
    if (targetChatId) {
        bot.sendMessage(targetChatId, fullMessage);
        // Сообщение для администратора с учетом языка пользователя
        const adminPositiveTitle = userState[chatId].language === 'Русский' 
            ? '✅ Положительный опыт:' 
            : '✅ Ijobiy tajriba:';
            
        const adminNegativeTitle = userState[chatId].language === 'Русский' 
            ? '⚠️ Что хотелось бы улучшить:' 
            : '⚠️ Nimani yaxshilashni istaysiz:';
            
        bot.sendMessage(adminChatId, `📩 Обращение от ${direction} ${course} курс:\n\n${adminPositiveTitle}\n${positiveText}\n\n${adminNegativeTitle}\n${negativeText}`);
        
        const successMessage = userState[chatId].language === 'Русский' 
            ? 'Ваше обращение успешно отправлено! Хотите отправить ещё одно обращение?' 
            : 'Murojaatingiz muvaffaqiyatli yuborildi! Yana murojaat yuborishni xohlaysizmi?';
        
        bot.sendMessage(chatId, successMessage, {
            reply_markup: {
                keyboard: [[{ text: userState[chatId].language === 'Русский' ? 'Отправить новое обращение' : 'Yangi murojaat yuborish' }]],
                resize_keyboard: true
            }
        });
        
        stats.total++;
        stats[direction][course]++;
        saveStats(stats);
        // Логирование с информацией о пользователе
        logMessage(`Обращение от ${direction} ${course} курс: ${fullMessage}`, user);
        
        // Сбрасываем данные о сообщении
        delete userState[chatId].positiveText;
        delete userState[chatId].negativeText;
        delete userState[chatId].messageState;
    }
};

// Основная обработка сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Пропускаем команды
    if (text && text.startsWith('/')) return;
    
    if (!userState[chatId]) {
        userState[chatId] = {};
    }

    // Выбор языка
    if (!userState[chatId].language) {
        if (text === 'Русский' || text === 'O`zbekcha') {
            userState[chatId].language = text;
            bot.sendMessage(chatId, text === 'Русский' ? 'Выберите направление:' : 'Yo`nalishni tanlang:', {
                reply_markup: {
                    keyboard: [[{ text: 'DHF (ГПД)' }, { text: 'DB (ГУ)' }]],
                    one_time_keyboard: true,
                    resize_keyboard: true
                }
            });
        }
        return;
    }

    // Выбор направления
    if (!userState[chatId].direction) {
        if (['DHF (ГПД)', 'DB (ГУ)'].includes(text)) {
            userState[chatId].direction = text.includes('DHF') ? 'DHF' : 'DB';
            bot.sendMessage(chatId, userState[chatId].language === 'Русский' ? 'Выберите курс:' : 'Kursingizni tanlang:', {
                reply_markup: {
                    keyboard: [[{ text: '1' }, { text: '2' }, { text: '3' }, { text: '4' }]],
                    one_time_keyboard: true,
                    resize_keyboard: true
                }
            });
        }
        return;
    }

    // Выбор курса
    if (!userState[chatId].course) {
        if (['1', '2', '3', '4'].includes(text)) {
            userState[chatId].course = text;
            userState[chatId].messageState = 'awaiting_positive';
            
            const positivePrompt = userState[chatId].language === 'Русский'
                ? '📝 Поделитесь, пожалуйста, что вам нравится в учебном процессе? Какие положительные моменты вы можете отметить? (минимум 30 символов)'
                : '📝 Iltimos, o`quv jarayonida sizga nima yoqishini baham ko`ring? Qanday ijobiy jihatlarni ta`kidlay olasiz? (kamida 30 ta belgi)';
                
            bot.sendMessage(chatId, positivePrompt);
        }
        return;
    }

    // Обработка кнопки "Отправить новое обращение"
    if (text === 'Отправить новое обращение' || text === 'Yangi murojaat yuborish') {
        userState[chatId].messageState = 'awaiting_positive';
        
        const positivePrompt = userState[chatId].language === 'Русский'
            ? '📝 Поделитесь, пожалуйста, что вам нравится в учебном процессе? Какие положительные моменты вы можете отметить? (минимум 30 символов)'
            : '📝 Iltimos, o`quv jarayonida sizga nima yoqishini baham ko`ring? Qanday ijobiy jihatlarni ta`kidlay olasiz? (kamida 30 ta belgi)';
            
        bot.sendMessage(chatId, positivePrompt);
        return;
    }
    
    // Обработка кнопок подтверждения
    if (userState[chatId].messageState === 'awaiting_confirmation') {
        if (text === 'Подтвердить ✅' || text === 'Tasdiqlash ✅') {
            sendConfirmedMessage(chatId, msg.from);
            return;
        } else if (text === 'Отменить ❌' || text === 'Bekor qilish ❌') {
            userState[chatId].messageState = 'awaiting_positive';
            
            const positivePrompt = userState[chatId].language === 'Русский'
                ? '📝 Поделитесь, пожалуйста, что вам нравится в учебном процессе? Какие положительные моменты вы можете отметить? (минимум 30 символов)'
                : '📝 Iltimos, o`quv jarayonida sizga nima yoqishini baham ko`ring? Qanday ijobiy jihatlarni ta`kidlay olasiz? (kamida 30 ta belgi)';
                
            bot.sendMessage(chatId, positivePrompt, {
                reply_markup: {
                    remove_keyboard: true
                }
            });
            return;
        }
    }

    // Обработка положительного отзыва
    if (userState[chatId].messageState === 'awaiting_positive') {
        if (text.length < MIN_PART_LENGTH) {
            const tooShortMessage = userState[chatId].language === 'Русский'
                ? `⚠️ Сообщение слишком короткое. Минимальная длина ${MIN_PART_LENGTH} символов. Ваше сообщение: ${text.length} символов.`
                : `⚠️ Xabar juda qisqa. Minimal uzunlik ${MIN_PART_LENGTH} belgi. Sizning xabaringiz: ${text.length} belgi.`;
                
            bot.sendMessage(chatId, tooShortMessage);
            return;
        }
        
        userState[chatId].positiveText = text;
        userState[chatId].messageState = 'awaiting_negative';
        
        const negativePrompt = userState[chatId].language === 'Русский'
            ? '📝 Что бы вы хотели улучшить в учебном процессе? Какие моменты вызывают у вас затруднения или дискомфорт? (минимум 30 символов)'
            : '📝 O`quv jarayonida nimani yaxshilashni xohlaysiz? Qaysi jihatlar sizga qiyinchilik yoki noqulaylik keltiryapti? (kamida 30 ta belgi)';
            
        bot.sendMessage(chatId, negativePrompt);
        return;
    }
    
    // Обработка отрицательного отзыва
    if (userState[chatId].messageState === 'awaiting_negative') {
        if (text.length < MIN_PART_LENGTH) {
            const tooShortMessage = userState[chatId].language === 'Русский'
                ? `⚠️ Сообщение слишком короткое. Минимальная длина ${MIN_PART_LENGTH} символов. Ваше сообщение: ${text.length} символов.`
                : `⚠️ Xabar juda qisqa. Minimal uzunlik ${MIN_PART_LENGTH} belgi. Sizning xabaringiz: ${text.length} belgi.`;
                
            bot.sendMessage(chatId, tooShortMessage);
            return;
        }
        
        userState[chatId].negativeText = text;
        userState[chatId].messageState = 'awaiting_confirmation';
        
        const positiveText = userState[chatId].positiveText;
        const negativeText = text;
        
        const confirmText = userState[chatId].language === 'Русский'
            ? 'Подтвердите отправку обращения:'
            : 'Murojaatni yuborishni tasdiqlang:';
        
        // Заголовки категорий в зависимости от языка
        const positiveTitle = userState[chatId].language === 'Русский' 
            ? '✅ *Положительный опыт:*' 
            : '✅ *Ijobiy tajriba:*';
            
        const negativeTitle = userState[chatId].language === 'Русский' 
            ? '⚠️ *Что хотелось бы улучшить:*' 
            : '⚠️ *Nimani yaxshilashni istaysiz:*';
            
        const previewMessage = `${confirmText}\n\n${positiveTitle}\n${positiveText.length > 100 ? positiveText.substring(0, 100) + '...' : positiveText}\n\n${negativeTitle}\n${negativeText.length > 100 ? negativeText.substring(0, 100) + '...' : negativeText}`;
            
        bot.sendMessage(chatId, previewMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [[
                    { text: userState[chatId].language === 'Русский' ? 'Подтвердить ✅' : 'Tasdiqlash ✅' },
                    { text: userState[chatId].language === 'Русский' ? 'Отменить ❌' : 'Bekor qilish ❌' }
                ]],
                resize_keyboard: true
            }
        });
    }
});

console.log("✅ Bot started successfully")