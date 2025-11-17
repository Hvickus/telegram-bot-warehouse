const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

function resetEditSession(session) {
  if (!session) return;
  delete session.flow;
  delete session.productId;
}

module.exports = function (bot) {
  // Открываем меню редактирования товара
  bot.action(/prod_(.+)_edit/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "edit_product";
    ctx.session.productId = productId;

    try {
      const res = await pool.query(
        `SELECT p.id, p.name, c.name AS category, COALESCE(s.quantity, 0) AS quantity
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN stock s ON s.product_id = p.id
         WHERE p.id = $1`,
        [productId]
      );

      if (res.rows.length === 0) return ctx.reply("❗ Товар не найден.");

      const p = res.rows[0];

      await replyOrEdit(
        ctx,
        `✏ *Редактирование товара*\n\n` +
          `ID: ${p.id}\n` +
          `Название: ${p.name}\n` +
          `Категория: ${p.category || "—"}\n` +
          `Количество: ${p.quantity}`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("✏ Изменить название", `editname_${p.id}`)],
            [Markup.button.callback("🏷 Изменить категорию", `editcat_${p.id}`)],
            [
              Markup.button.callback(
                "📦 Изменить количество",
                `editqty_${p.id}`
              ),
            ],
            [Markup.button.callback("🔙 Назад", "products_list")],
          ]),
        }
      );
    } catch (err) {
      console.error("Ошибка prod_X_edit:", err);
      ctx.reply("Ошибка при загрузке товара.");
    }
  });

  // Редактирование названия
  bot.action(/editname_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "edit_product_name";
    ctx.session.productId = productId;

    await replyOrEdit(ctx, "Введите новое название товара:");
  });

  // Редактирование количества
  bot.action(/editqty_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "edit_product_quantity";
    ctx.session.productId = productId;

    await replyOrEdit(ctx, "Введите новое количество товара:");
  });

  // Редактирование категории
  bot.action(/editcat_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "edit_product_category";
    ctx.session.productId = productId;

    try {
      const res = await pool.query(
        "SELECT id, name FROM categories ORDER BY id"
      );
      if (res.rows.length === 0) return ctx.reply("Нет доступных категорий.");

      const buttons = res.rows.map((c) => [
        Markup.button.callback(c.name, `setcat_${productId}_${c.id}`),
      ]);
      buttons.push([
        Markup.button.callback("❌ Отмена", `prod_${productId}_edit`),
      ]);

      await replyOrEdit(
        ctx,
        "Выберите новую категорию:",
        Markup.inlineKeyboard(buttons)
      );
    } catch (err) {
      console.error("Ошибка категорий:", err);
      await replyOrEdit(ctx, "Ошибка при загрузке категорий.");
    }
  });

  // Применение новой категории
  bot.action(/setcat_(.+)_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
    const categoryId = Number(ctx.match[2]);

    try {
      await pool.query("UPDATE products SET category_id = $1 WHERE id = $2", [
        categoryId,
        productId,
      ]);

      resetEditSession(ctx.session);
      await replyOrEdit(
        ctx,
        "🏷 Категория успешно изменена!",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад к товарам", "products_list")],
        ])
      );
    } catch (err) {
      console.error("Ошибка установки категории:", err);
      await replyOrEdit(ctx, "Ошибка при изменении категории.");
    }
  });

  // Обработка текста для изменения имени и количества
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s) return next();

    // Изменение названия
    if (s.flow === "edit_product_name") {
      const newName = ctx.message.text.trim();
      if (!newName) return ctx.reply("Название не может быть пустым.");

      try {
        await pool.query("UPDATE products SET name=$1 WHERE id=$2", [
          newName,
          s.productId,
        ]);
        resetEditSession(ctx.session);

        return ctx.reply(`✅ Название обновлено: *${newName}*`, {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад к товарам", "products_list")],
          ]),
        });
      } catch (err) {
        console.error("Ошибка изменения имени:", err);
        return ctx.reply("Ошибка при изменении названия.");
      }
    }

    // Изменение количества
    if (s.flow === "edit_product_quantity") {
      const qty = Number(ctx.message.text.trim());
      if (!Number.isInteger(qty) || qty < 0)
        return ctx.reply(
          "Количество должно быть целым неотрицательным числом."
        );

      try {
        await pool.query("UPDATE stock SET quantity=$1 WHERE product_id=$2", [
          qty,
          s.productId,
        ]);
        resetEditSession(ctx.session);

        return ctx.reply(`📦 Количество обновлено: *${qty}*`, {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад к товарам", "products_list")],
          ]),
        });
      } catch (err) {
        console.error("Ошибка изменения количества:", err);
        await ctx.reply("Ошибка при изменении количества.");
        return;
      }
    }

    return next();
  });
};
