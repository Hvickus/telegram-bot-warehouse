const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const productsMenu = require("../../menus/productsMenu");

module.exports = function (bot) {
  // Меню Списание товара
  bot.action("outcome_start", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    try {
      // Получаем список товаров для списания
      const res = await pool.query(`SELECT id, name FROM products ORDER BY id`);

      if (res.rows.length === 0) {
        return replyOrEdit(
          ctx,
          "❗ Нет товаров для списания. Сначала добавьте товар.",
          productsMenu()
        );
      }

      const buttons = res.rows.map((p) => [
        Markup.button.callback(p.name, `outcome_${p.id}`),
      ]);
      buttons.push([Markup.button.callback("🔙 Назад", "back_main")]);

      await replyOrEdit(
        ctx,
        "📤 Выберите товар для списания:",
        Markup.inlineKeyboard(buttons)
      );
    } catch (err) {
      console.error("Ошибка outcome_start:", err);
      await replyOrEdit(ctx, "Ошибка при загрузке списка товаров.");
    }
  });

  // Выбор товара для списания
  bot.action(/outcome_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
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
        if (ctx.session) {
          delete ctx.session.flow;
          delete ctx.session.productId;
        }
        await ctx.reply("❗ На складе нет товара для списания.");
        return;
      }

      const currentQty = stockRes.rows[0].quantity;

      if (qty > currentQty) {
        await ctx.reply(
          `❗ Недостаточно товара на складе. Текущий остаток: ${currentQty}`
        );
        return;
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

      if (ctx.session) {
        delete ctx.session.flow;
        delete ctx.session.productId;
      }

      await ctx.reply(
        `✅ Списано ${qty} единиц. Текущий остаток обновлён.`,
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "menu_outcome")],
          [Markup.button.callback("🏠 Главное меню", "back_main")],
        ])
      );
      return;
    } catch (err) {
      console.error("Ошибка списания товара:", err);
      await ctx.reply("Ошибка при обновлении остатков.");
      return;
    }
  });
};
