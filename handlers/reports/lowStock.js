const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  bot.action("report_low_stock", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    try {
      const res = await pool.query(
        `SELECT p.name, COALESCE(s.quantity, 0) AS quantity
         FROM products p
         LEFT JOIN stock s ON s.product_id = p.id
         WHERE COALESCE(s.quantity,0) < 5
         ORDER BY quantity ASC`
      );

      if (res.rows.length === 0) {
        return replyOrEdit(
          ctx,
          "✅ Все товары имеют достаточный запас.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад", "menu_reports")],
          ])
        );
      }

      let message = "⚠️ *Товары с минимальными остатками (<5)*\n\n";
      res.rows.forEach((p) => {
        message += `• ${p.name} — ${p.quantity}\n`;
      });

      await replyOrEdit(ctx, message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "menu_reports")],
        ]),
      });
    } catch (err) {
      console.error("Ошибка report_low_stock:", err);
      await replyOrEdit(ctx, "Ошибка при формировании отчёта.");
    }
  });
};
