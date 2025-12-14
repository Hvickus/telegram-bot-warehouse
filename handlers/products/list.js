const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const PAGE_SIZE = 10;

module.exports = function (bot) {
  /**
   * Функция для формирования клавиатуры с товарами и навигацией
   */
  async function sendProductPage(ctx, page = 0) {
    await safeAnswerCbQuery(ctx);

    // Получаем общее количество товаров
    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) AS count FROM products"
    );
    const total = parseInt(countRows[0].count, 10);

    // Получаем товары для текущей страницы
    const offset = page * PAGE_SIZE;
    const { rows } = await pool.query(
      "SELECT id, name, description FROM products ORDER BY id LIMIT $1 OFFSET $2",
      [PAGE_SIZE, offset]
    );

    if (rows.length === 0) {
      return ctx.reply("Товары не найдены на этой странице.");
    }

    const buttons = rows.map((p) => [
      Markup.button.callback(p.name, `product_view_${p.id}`),
    ]);

    // Кнопки навигации
    const navButtons = [];
    if (page > 0)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `product_page_${page - 1}`)
      );
    if (offset + PAGE_SIZE < total)
      navButtons.push(
        Markup.button.callback("➡️ Вперёд", `product_page_${page + 1}`)
      );

    if (navButtons.length) buttons.push(navButtons);

    await replyOrEdit(ctx, "📦 Список товаров:", {
      reply_markup: Markup.inlineKeyboard(buttons),
    });
  }

  // Начало просмотра списка
  bot.action("products_list", async (ctx) => {
    await sendProductPage(ctx, 0);
  });

  // Постраничная навигация
  bot.action(/product_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendProductPage(ctx, page);
  });
};
