const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

module.exports = function registerStockPagination(bot) {
  async function sendStockPage(ctx, page = 1) {
    await safeAnswerCbQuery(ctx);

    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Общее количество товаров в представлении
    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM vw_stock`);
    const totalItems = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalItems === 0) {
      return replyOrEdit(
        ctx,
        "📦 На складе нет товаров.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "menu_stock")],
        ])
      );
    }

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    // Данные из представления
    const res = await pool.query(
      `SELECT product_name AS name, quantity
       FROM vw_stock
       ORDER BY product_id
       LIMIT $1 OFFSET $2`,
      [ITEMS_PER_PAGE, offset]
    );

    let message = `📊 *Текущие остатки на складе* (Страница ${page} из ${totalPages})\n\n`;
    res.rows.forEach((r, i) => {
      message += `${offset + i + 1}. ${r.name} — *${r.quantity}*\n`;
    });

    const buttons = [];
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `stock_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Вперед", `stock_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);

    buttons.push([Markup.button.callback("🔙 Назад", "menu_stock")]);

    await replyOrEdit(
      ctx,
      message,
      Markup.inlineKeyboard(buttons, { columns: 1 })
    );
  }

  bot.action("show_stock", async (ctx) => {
    await sendStockPage(ctx, 1);
  });

  bot.action(/stock_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, page);
  });
};
