const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const safeEditMessage = require("../../utils/safeEditMessage");
const pool = require("../../db");
const rolesMenu = require("../../menus/rolesMenu");

module.exports = function (bot) {
  // Открыть меню ролей
  bot.action("roles_menu", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const keyboard = await rolesMenu(ctx);
    await safeEditMessage(ctx, "👥 Управление администраторами:", {
      reply_markup: keyboard,
    });
  });

  // Добавление администратора
  bot.action("add_admin", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    ctx.session = ctx.session || {};
    ctx.session.flow = "add_admin";

    await safeEditMessage(
      ctx,
      "Введите Telegram ID пользователя, чтобы дать права администратора:"
    );
  });

  // Удаление администратора
  bot.action(/del_admin_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const telegramId = Number(ctx.match[1]);

    try {
      await pool.query(
        "UPDATE bot_users SET role='user' WHERE telegram_id=$1",
        [telegramId]
      );

      const keyboard = await rolesMenu(ctx);
      await safeEditMessage(ctx, "✅ Администратор удалён", {
        reply_markup: keyboard,
      });
    } catch (err) {
      console.error("Ошибка удаления администратора:", err);
      await safeEditMessage(ctx, "❌ Ошибка при удалении администратора.");
    }
  });

  // Обработка ввода Telegram ID для добавления администратора
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "add_admin") return next();

    const telegramId = Number(ctx.message.text.trim());
    if (!Number.isInteger(telegramId)) {
      return ctx.reply("❌ Некорректный Telegram ID. Попробуйте снова:");
    }

    try {
      // Проверяем, есть ли пользователь в базе
      const res = await pool.query(
        "SELECT * FROM bot_users WHERE telegram_id=$1",
        [telegramId]
      );
      if (res.rows.length === 0) {
        return ctx.reply(
          "❌ Пользователь не найден в базе. Он должен сначала начать бота."
        );
      }

      // Делаем администратора
      await pool.query(
        "UPDATE bot_users SET role='admin' WHERE telegram_id=$1",
        [telegramId]
      );

      ctx.session.flow = null;

      const keyboard = await rolesMenu(ctx);
      await safeEditMessage(
        ctx,
        `✅ Пользователь ${telegramId} теперь администратор`,
        { reply_markup: keyboard }
      );
    } catch (err) {
      console.error("Ошибка добавления администратора:", err);
      await ctx.reply("❌ Ошибка при добавлении администратора.");
    }
  });

  // noop для кнопок, которые нельзя нажимать
  bot.action("noop", async (ctx) => {
    await safeAnswerCbQuery(ctx);
  });
};
