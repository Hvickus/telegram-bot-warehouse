// navigation.js
const mainMenu = require("../menus/mainMenu");
const productsMenu = require("../menus/productsMenu");
const stockMenu = require("./stock/stockMenu");
const incomeMenu = require("./income/incomeMenu");
const outcomeMenu = require("./outcome/outcomeMenu");
const reportsMenu = require("./reports/menu");
const safeAnswerCbQuery = require("../utils/safeAnswerCbQuery");
const safeEditMessage = require("../utils/safeEditMessage");
const rolesMenu = require("../../menus/rolesMenu");

module.exports = function (bot) {
  // Главное меню
  bot.action("back_main", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const keyboard = await mainMenu(ctx);
    await safeEditMessage(ctx, "Главное меню:", { reply_markup: keyboard });
  });

  // Меню товаров
  bot.action("menu_products", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await safeEditMessage(ctx, "📦 Меню товаров:", {
      reply_markup: productsMenu().reply_markup,
    });
  });

  // Меню остатков
  bot.action("menu_stock", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await safeEditMessage(ctx, "📦 Меню остатков:", {
      reply_markup: stockMenu().reply_markup,
    });
  });

  // Меню прихода
  bot.action("menu_income", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await safeEditMessage(ctx, "📥 Меню прихода:", {
      reply_markup: incomeMenu().reply_markup,
    });
  });

  // Меню списания
  bot.action("menu_outcome", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await safeEditMessage(ctx, "📤 Меню списания:", {
      reply_markup: outcomeMenu().reply_markup,
    });
  });

  // Меню отчётов
  bot.action("menu_reports", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await safeEditMessage(ctx, "📊 Меню отчётов:", {
      reply_markup: reportsMenu().reply_markup,
    });
  });

  // Меню ролей
  bot.action("roles_menu", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const keyboard = await rolesMenu(ctx);
    await safeEditMessage(ctx, "👥 Управление администраторами:", {
      reply_markup: keyboard,
    });
  });
};
