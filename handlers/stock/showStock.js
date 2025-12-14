const { Markup } = require("telegraf");
const pool = require("../../db");

const PAGE_SIZE = 10;

module.exports = function registerStockPagination(bot) {
  async function sendStockPage(ctx, offset = 0) {
    // Получаем общее количество товаров
    const countRes = await pool.query("SELECT COUNT(*) FROM stock");
    const total = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

    // Получаем товары для текущей страницы
    const res = await pool.query(
      `SELECT s.product_id, p.name, s.quantity
       FROM stock s
       JOIN products p ON p.id = s.product_id
       ORDER BY p.id
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset]
    );

    if (!res.rows.length) {
      return ctx.editMessageText("На складе нет товаров.");
    }

    // Формируем текст сообщения
    let text = `📊 *Текущие остатки на складе* (Страница ${currentPage} из ${totalPages}):\n\n`;
    res.rows.forEach((r, i) => {
      text += `${offset + i + 1}. ${r.name} — *${r.quantity}*\n`;
    });

    // Формируем кнопки навигации
    const buttons = [];
    if (currentPage > 1)
      buttons.push(
        Markup.button.callback("⬅️ Назад", `stock_page_${offset - PAGE_SIZE}`)
      );
    if (currentPage < totalPages)
      buttons.push(
        Markup.button.callback("➡️ Вперёд", `stock_page_${offset + PAGE_SIZE}`)
      );

    const keyboard = buttons.length
      ? Markup.inlineKeyboard([buttons])
      : undefined;

    // Редактируем сообщение, если это callback_query, иначе отправляем новое
    if (ctx.updateType === "callback_query") {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
    }
  }

  // Кнопка "Показать остатки"
  bot.action("show_stock", async (ctx) => {
    await ctx.answerCbQuery();
    await sendStockPage(ctx, 0);
  });

  // Навигация по страницам
  bot.action(/stock_page_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, offset);
  });
};
