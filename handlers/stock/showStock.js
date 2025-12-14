const { Markup } = require("telegraf");
const pool = require("../../db");

const PAGE_SIZE = 10;

module.exports = function registerStockPagination(bot) {
  // Функция отправки страницы остатков
  async function sendStockPage(ctx, offset = 0) {
    // Получаем общее количество товаров на складе
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
      const msg = "На складе нет товаров.";
      if (ctx.updateType === "callback_query") return ctx.editMessageText(msg);
      return ctx.reply(msg);
    }

    // Формируем текст сообщения
    let text = `📊 *Текущие остатки на складе* (Страница ${currentPage} из ${totalPages}):\n\n`;
    res.rows.forEach((r, i) => {
      text += `${offset + i + 1}. ${r.name} — *${r.quantity}*\n`;
    });

    // Навигационные кнопки
    const navButtons = [];
    if (currentPage > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `stock_page_${offset - PAGE_SIZE}`)
      );
    if (currentPage < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Вперёд", `stock_page_${offset + PAGE_SIZE}`)
      );

    // Оборачиваем navButtons в массив массивов для корректного отображения
    const keyboard = navButtons.length
      ? Markup.inlineKeyboard([navButtons])
      : undefined;

    // Отправка или редактирование сообщения
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

  // Обработка навигации между страницами
  bot.action(/stock_page_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, offset);
  });
};
