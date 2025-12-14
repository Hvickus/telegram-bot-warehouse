const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  // Просмотр конкретного товара
  bot.action(/product_view_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = parseInt(ctx.match[1], 10);

    // Получаем данные о товаре
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.description, c.name AS category
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [productId]
    );

    if (rows.length === 0) {
      return ctx.reply("❌ Товар не найден.");
    }

    const product = rows[0];
    const text =
      `📦 *${product.name}*\n\n` +
      `Категория: ${product.category || "-"}\n` +
      `Описание: ${product.description || "-"}`;

    // Кнопка "Назад к списку"
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("⬅️ Назад к списку", "products_list")],
    ]);

    await replyOrEdit(ctx, text, { parse_mode: "Markdown", ...keyboard });
  });
};
