const { Markup } = require("telegraf");

module.exports = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("⚠️ Минимальные остатки", "report_low_stock")],
    [Markup.button.callback("📊 Движение за период", "report_movements")],
    [Markup.button.callback("🔙 Назад", "back_main")],
  ]);
