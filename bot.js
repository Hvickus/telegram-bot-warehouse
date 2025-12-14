require("dotenv").config();
const { Telegraf } = require("telegraf");
const LocalSession = require("telegraf-session-local");
const pool = require("./db");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Сессии
bot.use(new LocalSession({ database: "session_db.json" }).middleware());

// Проверка БД
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Подключение к PostgreSQL успешно");
  } catch (err) {
    console.error("❌ Ошибка подключения к PostgreSQL:", err);
    process.exit(1);
  }
})();

// START
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || null;

  await pool.query(
    `INSERT INTO bot_users (telegram_id, username)
     VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO NOTHING`,
    [telegramId, username]
  );

  const mainMenu = require("./menus/mainMenu");
  const keyboard = await mainMenu(ctx);

  await ctx.reply("Привет! Добро пожаловать.", {
    reply_markup: keyboard.reply_markup,
  });
});

// Роли
require("./handlers/admin/roles")(bot);

// Excel
require("./handlers/reports/excelMenu")(bot);

// Навигация
require("./handlers/navigation")(bot);

// Продукты
require("./handlers/products/list")(bot);
require("./handlers/products/view")(bot);
require("./handlers/products/add")(bot);
require("./handlers/products/edit")(bot);
require("./handlers/products/delete")(bot);
require("./handlers/products/manageMenus")(bot);

// Остатки
require("./handlers/stock/showStock")(bot);

// Приход / списание
require("./handlers/income/incomeAdd")(bot);
require("./handlers/outcome/outcomeAdd")(bot);

// Отчёты
require("./handlers/reports/lowStock")(bot);
require("./handlers/reports/movements")(bot);

// Запуск
bot.launch().then(() => {
  console.log("✅ Бот запущен");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
