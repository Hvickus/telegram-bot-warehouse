const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

module.exports = function registerOutcome(bot) {
  // Отправка страницы товаров для списания
  async function sendOutcomeProductPage(ctx, page = 1) {
    await safeAnswerCbQuery(ctx);

    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Общее количество товаров
    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM products`);
    const totalItems = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPages === 0) {
      return replyOrEdit(ctx, "❗ Нет товаров для списания.");
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
      Markup.button.callback(p.name, `outcome_${p.id}`),
    ]);

    // Кнопки навигации
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `outcome_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Вперед", `outcome_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);

    // Кнопка "Главное меню"
    buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

    const text = `📤 Выберите товар для списания:\nСтраница ${page} из ${totalPages}`;
    await replyOrEdit(ctx, text, Markup.inlineKeyboard(buttons));
  }

  // Старт списания товара
  bot.action("outcome_start", async (ctx) => {
    await sendOutcomeProductPage(ctx, 1);
  });

  // Пагинация
  bot.action(/outcome_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendOutcomeProductPage(ctx, page);
  });

  // Выбор конкретного товара
  bot.action(/outcome_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = parseInt(ctx.match[1], 10);
    ctx.session = ctx.session || {};
    ctx.session.flow = "outcome_product";
    ctx.session.productId = productId;

    await replyOrEdit(ctx, "Введите количество списания (целое число):");
  });

  // Ввод количества списания
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "outcome_product") return next();

    const qty = Number(ctx.message.text.trim());
    if (!Number.isInteger(qty) || qty <= 0) {
      return ctx.reply(
        "Количество должно быть положительным целым числом. Попробуйте снова:"
      );
    }

    try {
      // Получаем текущий остаток
      const stockRes = await pool.query(
        `SELECT quantity FROM stock WHERE product_id = $1`,
        [s.productId]
      );

      if (stockRes.rows.length === 0 || stockRes.rows[0].quantity === 0) {
        delete ctx.session.flow;
        delete ctx.session.productId;
        return ctx.reply("❗ На складе нет товара для списания.");
      }

      const currentQty = stockRes.rows[0].quantity;
      if (qty > currentQty) {
        return ctx.reply(
          `❗ Недостаточно товара на складе. Текущий остаток: ${currentQty}`
        );
      }

      // Обновляем остаток
      await pool.query(
        `UPDATE stock SET quantity = quantity - $1 WHERE product_id = $2`,
        [qty, s.productId]
      );
      await pool.query(
        `INSERT INTO outcome (product_id, quantity) VALUES ($1, $2)`,
        [s.productId, qty]
      );

      delete ctx.session.flow;
      delete ctx.session.productId;

      await ctx.reply(
        `✅ Списано ${qty} единиц. Текущий остаток обновлён.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "menu_outcome")],
          [Markup.button.callback("🏠 Главное меню", "back_main")],
        ])
      );
    } catch (err) {
      console.error("Ошибка списания товара:", err);
      await ctx.reply("Ошибка при обновлении остатков.");
    }
  });
};
