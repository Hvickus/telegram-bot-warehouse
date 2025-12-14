require("dotenv").config();
const { Telegraf } = require("telegraf");
const LocalSession = require("telegraf-session-local");
const pool = require("./db");

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(new LocalSession({ database: "session_db.json" }).middleware());

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Подключение к PostgreSQL успешно");
  } catch (err) {
    console.error("❌ Ошибка подключения к PostgreSQL:", err);
    process.exit(1);
  }
})();

bot.start(async (ctx) => {
  const mainMenu = require("./menus/mainMenu");
  await ctx.reply("Привет! Добро пожаловать в систему управления складом.", {
    reply_markup: mainMenu().reply_markup,
  });
});

require("./handlers/reports/excelMenu")(bot);

require("./handlers/navigation")(bot);
require("./handlers/products/list")(bot);
require("./handlers/products/view")(bot);
require("./handlers/products/add")(bot);
require("./handlers/products/edit")(bot);
require("./handlers/products/delete")(bot);
require("./handlers/products/manageMenus")(bot);

require("./handlers/stock/showStock")(bot);

require("./handlers/income/incomeAdd")(bot);
require("./handlers/outcome/outcomeAdd")(bot);

require("./handlers/reports/lowStock")(bot);
require("./handlers/reports/movements")(bot);

bot.launch().then(() => {
  console.log("✅ Бот запущен");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
