require("dotenv").config();
const { Telegraf } = require("telegraf");
const LocalSession = require("telegraf-session-local");
const pool = require("./db");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Сессии
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

// Главное меню
bot.start(async (ctx) => {
  const mainMenu = require("./menus/mainMenu");
  await ctx.reply("Привет! Добро пожаловать в систему управления складом.", {
    reply_markup: mainMenu().reply_markup,
  });
});

// Excel отчёты
require("./handlers/reports/excelMenu")(bot);

// Навигация
require("./handlers/navigation")(bot);

// Обработчики продуктов
const {
  showProducts,
  registerProductPagination,
} = require("./handlers/products/list");
const viewProduct = require("./handlers/products/view");
const addProduct = require("./handlers/products/add");
const editProduct = require("./handlers/products/edit");
const deleteProduct = require("./handlers/products/delete");
const manageMenus = require("./handlers/products/manageMenus");

// Кнопка "Товары" — постраничный вывод
bot.action("menu_products", async (ctx) => {
  ctx.session.productsPage = 1;
  await showProducts(ctx, 1); // первая страница
});

// Регистрируем обработку пагинации для товаров
registerProductPagination(bot);

// Остальные обработчики продуктов
viewProduct(bot);
addProduct(bot);
editProduct(bot);
deleteProduct(bot);
manageMenus(bot);

// Остатки
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

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
