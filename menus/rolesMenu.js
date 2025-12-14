const { Markup } = require("telegraf");
const pool = require("../db");

module.exports = async function rolesMenu(ctx) {
  // Получаем список всех администраторов
  const res = await pool.query(
    "SELECT telegram_id, username FROM bot_users WHERE role='admin' ORDER BY telegram_id"
  );

  const buttons = res.rows.map((u) => {
    const canDelete = u.telegram_id !== ctx.from.id; // нельзя удалить себя
    return [
      Markup.button.callback(
        `${u.username || u.telegram_id} ${canDelete ? "❌" : ""}`,
        canDelete ? `del_admin_${u.telegram_id}` : "noop"
      ),
    ];
  });

  // Кнопка добавления нового админа
  buttons.push([
    Markup.button.callback("➕ Добавить администратора", "add_admin"),
  ]);

  // Кнопка возврата в главное меню
  buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

  return Markup.inlineKeyboard(buttons);
};
