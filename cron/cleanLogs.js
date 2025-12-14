const cron = require("node-cron");
const pool = require("../db");

// Запускаем cron каждый день в 03:00
cron.schedule("0 3 * * *", async () => {
  try {
    const res = await pool.query(
      "DELETE FROM user_actions_log WHERE created_at < now() - interval '7 days'"
    );
    console.log(`[${new Date().toISOString()}] Очистка логов завершена`);
  } catch (err) {
    console.error("Ошибка очистки логов:", err);
  }
});
