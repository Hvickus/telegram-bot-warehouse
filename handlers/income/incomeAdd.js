const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

module.exports = function registerIncome(bot) {
  // Отправка страницы товаров для прихода
  async function sendIncomeProductPage(ctx, page = 1) {
    await safeAnswerCbQuery(ctx);

    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Получаем общее количество товаров
    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM products`);
    const totalItems = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPages === 0) {
      return replyOrEdit(ctx, "❗ Нет товаров для прихода.");
    }

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    // Получаем товары для текущей страницы
    const res = await pool.query(
      `SELECT id, name FROM products ORDER BY id LIMIT $1 OFFSET $2`,
      [ITEMS_PER_PAGE, offset]
    );

    // Кнопки товаров
    const buttons = res.rows.map((p) => [
      Markup.button.callback(p.name, `income_${p.id}`),
    ]);

    // Кнопки навигации
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `income_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Вперед", `income_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);

    // Кнопка "Назад"
    buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

    const text = `📥 Выберите товар для прихода:\nСтраница ${page} из ${totalPages}`;
    await replyOrEdit(ctx, text, Markup.inlineKeyboard(buttons));
  }

  // Старт выбора товара
  bot.action("income_start", async (ctx) => {
    await sendIncomeProductPage(ctx, 1);
  });

  // Пагинация
  bot.action(/income_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendIncomeProductPage(ctx, page);
  });

  // Выбор конкретного товара
  bot.action(/income_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const productId = parseInt(ctx.match[1], 10);
    ctx.session = ctx.session || {};
    ctx.session.flow = "income_product";
    ctx.session.productId = productId;

    await replyOrEdit(ctx, "Введите количество прихода (целое число):");
  });

  // Ввод количества прихода
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "income_product") return next();

    const qty = Number(ctx.message.text.trim());
    if (!Number.isInteger(qty) || qty <= 0) {
      return ctx.reply(
        "Количество должно быть положительным целым числом. Попробуйте снова:"
      );
    }

    try {
      const stockRes = await pool.query(
        `SELECT quantity FROM stock WHERE product_id = $1`,
        [s.productId]
      );

      if (stockRes.rows.length === 0) {
        await pool.query(
          `INSERT INTO stock (product_id, quantity) VALUES ($1, $2)`,
          [s.productId, qty]
        );
      } else {
        await pool.query(
          `UPDATE stock SET quantity = quantity + $1 WHERE product_id = $2`,
          [qty, s.productId]
        );
      }

      await pool.query(
        `INSERT INTO income (product_id, quantity) VALUES ($1, $2)`,
        [s.productId, qty]
      );

      delete ctx.session.flow;
      delete ctx.session.productId;

      await ctx.reply(
        `✅ Остаток увеличен на ${qty} единиц.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "menu_income")],
          [Markup.button.callback("🏠 Главное меню", "back_main")],
        ])
      );
    } catch (err) {
      console.error("Ошибка прихода товара:", err);
      await ctx.reply("Ошибка при обновлении остатков.");
    }
  });
};
