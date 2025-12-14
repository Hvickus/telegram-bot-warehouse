const { Markup } = require("telegraf");
const pool = require("../../db");

// Количество товаров на страницу
const PAGE_SIZE = 10;

async function sendStockPage(ctx, offset = 0) {
  // Получаем общее количество товаров с остатком
  const countRes = await pool.query("SELECT COUNT(*) FROM stock");
  const total = parseInt(countRes.rows[0].count, 10);

  // Получаем товары с остатками
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

  // Формируем текст сообщения
  let text = "📊 *Текущие остатки на складе:*\n\n";
  res.rows.forEach((r, i) => {
    text += `${offset + i + 1}. ${r.name} — *${r.quantity}*\n`;
  });

  // Кнопки пагинации
  const buttons = [];
  if (offset > 0) {
    buttons.push(Markup.button.callback("⬅️ Назад", `stock_page_${offset - PAGE_SIZE}`));
  }
  if (offset + PAGE_SIZE < total) {
    buttons.push(Markup.button.callback("➡️ Вперёд", `stock_page_${offset + PAGE_SIZE}`));
  }

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: buttons.length ? Markup.inlineKeyboard([buttons]) : undefined,
  });
}

module.exports = function registerStock(bot) {
  // Основная кнопка для показа остатков
  bot.action("show_stock", async (ctx) => {
    await ctx.answerCbQuery();
    await sendStockPage(ctx, 0);
  });

  // Пагинация
  bot.action(/stock_page_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const offset = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, offset);
  });
};
