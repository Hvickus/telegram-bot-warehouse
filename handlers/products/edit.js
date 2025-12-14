const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

function resetEditSession(session) {
  if (!session) return;
  delete session.flow;
  delete session.productId;
}

module.exports = function (bot) {
  // Отправка страницы товаров для редактирования
  async function sendEditPage(ctx, page = 1) {
    await safeAnswerCbQuery(ctx);

    const offset = (page - 1) * ITEMS_PER_PAGE;
    const countRes = await pool.query(`SELECT COUNT(*) AS total FROM products`);
    const totalItems = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const res = await pool.query(
      `SELECT p.id, p.name, COALESCE(s.quantity,0) AS quantity
       FROM products p
       LEFT JOIN stock s ON s.product_id = p.id
       ORDER BY p.id
       LIMIT $1 OFFSET $2`,
      [ITEMS_PER_PAGE, offset]
    );

    if (res.rows.length === 0)
      return replyOrEdit(ctx, "Нет товаров для редактирования.");

    const buttons = res.rows.map((p) => [
      Markup.button.callback(
        `${p.name} (Кол-во: ${p.quantity})`,
        `edit_${p.id}`
      ),
    ]);

    // Кнопки навигации
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `edit_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Вперед", `edit_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);

    buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

    await replyOrEdit(
      ctx,
      `✏ Выберите товар для редактирования (Страница ${page} из ${totalPages}):`,
      Markup.inlineKeyboard(buttons)
    );
  }

  // Начало редактирования
  bot.action("products_edit", async (ctx) => {
    await sendEditPage(ctx, 1);
  });

  // Навигация по страницам
  bot.action(/edit_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendEditPage(ctx, page);
  });

  // Выбор конкретного товара для редактирования
  bot.action(/edit_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "edit_product";
    ctx.session.productId = productId;

    try {
      const res = await pool.query(
        `SELECT p.id, p.name, c.name AS category, COALESCE(s.quantity,0) AS quantity
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN stock s ON s.product_id = p.id
         WHERE p.id = $1`,
        [productId]
      );

      if (res.rows.length === 0) return replyOrEdit(ctx, "❗ Товар не найден.");

      const p = res.rows[0];

      await replyOrEdit(
        ctx,
        `✏ *Редактирование товара*\n\nID: ${p.id}\nНазвание: ${
          p.name
        }\nКатегория: ${p.category || "—"}\nКоличество: ${p.quantity}`,
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
            [
              Markup.button.callback(
                "🔙 Назад к списку товаров",
                "products_edit"
              ),
            ],
          ]),
        }
      );
    } catch (err) {
      console.error("Ошибка edit_X:", err);
      await replyOrEdit(ctx, "Ошибка при загрузке товара.");
    }
  });

  // Остальной функционал изменения названия, категории и количества остаётся без изменений
  bot.action(/editname_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "edit_product_name";
    ctx.session.productId = productId;
    await replyOrEdit(ctx, "Введите новое название товара:");
  });

  bot.action(/editqty_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "edit_product_quantity";
    ctx.session.productId = productId;
    await replyOrEdit(ctx, "Введите новое количество товара:");
  });

  bot.action(/editcat_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "edit_product_category";
    ctx.session.productId = productId;

    try {
      const res = await pool.query(
        "SELECT id, name FROM categories ORDER BY id"
      );
      if (res.rows.length === 0)
        return replyOrEdit(ctx, "Нет доступных категорий.");

      const buttons = res.rows.map((c) => [
        Markup.button.callback(c.name, `setcat_${productId}_${c.id}`),
      ]);
      buttons.push([Markup.button.callback("❌ Отмена", `edit_${productId}`)]);

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

  bot.action(/setcat_(\d+)_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const productId = Number(ctx.match[1]);
    const categoryId = Number(ctx.match[2]);
    try {
      await pool.query("UPDATE products SET category_id=$1 WHERE id=$2", [
        categoryId,
        productId,
      ]);
      resetEditSession(ctx.session);
      await replyOrEdit(
        ctx,
        "🏷 Категория успешно изменена!",
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🔙 Назад к списку товаров",
              "products_edit"
            ),
          ],
        ])
      );
    } catch (err) {
      console.error("Ошибка установки категории:", err);
      await replyOrEdit(ctx, "Ошибка при изменении категории.");
    }
  });

  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s) return next();

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
            [
              Markup.button.callback(
                "🔙 Назад к списку товаров",
                "products_edit"
              ),
            ],
          ]),
        });
      } catch (err) {
        console.error("Ошибка изменения имени:", err);
        return ctx.reply("Ошибка при изменении названия.");
      }
    }

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
            [
              Markup.button.callback(
                "🔙 Назад к списку товаров",
                "products_edit"
              ),
            ],
          ]),
        });
      } catch (err) {
        console.error("Ошибка изменения количества:", err);
        return ctx.reply("Ошибка при изменении количества.");
      }
    }

    return next();
  });
};
