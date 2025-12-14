const { Markup } = require("telegraf");
const pool = require("../../db");

const ITEMS_PER_PAGE = 10;

module.exports = function registerStockPagination(bot) {
  async function sendStockPage(ctx, page = 1) {
    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Общее количество товаров на складе
    const countRes = await pool.query("SELECT COUNT(*) AS total FROM stock");
    const totalItems = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPages === 0) return ctx.reply("❗ На складе нет товаров.");

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

    // Формируем текст
    let text = `📊 *Текущие остатки на складе* (Страница ${page} из ${totalPages}):\n\n`;
    res.rows.forEach((r, i) => {
      text += `${offset + i + 1}. ${r.name} — *${r.quantity}*\n`;
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

    // Кнопка "Главное меню"
    buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

    const keyboard = Markup.inlineKeyboard(buttons);

    // Редактируем сообщение, если оно уже есть, иначе отправляем новое
    if (
      ctx.session?.lastStockMessageId &&
      ctx.updateType === "callback_query"
    ) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.session.lastStockMessageId,
        undefined,
        text,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    } else {
      const sent = await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      ctx.session = ctx.session || {};
      ctx.session.lastStockMessageId = sent.message_id;
    }
  }

  // Показать остатки
  bot.action("show_stock", async (ctx) => {
    await ctx.answerCbQuery();
    await sendStockPage(ctx, 1);
  });

  // Навигация по страницам
  bot.action(/stock_page_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, page);
  });
};
