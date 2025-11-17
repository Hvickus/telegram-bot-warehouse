const { Markup } = require("telegraf");

module.exports = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("📦 Показать остатки", "stock_show")],
    [Markup.button.callback("🔙 Назад", "back_main")],
  ]);
