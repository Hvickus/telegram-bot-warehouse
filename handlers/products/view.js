const pool = require("../../db");
const { Markup } = require("telegraf");

module.exports = function (bot) {
  /**
   * Просмотр информации о товаре по кнопке
   * Используется callback вида: product_view_<id>
   */
  bot.action(/product_view_(\d+)/, async (ctx) => {
    const productId = ctx.match[1];

    try {
      // Получаем информацию о товаре и текущем остатке
      const res = await pool.query(
        `
        SELECT 
          p.id, 
          p.name, 
          c.name AS category, 
          p.price, 
          COALESCE(s.quantity, 0) AS current_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN stock s ON s.product_id = p.id
        WHERE p.id = $1
        `,
        [productId]
      );

      if (!res.rows.length) {
        return ctx.reply("❌ Товар не найден");
      }

      const product = res.rows[0];

      // Формируем сообщение
      const messageText = `
📦 *${product.name}*

Категория: ${product.category || "-"}
Цена: ${product.price ?? "-"}
Текущее количество на складе: *${product.current_stock}*
      `;

      // Кнопки управления товаром
      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✏️ Редактировать",
            `product_edit_${product.id}`
          ),
          Markup.button.callback("🗑 Удалить", `product_delete_${product.id}`),
        ],
        [Markup.button.callback("🔙 Назад к списку", "products_list")],
      ]);

      await ctx.reply(messageText, { parse_mode: "Markdown", ...buttons });
    } catch (err) {
      console.error("Ошибка при получении товара:", err);
      await ctx.reply("❌ Произошла ошибка при загрузке информации о товаре");
    }
  });
};
