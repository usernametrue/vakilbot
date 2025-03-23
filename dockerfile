FROM node:20-alpine

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm install

# Копирование исходного кода
COPY . .

# Создание директории для хранения логов и статистики
RUN mkdir -p /app/data

# Запуск приложения
CMD ["node", "bot.js"]
