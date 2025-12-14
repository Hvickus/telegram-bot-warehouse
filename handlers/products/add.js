const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

function resetAddSession(session) {
  if (!session) return;
  delete session.flow;
  delete session.step;
  delete session.name;
  delete session.category_id;
}

module.exports = function (bot) {
  // Запуск добавления товара
  bot.action("products_add", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    ctx.session = ctx.session || {};
    ctx.session.flow = "add_product";
    ctx.session.step = "await_name";
    delete ctx.session.name;
    delete ctx.session.category_id;

    await replyOrEdit(ctx, "➕ Введите название нового товара:");
  });

  // Обработчик текста для добавления
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "add_product") return next();

    // 1. Ввод названия
    if (s.step === "await_name") {
      const name = ctx.message.text.trim();
      if (!name) return ctx.reply("Название не может быть пустым.");
      s.name = name;

      // Загружаем категории
      try {
        const countRes = await pool.query(
          `SELECT COUNT(*) AS total FROM categories`
        );
        const totalCategories = parseInt(countRes.rows[0].total, 10);

        if (totalCategories === 0) {
          s.step = "await_category_manual";
          return ctx.reply("Категорий нет. Введите ID категории вручную:");
        }

        s.step = "await_category";
        s.categoryPage = 1;

        await sendCategoryPage(ctx, s.categoryPage);
      } catch (err) {
        console.error("Ошибка категорий:", err);
        return ctx.reply("Ошибка при загрузке категорий.");
      }
    }

    // 2. Ввод ID категории вручную
    else if (s.step === "await_category_manual") {
      const id = Number(ctx.message.text.trim());
      if (!Number.isInteger(id)) return ctx.reply("Введите корректное число.");
      const check = await pool.query("SELECT id FROM categories WHERE id=$1", [
        id,
      ]);
      if (check.rows.length === 0)
        return ctx.reply("Категория с таким ID не существует.");
      s.category_id = id;
      s.step = "await_quantity";
      return ctx.reply("Введите количество:");
    }

    // 3. Ввод количества
    else if (s.step === "await_quantity") {
      const qty = Number(ctx.message.text.trim());
      if (!Number.isInteger(qty) || qty < 0)
        return ctx.reply("Количество — целое неотрицательное число.");

      try {
        const productRes = await pool.query(
          "INSERT INTO products (name, category_id, unit) VALUES ($1, $2, 'шт') RETURNING id",
          [s.name, s.category_id]
        );
        const productId = productRes.rows[0].id;

        await pool.query(
          "INSERT INTO stock (product_id, quantity) VALUES ($1, $2)",
          [productId, qty]
        );

        resetAddSession(ctx.session);

        return ctx.reply(
          `✅ Товар добавлен!\nID: ${productId}\nНазвание: ${s.name}\nКоличество: ${qty}`,
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад к товарам", "menu_products")],
          ])
        );
      } catch (err) {
        console.error("Ошибка добавления товара:", err);
        await ctx.reply("Ошибка при добавлении товара.");
        return;
      }
    }
  });

  // Отображение страницы категорий
  async function sendCategoryPage(ctx, page = 1) {
    const offset = (page - 1) * ITEMS_PER_PAGE;
    const s = ctx.session;

    const res = await pool.query(
      `SELECT id, name FROM categories ORDER BY id LIMIT $1 OFFSET $2`,
      [ITEMS_PER_PAGE, offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM categories`
    );
    const totalCategories = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(totalCategories / ITEMS_PER_PAGE);

    if (res.rows.length === 0) return ctx.reply("Категории отсутствуют.");

    const buttons = res.rows.map((c) => [
      Markup.button.callback(c.name, `addcat_${c.id}`),
    ]);

    // Навигация по страницам категорий
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `category_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Вперед", `category_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);

    buttons.push([Markup.button.callback("❌ Отмена", "cancel_add")]);

    await replyOrEdit(
      ctx,
      "Выберите категорию:",
      Markup.inlineKeyboard(buttons, { columns: 1 })
    );
    s.categoryPage = page;
  }

  // Обработка выбора категории
  bot.action(/addcat_(.+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const s = ctx.session;
    if (!s || s.flow !== "add_product" || s.step !== "await_category")
      return replyOrEdit(ctx, "Сессия добавления не активна.");

    s.category_id = Number(ctx.match[1]);
    s.step = "await_quantity";

    await replyOrEdit(ctx, "Введите количество (целое число):");
  });

  // Навигация по страницам категорий
  bot.action(/category_page_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const page = parseInt(ctx.match[1], 10);
    const s = ctx.session;
    if (!s || s.flow !== "add_product" || s.step !== "await_category") return;
    await sendCategoryPage(ctx, page);
  });

  // Отмена добавления
  bot.action("cancel_add", async (ctx) => {
    resetAddSession(ctx.session);
    await safeAnswerCbQuery(ctx);
    await replyOrEdit(
      ctx,
      "Добавление отменено.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад", "menu_products")],
      ])
    );
  });
};
