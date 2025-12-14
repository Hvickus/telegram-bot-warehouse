const { Markup } = require("telegraf");

module.exports = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("📊 Показать остатки", "show_stock")],
    [Markup.button.callback("🔙 Назад", "back_main")],
  ]);
