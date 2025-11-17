const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  // Запуск удаления товара
  bot.action(/prod_(.+)_delete/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "delete_product";
    ctx.session.productId = productId;

    try {
      const res = await pool.query(
        `SELECT p.id, p.name, COALESCE(s.quantity,0) AS quantity
         FROM products p
         LEFT JOIN stock s ON s.product_id = p.id
         WHERE p.id=$1`,
        [productId]
      );

      if (res.rows.length === 0) return ctx.reply("❗ Товар не найден.");

      const p = res.rows[0];

      await replyOrEdit(
        ctx,
        `❗ *Удаление товара*\n\n` +
          `Вы уверены, что хотите удалить товар:\n\n` +
          `📌 *${p.name}*\n` +
          `📦 Количество: ${p.quantity}\n\n` +
          `Это действие необратимо!`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "✅ Да, удалить",
                `confirm_del_${productId}`
              ),
              Markup.button.callback("❌ Отмена", "products_list"),
            ],
          ]),
        }
      );
    } catch (err) {
      console.error("Ошибка prod_X_delete:", err);
      ctx.reply("Ошибка при загрузке товара.");
    }
  });

  // Подтверждение удаления
  bot.action(/confirm_del_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);

    try {
      // Удаляем остатки
      await pool.query("DELETE FROM stock WHERE product_id=$1", [productId]);

      // Удаляем товар
      const result = await pool.query(
        "DELETE FROM products WHERE id=$1 RETURNING name",
        [productId]
      );

      if (result.rows.length === 0)
        return ctx.reply("❗ Товар уже удалён или не найден.");

      const deletedName = result.rows[0].name;

      if (ctx.session) {
        delete ctx.session.flow;
        delete ctx.session.productId;
      }

      await replyOrEdit(ctx, `🗑 Товар *${deletedName}* успешно удалён!`, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🔙 Назад к списку товаров",
              "products_list"
            ),
          ],
        ]),
      });
    } catch (err) {
      console.error("Ошибка confirm_del_X:", err);
      await replyOrEdit(ctx, "Ошибка при удалении товара.");
    }
  });
};
