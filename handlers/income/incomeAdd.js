const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const productsMenu = require("../../menus/productsMenu");

module.exports = function (bot) {
  // Меню Приход товара
  bot.action("income_start", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    try {
      // Получаем список товаров для выбора
      const res = await pool.query(`SELECT id, name FROM products ORDER BY id`);

      if (res.rows.length === 0) {
        return replyOrEdit(
          ctx,
          "❗ Нет товаров для прихода. Сначала добавьте товар.",
          productsMenu()
        );
      }

      const buttons = res.rows.map((p) => [
        Markup.button.callback(p.name, `income_${p.id}`),
      ]);
      buttons.push([Markup.button.callback("🔙 Назад", "back_main")]);

      await replyOrEdit(
        ctx,
        "📥 Выберите товар для прихода:",
        Markup.inlineKeyboard(buttons)
      );
    } catch (err) {
      console.error("Ошибка income_start:", err);
      await replyOrEdit(ctx, "Ошибка при загрузке списка товаров.");
    }
  });

  // Выбор товара для прихода
  bot.action(/income_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "income_product";
    ctx.session.productId = productId;

    await replyOrEdit(ctx, "Введите количество прихода (целое число):");
  });

  // Ввод количества
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
      // Проверяем, есть ли запись в stock
      const stockRes = await pool.query(
        `SELECT quantity FROM stock WHERE product_id = $1`,
        [s.productId]
      );

      if (stockRes.rows.length === 0) {
        // Если нет записи, создаём новую
        await pool.query(
          `INSERT INTO stock (product_id, quantity) VALUES ($1, $2)`,
          [s.productId, qty]
        );
      } else {
        // Иначе увеличиваем существующий остаток
        await pool.query(
          `UPDATE stock SET quantity = quantity + $1 WHERE product_id = $2`,
          [qty, s.productId]
        );
      }

      await pool.query(
        `INSERT INTO income (product_id, quantity) VALUES ($1, $2)`,
        [s.productId, qty]
      );

      if (ctx.session) {
        delete ctx.session.flow;
        delete ctx.session.productId;
      }

      await ctx.reply(
        `✅ Остаток увеличен на ${qty} единиц.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "menu_income")],
          [Markup.button.callback("🏠 Главное меню", "back_main")],
        ])
      );
      return;
    } catch (err) {
      console.error("Ошибка прихода товара:", err);
      await ctx.reply("Ошибка при обновлении остатков.");
      return;
    }
  });
};
