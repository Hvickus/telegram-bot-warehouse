const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

async function renderProducts(ctx, title, buttonBuilder, backAction) {
  await safeAnswerCbQuery(ctx);

  try {
    const res = await pool.query(`SELECT id, name FROM products ORDER BY id`);

    if (res.rows.length === 0) {
      return replyOrEdit(
        ctx,
        "❗ Товары отсутствуют в базе.",
        Markup.inlineKeyboard([[Markup.button.callback("🔙 Назад", backAction)]])
      );
    }

    const buttons = res.rows.map((p) => [buttonBuilder(p)]);
    buttons.push([Markup.button.callback("🔙 Назад", backAction)]);

    await replyOrEdit(ctx, title, Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error("Ошибка manage menus:", err);
    await replyOrEdit(ctx, "Ошибка при загрузке списка товаров.");
  }
}

module.exports = function (bot) {
  bot.action("products_edit", async (ctx) =>
    renderProducts(
      ctx,
      "✏ Выберите товар для редактирования:",
      (p) => Markup.button.callback(p.name, `prod_${p.id}_edit`),
      "menu_products"
    )
  );

  bot.action("products_delete", async (ctx) =>
    renderProducts(
      ctx,
      "🗑 Выберите товар для удаления:",
      (p) => Markup.button.callback(p.name, `prod_${p.id}_delete`),
      "menu_products"
    )
  );
};

