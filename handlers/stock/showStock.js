const pool = require("../../db");
const { Markup } = require("telegraf");

const PAGE_SIZE = 10; // показывать по 10 товаров на странице

// Функция для отображения страницы остатков
async function sendStockPage(ctx, page = 0) {
  try {
    const offset = page * PAGE_SIZE;

    // Общее количество товаров
    const countRes = await pool.query("SELECT COUNT(*) FROM products");
    const totalProducts = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalProducts / PAGE_SIZE);

    // Получаем товары с текущими остатками
    const res = await pool.query(
      `
      SELECT p.id, p.name, c.name AS category, COALESCE(s.quantity, 0) AS current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock s ON s.product_id = p.id
      ORDER BY p.id
      LIMIT $1 OFFSET $2
      `,
      [PAGE_SIZE, offset]
    );

    if (!res.rows.length) {
      return ctx.reply("📦 Нет товаров для отображения");
    }

    const buttons = res.rows.map((product) => [
      Markup.button.callback(
        `${product.name} — ${product.current_stock}`,
        `stock_view_${product.id}`
      ),
    ]);

    // Навигационные кнопки
    const navButtons = [];
    if (page > 0)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `stock_page_${page - 1}`)
      );
    if (page < totalPages - 1)
      navButtons.push(
        Markup.button.callback("➡️ Вперед", `stock_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);

    buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

    await ctx.reply(
      `📦 *Остатки товаров*\n\nСтраница ${page + 1} из ${totalPages}`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      }
    );
  } catch (err) {
    console.error("Ошибка при показе остатков:", err);
    await ctx.reply("❌ Произошла ошибка при загрузке остатков");
  }
}

// Функция для отображения карточки товара
async function sendStockCard(ctx, productId) {
  try {
    const res = await pool.query(
      `
      SELECT p.id, p.name, c.name AS category, COALESCE(s.quantity, 0) AS current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock s ON s.product_id = p.id
      WHERE p.id = $1
      `,
      [productId]
    );

    if (!res.rows.length) return ctx.reply("❌ Товар не найден");

    const product = res.rows[0];
    const text = `📦 *${product.name}*\n\nКатегория: ${
      product.category || "-"
    }\nТекущий остаток: ${product.current_stock}`;

    await ctx.reply(text, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад к списку", "show_stock")],
      ]),
    });
  } catch (err) {
    console.error("Ошибка при показе карточки товара:", err);
    await ctx.reply("❌ Произошла ошибка при загрузке информации о товаре");
  }
}

module.exports = function (bot) {
  // Отображение списка остатков (первая страница)
  bot.action("show_stock", async (ctx) => sendStockPage(ctx, 0));

  // Навигация по страницам
  bot.action(/stock_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendStockPage(ctx, page);
  });

  // Просмотр карточки товара
  bot.action(/stock_view_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    await sendStockCard(ctx, productId);
  });
};
