const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

module.exports = function registerStockPagination(bot) {
  async function sendStockPage(ctx, page = 1) {
    await safeAnswerCbQuery(ctx);

    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Получаем общее количество товаров на складе
    const countRes = await pool.query("SELECT COUNT(*) AS total FROM stock");
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

    // Получаем товары для текущей страницы
    const res = await pool.query(
      `SELECT s.product_id, p.name, s.quantity
       FROM stock s
       JOIN products p ON p.id = s.product_id
       ORDER BY p.id
       LIMIT $1 OFFSET $2`,
      [ITEMS_PER_PAGE, offset]
    );

    // Формируем текст сообщения
    let message = `📊 *Текущие остатки на складе* (Страница ${page} из ${totalPages})\n\n`;
    res.rows.forEach((r, i) => {
      message += `${offset + i + 1}. ${r.name} — *${r.quantity}*\n`;
    });

    // Кнопки навигации
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

    // Кнопка "Назад в меню остатков"
    buttons.push([Markup.button.callback("🔙 Назад", "menu_stock")]);

    await replyOrEdit(
      ctx,
      message,
      Markup.inlineKeyboard(buttons, { columns: 1 })
    );
  }

  // Старт просмотра остатков
  bot.action("show_stock", async (ctx) => {
    await sendStockPage(ctx, 1);
  });

  // Пагинация
  bot.action(/stock_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, page);
  });
};
