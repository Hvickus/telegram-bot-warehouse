const { Markup } = require("telegraf");
const pool = require("../db");

module.exports = async function mainMenu(ctx) {
  const buttons = [
    [Markup.button.callback("📦 Товары", "menu_products")],
    [Markup.button.callback("🔍 Остатки", "menu_stock")],
    [Markup.button.callback("📥 Приход товара", "menu_income")],
    [Markup.button.callback("📤 Списание товара", "menu_outcome")],
    [Markup.button.callback("📊 Отчёты", "menu_reports")],
    [Markup.button.callback("📈 Excel отчёт", "excel_report")],
  ];

  const res = await pool.query(
    "SELECT role FROM bot_users WHERE telegram_id = $1",
    [ctx.from.id]
  );

  if (res.rows[0]?.role === "admin") {
    buttons.push([
      Markup.button.callback("👥 Управление ролями", "roles_menu"),
    ]);
  }

  return Markup.inlineKeyboard(buttons);
};
