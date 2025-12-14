require("dotenv").config();
const { Telegraf } = require("telegraf");
const LocalSession = require("telegraf-session-local");
const pool = require("./db");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Локальная сессия
bot.use(new LocalSession({ database: "session_db.json" }).middleware());

// Проверка подключения к БД
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Подключение к PostgreSQL успешно");
  } catch (err) {
    console.error("❌ Ошибка подключения к PostgreSQL:", err);
    process.exit(1);
  }
})();

// Стартовое сообщение с главным меню
bot.start(async (ctx) => {
  const mainMenu = require("./menus/mainMenu");
  await ctx.reply("Привет! Добро пожаловать в систему управления складом.", {
    reply_markup: mainMenu().reply_markup,
  });
});

// Меню Excel отчётов
require("./handlers/reports/excelMenu")(bot);

// Навигация
require("./handlers/navigation")(bot);

// Продукты (список, просмотр, добавление, редактирование, удаление, управление меню)
const registerProductPagination = require("./handlers/products/list");
registerProductPagination(bot);

require("./handlers/products/view")(bot);
require("./handlers/products/add")(bot);
require("./handlers/products/edit")(bot);
require("./handlers/products/delete")(bot);
require("./handlers/products/manageMenus")(bot);

// Остатки на складе
require("./handlers/stock/showStock")(bot);

// Приход и списание
require("./handlers/income/incomeAdd")(bot);
require("./handlers/outcome/outcomeAdd")(bot);

// Отчёты
require("./handlers/reports/lowStock")(bot);
require("./handlers/reports/movements")(bot);

// Запуск бота
bot.launch().then(() => {
  console.log("✅ Бот запущен");
});

// Корректное завершение работы
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
