const { Markup } = require("telegraf");
const pool = require("../../db");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const safeEditMessage = require("../../utils/safeEditMessage");

module.exports = function (bot) {
  // Главное меню ролей
  bot.action("roles_menu", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    // Получаем список админов
    const res = await pool.query(
      `SELECT telegram_id, username, is_superadmin
       FROM bot_users
       WHERE role='admin'
       ORDER BY is_superadmin DESC, username`
    );

    let text = "👥 *Администраторы:*\n\n";
    const buttons = [];

    if (res.rows.length === 0) {
      text += "_Администраторов нет._";
    } else {
      res.rows.forEach((admin) => {
        text += `• ${admin.username || admin.telegram_id}`;
        if (admin.is_superadmin) text += " (главный админ)";
        text += "\n";

        // Кнопка удаления, если это не главный админ и не ты сам
        if (!admin.is_superadmin && admin.telegram_id !== ctx.from.id) {
          buttons.push([
            Markup.button.callback(
              `❌ ${admin.username || admin.telegram_id}`,
              `remove_admin_${admin.telegram_id}`
            ),
          ]);
        }
      });
    }

    // Кнопка добавления нового администратора
    buttons.push([
      Markup.button.callback("➕ Добавить администратора", "add_admin"),
    ]);
    buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

    await safeEditMessage(ctx, text, {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard(buttons),
    });
  });

  // Добавление администратора
  bot.action("add_admin", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    ctx.session = ctx.session || {};
    ctx.session.flow = "add_admin";

    await safeEditMessage(
      ctx,
      "Введите Telegram ID пользователя, которого хотите сделать администратором:"
    );
  });

  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "add_admin") return next();

    const telegramId = Number(ctx.message.text.trim());
    if (!Number.isInteger(telegramId))
      return ctx.reply("❌ Введите корректный числовой Telegram ID.");

    try {
      const res = await pool.query(
        "SELECT telegram_id FROM bot_users WHERE telegram_id=$1",
        [telegramId]
      );
      if (res.rows.length === 0) {
        return ctx.reply("❌ Пользователь не найден в базе бота.");
      }

      await pool.query(
        "UPDATE bot_users SET role='admin' WHERE telegram_id=$1",
        [telegramId]
      );

      delete ctx.session.flow;

      await ctx.reply(`✅ Пользователь ${telegramId} теперь администратор.`);
      // Можно сразу открыть меню ролей
      await bot.telegram.sendMessage(
        ctx.chat.id,
        "Обновлён список администраторов:",
        {
          reply_markup: (await require("./rolesMenu")(ctx)).reply_markup,
        }
      );
    } catch (err) {
      console.error("Ошибка добавления администратора:", err);
      return ctx.reply("❌ Ошибка при назначении администратора.");
    }
  });

  // Удаление администратора
  bot.action(/remove_admin_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const userId = Number(ctx.match[1]);

    try {
      const res = await pool.query(
        "SELECT is_superadmin FROM bot_users WHERE telegram_id=$1",
        [userId]
      );

      if (!res.rows[0]) return ctx.reply("❌ Пользователь не найден.");
      if (res.rows[0].is_superadmin)
        return ctx.reply("❌ Нельзя удалить главного администратора!");
      if (userId === ctx.from.id)
        return ctx.reply("❌ Вы не можете удалить себя из администраторов.");

      await pool.query("UPDATE bot_users SET role=NULL WHERE telegram_id=$1", [
        userId,
      ]);

      await ctx.reply(`✅ Пользователь ${userId} больше не администратор.`);
      // Обновляем меню
      await bot.telegram.sendMessage(
        ctx.chat.id,
        "Обновлён список администраторов:",
        {
          reply_markup: (await require("./rolesMenu")(ctx)).reply_markup,
        }
      );
    } catch (err) {
      console.error("Ошибка удаления администратора:", err);
      return ctx.reply("❌ Ошибка при удалении администратора.");
    }
  });
};
