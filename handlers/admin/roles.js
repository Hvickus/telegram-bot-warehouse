const pool = require("../../db");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const safeEditMessage = require("../../utils/safeEditMessage");
const rolesMenu = require("../../menus/rolesMenu");

const MAIN_ADMIN_ID = 1111944400; // ваш Telegram ID

module.exports = function (bot) {
  // Главное меню управления ролями
  bot.action("roles_menu", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const keyboard = await rolesMenu(ctx);
    await safeEditMessage(ctx, "👥 Управление администраторами:", keyboard);
  });

  // Добавление администратора
  bot.action("add_admin", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await safeEditMessage(ctx, "Введите Telegram ID нового администратора:");
    ctx.session = ctx.session || {};
    ctx.session.flow = "add_admin";
  });

  // Обработка ввода Telegram ID
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "add_admin") return next();

    const telegramId = Number(ctx.message.text.trim());
    if (!Number.isInteger(telegramId))
      return ctx.reply("Введите корректный числовой Telegram ID.");

    try {
      await pool.query(
        `UPDATE bot_users SET role = 'admin' WHERE telegram_id = $1`,
        [telegramId]
      );
      delete ctx.session.flow;

      const keyboard = await rolesMenu(ctx); // обновляем список админов
      await safeEditMessage(
        ctx,
        "✅ Пользователь назначен администратором.",
        keyboard
      );
    } catch (err) {
      console.error("Ошибка назначения администратора:", err);
      await ctx.reply("Ошибка при назначении администратора.");
    }
  });

  // Удаление администратора
  bot.action(/del_admin_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const telegramId = Number(ctx.match[1]);
    if (telegramId === MAIN_ADMIN_ID)
      return ctx.reply("❌ Главного администратора удалить нельзя.");

    try {
      await pool.query(
        `UPDATE bot_users SET role = 'user' WHERE telegram_id = $1`,
        [telegramId]
      );
      const keyboard = await rolesMenu(ctx);
      await safeEditMessage(ctx, "✅ Администратор удалён.", keyboard);
    } catch (err) {
      console.error("Ошибка удаления администратора:", err);
      await ctx.reply("Ошибка при удалении администратора.");
    }
  });
};
