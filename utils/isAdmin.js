const pool = require("../db");

module.exports = async function isAdmin(ctx) {
  const res = await pool.query(
    "SELECT role FROM bot_users WHERE telegram_id=$1",
    [ctx.from.id]
  );
  return res.rows.length && res.rows[0].role === "admin";
};
