const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  bot.action("products_list", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    try {
      const res = await pool.query(`SELECT id, name FROM products ORDER BY id`);

      if (res.rows.length === 0) {
        return replyOrEdit(
          ctx,
          "❗ Товары отсутствуют в базе.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад", "menu_products")],
          ])
        );
      }

      const buttons = res.rows.map((p) => [
        Markup.button.callback(p.name, `prod_${p.id}`),
      ]);

      buttons.push([Markup.button.callback("🔙 Назад", "menu_products")]);

      await replyOrEdit(ctx, "📦 Выберите товар:", Markup.inlineKeyboard(buttons));
    } catch (err) {
      console.error("Ошибка products_list:", err);
      await replyOrEdit(ctx, "Ошибка при загрузке списка товаров.");
    }
  });
};
