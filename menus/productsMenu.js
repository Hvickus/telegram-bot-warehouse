const { Markup } = require("telegraf");

module.exports = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("▶️ Просмотр списка", "products_list")],
    [Markup.button.callback("➕ Добавить товар", "products_add")],
    [Markup.button.callback("✏ Редактировать товар", "products_edit")],
    [Markup.button.callback("❌ Удалить товар", "products_delete")],
    [Markup.button.callback("🔙 Назад", "back_main")],
  ]);
