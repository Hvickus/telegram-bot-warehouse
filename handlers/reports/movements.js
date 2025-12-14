const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

module.exports = function registerMovementsReport(bot) {
  async function sendMovementsPage(ctx, page = 1) {
    await safeAnswerCbQuery(ctx);

    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Получаем общее количество товаров в представлении
    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM vw_movements`
    );
    const totalItems = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalItems === 0) {
      return replyOrEdit(
        ctx,
        "📊 Нет товаров для отчёта движения.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "menu_reports")],
        ])
      );
    }

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    // Получаем данные из представления
    const res = await pool.query(
      `SELECT product_name, total_income AS income, total_outcome AS outcome
       FROM vw_movements
       ORDER BY product_name
       LIMIT $1 OFFSET $2`,
      [ITEMS_PER_PAGE, offset]
    );

    let message = `📊 *Движение товаров за последние 7 дней* (Страница ${page} из ${totalPages})\n\n`;
    res.rows.forEach((p, i) => {
      message += `${offset + i + 1}. ${p.product_name}: +${p.income} / -${
        p.outcome
      }\n`;
    });

    const buttons = [];
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `movements_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Вперед", `movements_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);

    buttons.push([Markup.button.callback("🔙 Назад", "menu_reports")]);

    await replyOrEdit(
      ctx,
      message,
      Markup.inlineKeyboard(buttons, { columns: 1 })
    );
  }

  bot.action("report_movements", async (ctx) => {
    await sendMovementsPage(ctx, 1);
  });

  bot.action(/movements_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendMovementsPage(ctx, page);
  });
};
