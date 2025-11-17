# Управление складом — Telegram-бот

Телеграм-бот для курсового проекта, который позволяет управлять складскими остатками прямо из чата:

- просмотр товаров и остатков;
- добавление, редактирование, удаление позиций;
- приход и списание с записью движения;
- отчёты по минимальным остаткам и движению за неделю.

## Как описать бота в курсовой работе

1. **Цель и задачи**  
   - Автоматизация учёта складских остатков для небольшой компании.  
   - Быстрый доступ к информации через Telegram без отдельного веб-интерфейса.

2. **Архитектура**  
   - Node.js + Telegraf; PostgreSQL для хранения данных.  
   - Файловая структура: `bot.js` (входная точка), `handlers/` (логика команд и меню), `menus/`, `utils/`.  
   - Используется сессионное хранение в Telegram и локальный json (`telegraf-session-local`) для последовательных операций.

3. **Функциональные модули**  
   - `handlers/products/*` — CRUD по товарам.  
   - `handlers/income`, `handlers/outcome` — приход/списание и логирование движений.  
   - `handlers/stock`, `handlers/reports` — просмотр остатков и аналитика.  
   - `utils/replyOrEdit` — единый способ обновлять сообщения.

4. **Работа с БД**  
   - Таблицы `products`, `categories`, `stock`, `income`, `outcome`.  
   - Все операции идут через пул `pg`, конфигурация берётся из `.env`.

5. **Запуск и настройка**  
   - Поставить зависимости `npm install`.  
   - Создать `.env` с `BOT_TOKEN`, параметрами подключения к PostgreSQL.  
   - `node bot.js` (или `nodemon bot.js` в разработке).

6. **Безопасность и UX**  
   - Бот проверяет валидность вводимых значений, предотвращает отрицательные остатки.  
   - Все взаимодействия проходят в одном сообщении благодаря inline-кнопкам и `replyOrEdit`.  
   - В логах отражаются ошибки подключения и запросов.

7. **Перспективы развития**  
   - Авторизация по списку сотрудников или ролям.  
   - Экспорт отчётов в Excel/CSV.  
   - Уведомления при достижении критически низких остатков.

## Развёртывание в облаке (независимо от ПК)

### Деплой на Railway (рекомендуется)

**Railway** — простой и бесплатный способ запустить бота без Docker.

#### Пошаговая инструкция:

**0. Установка Git и загрузка в GitHub**

Если Git не установлен:

1. **Установите Git для Windows:**
   - Скачайте с [git-scm.com/download/win](https://git-scm.com/download/win)
   - Установите с настройками по умолчанию
   - Перезапустите PowerShell/Terminal

2. **Настройте Git (первый раз):**
   ```powershell
   git config --global user.name "Ваше Имя"
   git config --global user.email "ваш@email.com"
   ```

3. **Создайте репозиторий на GitHub:**
   - Зайдите на [github.com](https://github.com) и войдите
   - Нажмите "New repository" (зелёная кнопка)
   - Название: `warehouse-bot` (или любое другое)
   - Выберите "Private" (приватный) или "Public" (публичный)
   - НЕ ставьте галочки на "Add README" и других файлах
   - Нажмите "Create repository"

4. **Загрузите код в GitHub:**
   ```powershell
   # Перейдите в папку проекта
   cd C:\Users\User\Desktop\kurs
   
   # Инициализируйте Git
   git init
   
   # Добавьте все файлы
   git add .
   
   # Создайте первый коммит
   git commit -m "Initial commit: warehouse bot"
   
   # Подключите удалённый репозиторий (замените YOUR_USERNAME на ваш GitHub username)
   git remote add origin https://github.com/YOUR_USERNAME/warehouse-bot.git
   
   # Загрузите код
   git branch -M main
   git push -u origin main
   ```
   - При запросе логина используйте ваш GitHub username
   - При запросе пароля используйте Personal Access Token (не обычный пароль)
   - Создать токен: GitHub → Settings → Developer settings → Personal access tokens → Generate new token
   - Выберите срок действия и права: `repo` (полный доступ к репозиториям)

**1. Подготовка репозитория**
- Убедитесь, что код загружен в GitHub (должно быть видно в репозитории)
- Проверьте, что `.env` добавлен в `.gitignore` (уже есть в проекте)

**2. Регистрация и создание проекта**
1. Перейдите на [railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите "Deploy from GitHub repo"
5. Выберите ваш репозиторий с ботом

**3. Настройка сервиса**
- Railway автоматически определит Node.js проект
- Команда запуска: `node bot.js` (устанавливается автоматически)
- Если нужно изменить, в настройках сервиса → Settings → Build & Deploy → Start Command

**4. Настройка базы данных**

**Вариант A: Supabase (рекомендуется)**
1. Зарегистрируйтесь на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. В Settings → Database найдите:
   - Host (например: `db.xxxxx.supabase.co`)
   - Database name
   - Port: `5432`
   - User и Password
4. Скопируйте эти данные

**Вариант B: Neon**
1. Зарегистрируйтесь на [neon.tech](https://neon.tech)
2. Создайте проект
3. Скопируйте connection string или отдельные параметры

**5. Добавление переменных окружения в Railway**
1. В проекте Railway откройте ваш сервис
2. Перейдите в Variables (или Settings → Variables)
3. Добавьте переменные:

   **Вариант A: Connection String (проще, если Supabase/Neon даёт готовую строку)**
   ```
   BOT_TOKEN=ваш_токен_от_BotFather
   DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
   ```

   **Вариант B: Отдельные переменные (если нужно указать по отдельности)**
   ```
   BOT_TOKEN=ваш_токен_от_BotFather
   DB_HOST=хост_бд (например: db.xxxxx.supabase.co)
   DB_USER=пользователь_бд
   DB_PASSWORD=пароль_бд
   DB_NAME=название_бд
   DB_PORT=5432
   DB_SSL=true
   ```

   **Важно:** Используйте только один вариант (A или B), не оба одновременно!

4. После добавления переменных Railway автоматически перезапустит сервис

**6. Проверка работы**
- В разделе Deployments увидите статус деплоя
- В разделе Logs можно посмотреть логи бота
- Если видите "✅ Бот запущен" — всё работает!

**7. Автоматический деплой**
- Railway автоматически деплоит при каждом push в GitHub
- Можно настроить ветку для деплоя в Settings → Source

#### Альтернативные варианты

**VPS (если нужен полный контроль)**
- DigitalOcean, Hetzner, Timeweb
- Установить Node.js, PostgreSQL
- Запустить через PM2: `pm2 start bot.js --name warehouse-bot`

### Создание таблиц в базе данных

После создания БД на Supabase/Neon нужно создать таблицы. Выполните SQL-скрипт в SQL Editor:

```sql
-- Таблица категорий
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Таблица товаров
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  unit VARCHAR(50) DEFAULT 'шт'
);

-- Таблица остатков
CREATE TABLE IF NOT EXISTS stock (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0 CHECK (quantity >= 0)
);

-- Таблица приходов
CREATE TABLE IF NOT EXISTS income (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица списаний
CREATE TABLE IF NOT EXISTS outcome (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Важные моменты для Railway

- **Бесплатный тариф**: $5 кредитов в месяц (обычно хватает для курсовой)
- **Автоматический рестарт**: при падении бота Railway автоматически перезапустит
- **Логи**: доступны в реальном времени в интерфейсе Railway
- **Переменные окружения**: можно менять без передеплоя, сервис перезапустится автоматически

### Мониторинг и логи

- **Railway**: логи доступны в реальном времени в разделе Logs вашего сервиса
- **Проверка работы бота**: отправьте `/start` боту в Telegram — должен ответить
- **Ошибки**: если бот не отвечает, проверьте логи в Railway на наличие ошибок подключения к БД

### Безопасность

- Никогда не коммитьте `.env` в Git (добавьте в `.gitignore`)
- Используйте сильные пароли для БД
- Ограничьте доступ к БД по IP (если возможно)
- Регулярно обновляйте зависимости: `npm audit fix`

