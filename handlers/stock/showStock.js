const { Markup } = require("telegraf");
const pool = require("../../db");

const PAGE_SIZE = 10;

module.exports = function registerStock(bot) {
  async function sendPage(ctx, page) {
    const offset = (page - 1) * PAGE_SIZE;

    const countRes = await pool.query("SELECT COUNT(*) FROM stock");
    const total = Number(countRes.rows[0].count);
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const res = await pool.query(
      `SELECT p.id, p.name, s.quantity
       FROM stock s
       JOIN products p ON p.id = s.product_id
       ORDER BY p.id
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset]
    );

    let text = `📦 *Остатки на складе* (Страница ${page} из ${totalPages})\n\n`;
    res.rows.forEach((r, i) => {
      text += `${offset + i + 1}. ${r.name} — *${r.quantity}*\n`;
    });

    const buttons = [];

    if (page > 1) {
      buttons.push(Markup.button.callback("⬅️ Назад", `stock_${page - 1}`));
    }

    if (page < totalPages) {
      buttons.push(Markup.button.callback("➡️ Вперёд", `stock_${page + 1}`));
    }

    buttons.push(Markup.button.callback("🔙 Главное меню", "back_main"));

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard(buttons, { columns: 2 }),
    });
  }

  bot.action("show_stock", async (ctx) => {
    await ctx.answerCbQuery();
    await sendPage(ctx, 1);
  });

  bot.action(/stock_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendPage(ctx, Number(ctx.match[1]));
  });
};
