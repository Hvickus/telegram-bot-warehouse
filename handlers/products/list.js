const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");

const pageSize = 10; // количество товаров на страницу

/**
 * Отправка страницы товаров
 */
async function sendProductPage(ctx, page = 0) {
  const offset = page * pageSize;

  // Получаем товары на текущей странице
  const { rows } = await pool.query(
    `SELECT p.id, p.name, c.name AS category
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     ORDER BY p.id
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  // Получаем общее количество товаров для расчета навигации
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM products`
  );
  const totalCount = parseInt(countRows[0].total, 10);
  const totalPages = Math.ceil(totalCount / pageSize);

  if (rows.length === 0) {
    return ctx.reply("❌ Товары не найдены.");
  }

  // Кнопки товаров
  const buttons = rows.map((product) => [
    Markup.button.callback(product.name, `product_view_${product.id}`),
  ]);

  // Кнопки навигации
  const navButtons = [];
  if (page > 0)
    navButtons.push(
      Markup.button.callback("⬅️ Назад", `products_page_${page - 1}`)
    );
  if (page < totalPages - 1)
    navButtons.push(
      Markup.button.callback("➡️ Вперед", `products_page_${page + 1}`)
    );
  if (navButtons.length > 0) buttons.push(navButtons);

  const text = `📦 *Меню товаров:*\nСтраница ${page + 1} из ${totalPages}`;

  await replyOrEdit(ctx, text, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(buttons),
  });
}

/**
 * Регистрация обработчиков для пагинации и просмотра товаров
 */
function registerProductPagination(bot) {
  // Начало просмотра списка
  bot.action("products_list", async (ctx) => {
    await sendProductPage(ctx, 0);
  });

  // Пагинация
  bot.action(/products_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendProductPage(ctx, page);
  });

  // Просмотр конкретного товара
  bot.action(/product_view_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const { rows } = await pool.query(
      `SELECT p.id, p.name, c.name AS category
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [productId]
    );

    if (rows.length === 0) {
      return ctx.answerCbQuery("❌ Товар не найден", { show_alert: true });
    }

    const product = rows[0];
    const text = `*ID:* ${product.id}\n*Название:* ${
      product.name
    }\n*Категория:* ${product.category || "-"}`;

    await ctx.editMessageText(text, { parse_mode: "Markdown" });
  });
}

module.exports = registerProductPagination;
