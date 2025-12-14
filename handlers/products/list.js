const { Markup } = require("telegraf");
const pool = require("../../db");

// Показываем товары постранично
async function showProducts(ctx, page = 1) {
  const limit = 10;
  const offset = (page - 1) * limit;

  const res = await pool.query(
    "SELECT id, name, category_id FROM products ORDER BY id LIMIT $1 OFFSET $2",
    [limit, offset]
  );

  if (res.rows.length === 0) {
    return ctx.reply("📦 Товары не найдены.");
  }

  const buttons = res.rows.map((p) => [
    Markup.button.callback(`${p.id}. ${p.name}`, `view_product_${p.id}`),
  ]);

  // Кнопки навигации
  buttons.push([
    Markup.button.callback("⬅️ Назад", `products_prev_${page - 1}`),
    Markup.button.callback("➡️ Далее", `products_next_${page + 1}`),
  ]);

  await ctx.reply("📦 Список товаров:", Markup.inlineKeyboard(buttons));
}

// Обработчик пагинации
function registerProductPagination(bot) {
  bot.action(/products_(prev|next)_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[2]);
    if (page < 1) return ctx.answerCbQuery("Это первая страница.");
    ctx.session.productsPage = page;
    await showProducts(ctx, page);
    await ctx.answerCbQuery();
  });
}

module.exports = { showProducts, registerProductPagination };
