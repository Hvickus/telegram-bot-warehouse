const { Markup } = require("telegraf");

module.exports = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("📤 Добавить списание", "outcome_start")],
    [Markup.button.callback("🔙 Назад", "back_main")],
  ]);
