const { Markup } = require("telegraf");
const pool = require("../../db");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const replyOrEdit = require("../../utils/replyOrEdit");

// Проверка: админ или нет
async function isAdmin(ctx) {
  const res = await pool.query(
    "SELECT role FROM bot_users WHERE telegram_id = $1",
    [ctx.from.id]
  );
  return res.rows[0]?.role === "admin";
}

module.exports = function (bot) {
  // Меню ролей
  bot.action("roles_menu", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    if (!(await isAdmin(ctx))) {
      return replyOrEdit(ctx, "⛔ У вас нет доступа.");
    }

    await replyOrEdit(ctx, "👥 *Управление ролями*", {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "➕ Добавить администратора",
            "role_add_admin"
          ),
        ],
        [
          Markup.button.callback(
            "📋 Список администраторов",
            "role_list_admins"
          ),
        ],
        [Markup.button.callback("🔙 Назад", "back_main")],
      ]),
    });
  });

  // Запуск добавления админа
  bot.action("role_add_admin", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    if (!(await isAdmin(ctx))) {
      return replyOrEdit(ctx, "⛔ У вас нет доступа.");
    }

    ctx.session = ctx.session || {};
    ctx.session.flow = "add_admin";

    await replyOrEdit(
      ctx,
      "Введите Telegram ID пользователя, которого нужно сделать администратором:"
    );
  });

  // Обработка ввода Telegram ID
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "add_admin") return next();

    const telegramId = Number(ctx.message.text.trim());
    if (!Number.isInteger(telegramId)) {
      return ctx.reply("Введите корректный Telegram ID (число).");
    }

    const res = await pool.query(
      "SELECT id FROM bot_users WHERE telegram_id = $1",
      [telegramId]
    );

    if (res.rows.length === 0) {
      return ctx.reply(
        "Пользователь не найден. Он должен хотя бы раз запустить бота."
      );
    }

    await pool.query(
      "UPDATE bot_users SET role = 'admin' WHERE telegram_id = $1",
      [telegramId]
    );

    await pool.query("SELECT log_user_action($1, $2)", [
      ctx.from.id,
      `add_admin_${telegramId}`,
    ]);

    delete ctx.session.flow;

    await replyOrEdit(
      ctx,
      "✅ Пользователь успешно назначен администратором.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад", "roles_menu")],
      ])
    );
  });

  // Список администраторов
  bot.action("role_list_admins", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    if (!(await isAdmin(ctx))) {
      return replyOrEdit(ctx, "⛔ У вас нет доступа.");
    }

    const res = await pool.query(
      "SELECT telegram_id, username FROM bot_users WHERE role = 'admin' ORDER BY telegram_id"
    );

    if (res.rows.length === 0) {
      return replyOrEdit(ctx, "Администраторы не найдены.");
    }

    let text = "👑 *Администраторы:*\n\n";
    res.rows.forEach((u, i) => {
      text += `${i + 1}. ${u.username || "—"} (${u.telegram_id})\n`;
    });

    await replyOrEdit(ctx, text, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад", "roles_menu")],
      ]),
    });
  });
};
