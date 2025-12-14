const { Markup } = require("telegraf");
const pool = require("../../db");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const safeEditMessage = require("../../utils/safeEditMessage");
const rolesMenu = require("../../menus/rolesMenu");

module.exports = function (bot) {
  // Главное меню управления администраторами
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

  // Ввод ID нового администратора
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "add_admin") return next();

    const newAdminId = Number(ctx.message.text.trim());
    if (!Number.isInteger(newAdminId)) {
      return ctx.reply("Введите корректный числовой Telegram ID.");
    }

    await pool.query("UPDATE bot_users SET role='admin' WHERE telegram_id=$1", [
      newAdminId,
    ]);

    delete ctx.session.flow;

    await ctx.reply("✅ Администратор добавлен.");
    const keyboard = await rolesMenu(ctx);
    await safeEditMessage(ctx, "👥 Управление администраторами:", {
      reply_markup: keyboard,
    });
  });

  // Удаление администратора
  bot.action(/del_admin_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const adminId = Number(ctx.match[1]);
    if (adminId === ctx.from.id) {
      return ctx.reply("❌ Нельзя удалить себя из администраторов!");
    }

    await pool.query("UPDATE bot_users SET role='user' WHERE telegram_id=$1", [
      adminId,
    ]);

    await ctx.reply("✅ Администратор удалён.");
    const keyboard = await rolesMenu(ctx);
    await safeEditMessage(ctx, "👥 Управление администраторами:", {
      reply_markup: keyboard,
    });
  });

  // Заглушка для noop
  bot.action("noop", async (ctx) => {
    await safeAnswerCbQuery(ctx);
  });
};
