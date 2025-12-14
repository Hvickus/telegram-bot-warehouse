const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const PAGE_SIZE = 10;

/**
 * Формирует кнопки для текущей страницы
 */
function buildProductKeyboard(products, page, totalPages) {
  const buttons = products.map((p) => [
    Markup.button.callback(p.name, `product_${p.id}`),
  ]);

  const navigation = [];
  if (page > 1)
    navigation.push(
      Markup.button.callback("⬅️ Назад", `products_page_${page - 1}`)
    );
  if (page < totalPages)
    navigation.push(
      Markup.button.callback("➡️ Вперед", `products_page_${page + 1}`)
    );
  if (navigation.length) buttons.push(navigation);

  buttons.push([Markup.button.callback("🔙 Назад", "back_main")]);
  return Markup.inlineKeyboard(buttons);
}

module.exports = function (bot) {
  // Начало просмотра списка товаров
  bot.action("menu_products", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const res = await pool.query("SELECT id, name FROM products ORDER BY id");
    const products = res.rows;
    const totalPages = Math.ceil(products.length / PAGE_SIZE);
    const pageProducts = products.slice(0, PAGE_SIZE);

    await replyOrEdit(
      ctx,
      "📦 Список товаров:",
      buildProductKeyboard(pageProducts, 1, totalPages)
    );
  });

  // Навигация по страницам
  bot.action(/products_page_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const page = parseInt(ctx.match[1]);
    const res = await pool.query("SELECT id, name FROM products ORDER BY id");
    const products = res.rows;
    const totalPages = Math.ceil(products.length / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;
    const pageProducts = products.slice(start, start + PAGE_SIZE);

    await replyOrEdit(
      ctx,
      `📦 Список товаров (страница ${page}/${totalPages}):`,
      buildProductKeyboard(pageProducts, page, totalPages)
    );
  });
};
