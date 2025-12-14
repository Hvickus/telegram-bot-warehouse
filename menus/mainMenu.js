const { Markup } = require("telegraf");

module.exports = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("📦 Товары", "menu_products")],
    [Markup.button.callback("🔍 Остатки", "menu_stock")],
    [Markup.button.callback("📥 Приход товара", "menu_income")],
    [Markup.button.callback("📤 Списание товара", "menu_outcome")],
    [Markup.button.callback("📊 Отчёты", "menu_reports")],
    [Markup.button.callback("📈 Excel отчёт", "generate_excel_report")],
  ]);
