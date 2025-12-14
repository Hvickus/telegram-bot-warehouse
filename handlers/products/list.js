const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const pageSize = 10; // показываем по 10 товаров

async function sendProductPage(ctx, page = 0) {
  const offset = page * pageSize;

  const { rows, rowCount } = await pool.query(
    `SELECT p.id, p.name, c.name AS category
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     ORDER BY p.id
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  if (rows.length === 0) {
    return ctx.reply("❌ Товары не найдены.");
  }

  const buttons = rows.map((product) => [
    Markup.button.callback(product.name, `product_view_${product.id}`),
  ]);

  // Добавляем кнопки навигации
  const navButtons = [];
  if (page > 0)
    navButtons.push(
      Markup.button.callback("⬅️ Назад", `products_page_${page - 1}`)
    );
  if (offset + rows.length < rowCount)
    navButtons.push(
      Markup.button.callback("➡️ Вперед", `products_page_${page + 1}`)
    );

  if (navButtons.length > 0) buttons.push(navButtons);

  const text = "📦 *Меню товаров:*";

  await replyOrEdit(ctx, text, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(buttons),
  });
}

module.exports = function (bot) {
  bot.action("products_list", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await sendProductPage(ctx, 0);
  });

  bot.action(/products_page_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const page = parseInt(ctx.match[1], 10);
    await sendProductPage(ctx, page);
  });
};
