const { Markup } = require("telegraf");
const pool = require("../db");

const MAIN_ADMIN_ID = 1111944400; // <-- ваш Telegram ID

module.exports = async function rolesMenu(ctx) {
  const res = await pool.query(
    `SELECT telegram_id, username
     FROM bot_users
     WHERE role = 'admin'
     ORDER BY telegram_id`
  );

  const buttons = res.rows.map((user) => {
    const username = user.username ? `@${user.username}` : user.telegram_id;
    const isMain = user.telegram_id === MAIN_ADMIN_ID;

    return [
      Markup.button.callback(username, `admin_${user.telegram_id}`),
      ...(isMain
        ? []
        : [Markup.button.callback("❌", `del_admin_${user.telegram_id}`)]),
    ];
  });

  // Добавить администратора
  buttons.push([
    Markup.button.callback("➕ Добавить администратора", "add_admin"),
  ]);
  // Назад
  buttons.push([Markup.button.callback("🔙 Назад", "back_main")]);

  return Markup.inlineKeyboard(buttons); // возвращаем готовый объект клавиатуры
};
