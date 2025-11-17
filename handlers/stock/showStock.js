const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  bot.action("stock_show", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    try {
      // Получаем все товары, сортировка по количеству
      const res = await pool.query(
        `SELECT p.id, p.name, COALESCE(s.quantity, 0) AS quantity
         FROM products p
         LEFT JOIN stock s ON s.product_id = p.id
         ORDER BY quantity ASC`
      );

      if (res.rows.length === 0) {
        return replyOrEdit(
          ctx,
          "📦 На складе пока нет товаров.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад", "back_main")],
          ])
        );
      }

      // Формируем сообщение и кнопки
      let message = `📦 *Остатки на складе*\n\n`;

      const buttons = [];

      res.rows.forEach((p) => {
        const lowStock = p.quantity < 5 ? "⚠️ " : "";
        message += `• ${lowStock}*${p.name}* — ${p.quantity}\n`;

        // кнопка "Детально" для каждого товара
        buttons.push([Markup.button.callback(`📄 ${p.name}`, `stock_prod_${p.id}`)]);
      });

      // Добавляем кнопки управления
      buttons.push([
        Markup.button.callback("🔄 Обновить", "stock_show"),
        Markup.button.callback("🔙 Назад", "back_main"),
      ]);

      await replyOrEdit(ctx, message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (err) {
      console.error("Ошибка stock_show:", err);
      await replyOrEdit(ctx, "Ошибка загрузки остатков.");
    }
  });

  // Просмотр товара из остатков
  bot.action(/^stock_prod_(\d+)$/, async (ctx) => {
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
        return replyOrEdit(ctx, "❗ Товар не найден.");
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
            [Markup.button.callback("🔙 Назад к списку", "stock_show")],
          ]),
        }
      );
    } catch (err) {
      console.error("Ошибка stock_prod_X:", err);
      await replyOrEdit(ctx, "Ошибка при получении данных товара.");
    }
  });
};
