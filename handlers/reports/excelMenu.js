const { Markup } = require("telegraf");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const { generateExcelReport } = require("./excelReport");

module.exports = function (bot) {
  /**
   * Меню выбора периода Excel-отчёта
   */
  bot.action("excel_report", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    await replyOrEdit(ctx, "📈 *Excel-отчёт по складу*\n\nВыберите период:", {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📅 Сегодня", "excel_today")],
        [Markup.button.callback("📆 Этот месяц", "excel_month")],
        [Markup.button.callback("🗓 Выбрать период", "excel_custom")],
        [Markup.button.callback("🔙 Назад", "back_main")],
      ]),
    });
  });

  /**
   * Отчёт за сегодня
   */
  bot.action("excel_today", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const today = new Date();
    const from = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const to = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59
    );

    await replyOrEdit(ctx, "⏳ Формирование отчёта за сегодня...");
    const filePath = await generateExcelReport(from, to);

    await ctx.replyWithDocument({ source: filePath });
  });

  /**
   * Отчёт за текущий месяц
   */
  bot.action("excel_month", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await replyOrEdit(ctx, "⏳ Формирование отчёта за текущий месяц...");
    const filePath = await generateExcelReport(from, to);

    await ctx.replyWithDocument({ source: filePath });
  });

  /**
   * Произвольный период
   */
  bot.action("excel_custom", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    ctx.session = ctx.session || {};
    ctx.session.flow = "excel_custom_period";

    await replyOrEdit(
      ctx,
      "🗓 Введите период в формате:\n\n`YYYY-MM-DD - YYYY-MM-DD`",
      { parse_mode: "Markdown" }
    );
  });

  /**
   * Обработка ввода периода
   */
  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "excel_custom_period") return next();

    const match = ctx.message.text.match(
      /^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/
    );

    if (!match) {
      return ctx.reply(
        "❗ Неверный формат.\nИспользуйте: `YYYY-MM-DD - YYYY-MM-DD`",
        { parse_mode: "Markdown" }
      );
    }

    const from = new Date(match[1]);
    const to = new Date(match[2]);
    to.setHours(23, 59, 59);

    delete s.flow;

    await ctx.reply("⏳ Формирование отчёта за выбранный период...");
    const filePath = await generateExcelReport(from, to);

    await ctx.replyWithDocument({ source: filePath });
  });
};
