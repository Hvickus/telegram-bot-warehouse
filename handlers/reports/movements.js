const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

module.exports = function registerMovementsReport(bot) {
  // Отправка страницы отчета движения товаров
  async function sendMovementsPage(ctx, page = 1) {
    await safeAnswerCbQuery(ctx);

    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Получаем общее количество товаров с движением
    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM products`);
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

    // Получаем товары и их движение за последние 7 дней
    const res = await pool.query(
      `
      SELECT p.name, 
             COALESCE(SUM(i.quantity),0) AS income,
             COALESCE(SUM(o.quantity),0) AS outcome
      FROM products p
      LEFT JOIN income i ON i.product_id = p.id AND i.date >= NOW() - INTERVAL '7 days'
      LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= NOW() - INTERVAL '7 days'
      GROUP BY p.id
      ORDER BY p.name
      LIMIT $1 OFFSET $2
      `,
      [ITEMS_PER_PAGE, offset]
    );

    // Формируем текст сообщения
    let message = `📊 *Движение товаров за последние 7 дней* (Страница ${page} из ${totalPages})\n\n`;
    res.rows.forEach((p, i) => {
      message += `${offset + i + 1}. ${p.name}: +${p.income} / -${p.outcome}\n`;
    });

    // Кнопки навигации
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

    // Кнопка "Назад"
    buttons.push([Markup.button.callback("🔙 Назад", "menu_reports")]);

    await replyOrEdit(
      ctx,
      message,
      Markup.inlineKeyboard(buttons, { columns: 1 })
    );
  }

  // Старт отчета движения
  bot.action("report_movements", async (ctx) => {
    await sendMovementsPage(ctx, 1);
  });

  // Пагинация
  bot.action(/movements_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendMovementsPage(ctx, page);
  });
};
