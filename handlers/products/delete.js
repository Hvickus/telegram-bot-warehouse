const { Markup } = require("telegraf");
const pool = require("../../db");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const ITEMS_PER_PAGE = 10;

module.exports = function (bot) {
  // Функция отправки страницы товаров для удаления
  async function sendDeletePage(ctx, page = 1) {
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
      return replyOrEdit(ctx, "Нет товаров для удаления.");

    const buttons = res.rows.map((p) => [
      Markup.button.callback(
        `${p.name} (Кол-во: ${p.quantity})`,
        `del_${p.id}`
      ),
    ]);

    // Навигация
    const navButtons = [];
    if (page > 1)
      navButtons.push(
        Markup.button.callback("⬅️ Назад", `del_page_${page - 1}`)
      );
    if (page < totalPages)
      navButtons.push(
        Markup.button.callback("➡️ Вперед", `del_page_${page + 1}`)
      );
    if (navButtons.length) buttons.push(navButtons);

    buttons.push([Markup.button.callback("🔙 Главное меню", "back_main")]);

    await replyOrEdit(
      ctx,
      `🗑 Выберите товар для удаления (Страница ${page} из ${totalPages}):`,
      Markup.inlineKeyboard(buttons)
    );
  }

  // Начало удаления
  bot.action("products_delete", async (ctx) => {
    await sendDeletePage(ctx, 1);
  });

  // Навигация по страницам
  bot.action(/del_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await sendDeletePage(ctx, page);
  });

  // Выбор товара для удаления
  bot.action(/del_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const productId = Number(ctx.match[1]);
    ctx.session = ctx.session || {};
    ctx.session.flow = "delete_product";
    ctx.session.productId = productId;

    const res = await pool.query(
      `SELECT p.id, p.name, COALESCE(s.quantity,0) AS quantity
       FROM products p
       LEFT JOIN stock s ON s.product_id = p.id
       WHERE p.id=$1`,
      [productId]
    );

    if (res.rows.length === 0) return replyOrEdit(ctx, "❗ Товар не найден.");

    const p = res.rows[0];
    await replyOrEdit(
      ctx,
      `❗ *Удаление товара*\n\nВы уверены, что хотите удалить товар:\n\n📌 *${p.name}*\n📦 Количество: ${p.quantity}\n\nЭто действие необратимо!`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "✅ Да, удалить",
              `confirm_del_${productId}`
            ),
          ],
          [Markup.button.callback("❌ Отмена", "products_delete")],
        ]),
      }
    );
  });

  // Подтверждение удаления
  bot.action(/confirm_del_(\d+)/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const productId = Number(ctx.match[1]);

    try {
      await pool.query("DELETE FROM stock WHERE product_id=$1", [productId]);
      const result = await pool.query(
        "DELETE FROM products WHERE id=$1 RETURNING name",
        [productId]
      );

      if (result.rows.length === 0)
        return replyOrEdit(ctx, "❗ Товар уже удалён или не найден.");

      const deletedName = result.rows[0].name;
      if (ctx.session) {
        delete ctx.session.flow;
        delete ctx.session.productId;
      }

      await replyOrEdit(ctx, `🗑 Товар *${deletedName}* успешно удалён!`, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🔙 Назад к списку товаров",
              "products_delete"
            ),
          ],
        ]),
      });
    } catch (err) {
      console.error("Ошибка confirm_del_X:", err);
      await replyOrEdit(ctx, "Ошибка при удалении товара.");
    }
  });
};
