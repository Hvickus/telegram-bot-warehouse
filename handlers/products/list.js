const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

/**
 * Отправка страницы товаров с кнопками
 */
async function sendProductPage(ctx, page = 1) {
  await safeAnswerCbQuery(ctx);

  // Получаем общее количество товаров
  const countRes = await pool.query(`SELECT COUNT(*) AS total FROM products`);
  const totalItems = parseInt(countRes.rows[0].total, 10);
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Проверяем диапазон страниц
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  // Получаем товары для текущей страницы
  const offset = (page - 1) * ITEMS_PER_PAGE;
  const res = await pool.query(
    `SELECT id, name, category_id FROM products ORDER BY id LIMIT $1 OFFSET $2`,
    [ITEMS_PER_PAGE, offset]
  );

  // Формируем кнопки для товаров
  const buttons = res.rows.map((product) => [
    Markup.button.callback(product.name, `view_${product.id}`),
  ]);

  // Кнопки навигации
  const navButtons = [];
  if (page > 1)
    navButtons.push(
      Markup.button.callback("⬅️ Назад", `products_page_${page - 1}`)
    );
  if (page < totalPages)
    navButtons.push(
      Markup.button.callback("➡️ Вперед", `products_page_${page + 1}`)
    );
  if (navButtons.length > 0) buttons.push(navButtons);

  // Добавляем кнопку "Назад в меню" внизу
  buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

  // Текст сообщения
  const text = `📦 Меню товаров:\nСтраница ${page} из ${totalPages}`;

  // Отправляем или редактируем сообщение
  await replyOrEdit(ctx, text, Markup.inlineKeyboard(buttons));
}

/**
 * Регистрация хендлеров пагинации и просмотра товаров
 */
function registerProductPagination(bot) {
  // Стартовое отображение списка товаров
  bot.action("products_list", (ctx) => sendProductPage(ctx, 1));

  // Пагинация по страницам
  bot.action(/products_page_(\d+)/, (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    return sendProductPage(ctx, page);
  });

  // Просмотр конкретного товара
  bot.action(/view_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const id = parseInt(ctx.match[1], 10);
    const res = await pool.query(
      `SELECT p.id, p.name, c.name AS category
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (res.rowCount === 0) {
      return ctx.reply("❗ Товар не найден.");
    }

    const product = res.rows[0];
    const text = `📝 Информация о товаре:
ID: ${product.id}
Название: ${product.name}
Категория: ${product.category || "-"}`;

    await replyOrEdit(
      ctx,
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад к списку", "products_list")],
      ])
    );
  });
}

module.exports = registerProductPagination;
