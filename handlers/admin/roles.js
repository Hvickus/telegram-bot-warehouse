const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const safeEditMessage = require("../../utils/safeEditMessage");
const pool = require("../../db");
const rolesMenu = require("../../menus/rolesMenu");

const MAIN_ADMIN_ID = 1111944400; // твой Telegram ID, нельзя удалить

module.exports = function (bot) {
  // Открыть меню ролей
  bot.action("roles_menu", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const keyboard = await rolesMenu(ctx);
    await safeEditMessage(ctx, "👥 Управление администраторами:", {
      reply_markup: keyboard,
    });
  });

  // Кнопка "Добавить администратора"
  bot.action("add_admin", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    ctx.session = ctx.session || {};
    ctx.session.flow = "add_admin";

    await safeEditMessage(ctx, "Введите Telegram ID нового администратора:");
  });

  // Ввод Telegram ID нового администратора
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "add_admin") return next();

    const newId = Number(ctx.message.text.trim());
    if (!Number.isInteger(newId))
      return ctx.reply("Введите корректный Telegram ID.");

    try {
      await pool.query(
        `INSERT INTO bot_users (telegram_id, role)
         VALUES ($1, 'admin')
         ON CONFLICT (telegram_id) DO UPDATE SET role='admin'`,
        [newId]
      );

      delete ctx.session.flow;

      await safeEditMessage(
        ctx,
        `✅ Пользователь с Telegram ID ${newId} назначен администратором.`,
        { reply_markup: await rolesMenu(ctx) }
      );
    } catch (err) {
      console.error("Ошибка добавления администратора:", err);
      await ctx.reply("Ошибка при добавлении администратора.");
    }
  });

  // Кнопка удаления админа
  bot.action(/admin_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const userId = Number(ctx.match[1]);

    if (userId === MAIN_ADMIN_ID) {
      return ctx.reply("❌ Нельзя удалить главного администратора.");
    }

    try {
      await pool.query(
        "UPDATE bot_users SET role='user' WHERE telegram_id=$1",
        [userId]
      );

      await safeEditMessage(
        ctx,
        `🗑 Администратор с Telegram ID ${userId} удалён.`,
        { reply_markup: await rolesMenu(ctx) }
      );
    } catch (err) {
      console.error("Ошибка удаления администратора:", err);
      await ctx.reply("Ошибка при удалении администратора.");
    }
  });
};
