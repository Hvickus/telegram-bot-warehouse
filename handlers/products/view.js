const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  bot.action(/^prod_(\d+)$/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);

    try {
      const res = await pool.query(
        `SELECT p.id, p.name, c.name AS category, COALESCE(s.quantity, 0) AS quantity
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN stock s ON s.product_id = p.id
         WHERE p.id = $1`,
        [productId]
      );

      if (res.rows.length === 0) {
        return ctx.reply("❗ Товар не найден.");
      }

      const p = res.rows[0];

      await replyOrEdit(
        ctx,
        `📦 *${p.name}*\n` +
          `Категория: ${p.category || "—"}\n` +
          `Остаток: ${p.quantity}`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад к списку", "products_list")],
          ]),
        }
      );
    } catch (err) {
      console.error("Ошибка prod_X:", err);
      await replyOrEdit(ctx, "Ошибка при получении данных товара.");
    }
  });
};
