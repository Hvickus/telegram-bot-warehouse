const { Markup } = require("telegraf");
const pool = require("../../db");

const PAGE_SIZE = 10;

module.exports = function registerStockPagination(bot) {
  async function sendStockPage(ctx, page = 1) {
    const offset = (page - 1) * PAGE_SIZE;

    // Общее количество товаров
    const countRes = await pool.query("SELECT COUNT(*) FROM stock");
    const total = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Товары для текущей страницы
    const res = await pool.query(
      `SELECT s.product_id, p.name, s.quantity
       FROM stock s
       JOIN products p ON p.id = s.product_id
       ORDER BY p.id
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset]
    );

    if (!res.rows.length) {
      return ctx.reply("На складе нет товаров.");
    }

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
    if (navButtons.length > 0) buttons.push(navButtons);

    buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);
    const keyboard = Markup.inlineKeyboard(buttons);

    // Если уже есть message_id в сессии — редактируем его
    if (ctx.session && ctx.session.lastStockMessageId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.session.lastStockMessageId,
        undefined,
        text,
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    } else {
      // Создаём сообщение и сохраняем message_id
      const sentMsg = await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      ctx.session = ctx.session || {};
      ctx.session.lastStockMessageId = sentMsg.message_id;
    }
  }

  // Показать остатки
  bot.action("show_stock", async (ctx) => {
    await ctx.answerCbQuery();
    await sendStockPage(ctx, 1);
  });

  // Навигация
  bot.action(/stock_page_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, page);
  });
};
