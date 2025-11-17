const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  bot.action("report_movements", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    try {
      const res = await pool.query(`
        SELECT p.name, 
               COALESCE(SUM(i.quantity),0) AS income,
               COALESCE(SUM(o.quantity),0) AS outcome
        FROM products p
        LEFT JOIN income i ON i.product_id = p.id AND i.date >= NOW() - INTERVAL '7 days'
        LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= NOW() - INTERVAL '7 days'
        GROUP BY p.name
        ORDER BY p.name
      `);

      if (res.rows.length === 0) {
        return replyOrEdit(
          ctx,
          "📊 Движения за период не зафиксировано.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад", "menu_reports")],
          ])
        );
      }

      let message = "📊 *Движение товаров за последние 7 дней*\n\n";
      res.rows.forEach((p) => {
        message += `• ${p.name}: +${p.income} / -${p.outcome}\n`;
      });

      await replyOrEdit(ctx, message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "menu_reports")],
        ]),
      });
    } catch (err) {
      console.error("Ошибка report_movements:", err);
      await replyOrEdit(ctx, "Ошибка при формировании отчёта.");
    }
  });
};
