const pool = require("../db");

/**
 * Логирование действия пользователя
 * @param {number} telegramId
 * @param {string} type - "command", "message", "callback_query"
 * @param {string} data - текст команды, сообщения или callback_data
 */
async function logUserAction(telegramId, type, data) {
  try {
    await pool.query(
      "INSERT INTO user_actions_log (telegram_id, action, created_at) VALUES ($1, $2, now())",
      [telegramId, `${type}: ${data}`]
    );
  } catch (err) {
    console.error("Ошибка логирования действия пользователя:", err);
  }
}

module.exports = logUserAction;
