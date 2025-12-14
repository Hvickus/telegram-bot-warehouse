const pool = require("../db");

async function logUserAction(telegramId, action, extra = "") {
  try {
    const actionText = extra ? `${action}: ${extra}` : action;
    await pool.query("SELECT log_user_action($1, $2)", [
      telegramId,
      actionText,
    ]);
  } catch (err) {
    console.error("Ошибка логирования действия пользователя:", err);
  }
}

module.exports = logUserAction;
