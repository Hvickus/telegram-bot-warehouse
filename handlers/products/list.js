const { Markup } = require("telegraf");
const pool = require("../../db");

const ITEMS_PER_PAGE = 10;

async function showProducts(ctx, page = 1) {
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const res = await pool.query(
    `SELECT id, name, category_id FROM products ORDER BY id LIMIT $1 OFFSET $2`,
    [ITEMS_PER_PAGE, offset]
  );

  if (res.rows.length === 0) {
    return ctx.reply("Товары отсутствуют на этой странице.");
  }

  // Формируем текст списка
  let text = res.rows.map((r, i) => `${offset + i + 1}. ${r.name}`).join("\n");

  // Кнопки навигации
  const buttons = [];

  if (page > 1)
    buttons.push(
      Markup.button.callback("⬅️ Назад", `products_page_${page - 1}`)
    );

  // Проверяем, есть ли ещё товары
  const countRes = await pool.query(`SELECT COUNT(*) FROM products`);
  const totalPages = Math.ceil(countRes.rows[0].count / ITEMS_PER_PAGE);

  if (page < totalPages)
    buttons.push(
      Markup.button.callback("➡️ Вперёд", `products_page_${page + 1}`)
    );

  // Добавляем возврат в меню
  buttons.push(Markup.button.callback("🔙 Назад в меню", "back_main"));

  const keyboard = Markup.inlineKeyboard(buttons.map((b) => [b]));

  await ctx.reply(text, keyboard);
}

// Обработчик кнопок постраничной навигации
function registerProductPagination(bot) {
  bot.action(/products_page_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = parseInt(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.productsPage = page;

    // Можно удалить предыдущее сообщение с товарами, чтобы не дублировалось
    try {
      await ctx.deleteMessage();
    } catch (err) {
      // Игнорируем, если сообщение удалить нельзя
    }

    await showProducts(ctx, page);
  });
}

module.exports = { showProducts, registerProductPagination };
