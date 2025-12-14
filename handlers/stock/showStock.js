const { Markup } = require("telegraf");
const pool = require("../../db");

const PAGE_SIZE = 10;

async function sendStockPage(ctx, offset = 0) {
  const countRes = await pool.query("SELECT COUNT(*) FROM stock");
  const total = parseInt(countRes.rows[0].count, 10);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

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

  let text = `📊 *Текущие остатки на складе* (Страница ${currentPage} из ${totalPages}):\n\n`;
  res.rows.forEach((r, i) => {
    text += `${offset + i + 1}. ${r.name} — *${r.quantity}*\n`;
  });

  // Формируем кнопки только если это не первая или не последняя страница
  const buttons = [];
  if (currentPage > 1) {
    buttons.push(
      Markup.button.callback("⬅️ Назад", `stock_page_${offset - PAGE_SIZE}`)
    );
  }
  if (currentPage < totalPages) {
    buttons.push(
      Markup.button.callback("➡️ Вперёд", `stock_page_${offset + PAGE_SIZE}`)
    );
  }

  const keyboard = buttons.length ? [buttons] : [];

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: keyboard.length ? Markup.inlineKeyboard(keyboard) : undefined,
  });
}

module.exports = function registerStock(bot) {
  // Основная кнопка "Показать остатки"
  bot.action("show_stock", async (ctx) => {
    await ctx.answerCbQuery();
    await sendStockPage(ctx, 0);
  });

  // Навигация между страницами
  bot.action(/stock_page_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, offset);
  });
};
