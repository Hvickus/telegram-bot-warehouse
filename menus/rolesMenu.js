const { Markup } = require("telegraf");
const pool = require("../db");

module.exports = async function rolesMenu(ctx) {
  // Получаем роль пользователя
  const resRole = await pool.query(
    "SELECT role FROM bot_users WHERE telegram_id=$1",
    [ctx.from.id]
  );
  const role = resRole.rows[0]?.role || "user";

  if (role !== "admin") {
    return Markup.inlineKeyboard([
      [Markup.button.callback("🔙 Главное меню", "back_main")],
    ]);
  }

  // Получаем список админов
  const resAdmins = await pool.query(
    "SELECT telegram_id, username FROM bot_users WHERE role='admin' ORDER BY id"
  );

  const adminButtons = resAdmins.rows.map((u) => {
    const label = u.username ? `@${u.username}` : u.telegram_id;
    return [Markup.button.callback(label, `admin_${u.telegram_id}`)];
  });

  // Добавляем кнопки для управления
  adminButtons.push([
    Markup.button.callback("➕ Добавить администратора", "add_admin"),
  ]);
  adminButtons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

  return Markup.inlineKeyboard(adminButtons);
};
