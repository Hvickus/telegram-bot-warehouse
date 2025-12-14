const { Markup } = require("telegraf");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  // Главное меню Excel отчёта
  bot.action("excel_report", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    await replyOrEdit(ctx, "Выберите период для Excel отчёта:", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📅 Сегодня", "excel_today")],
        [Markup.button.callback("📆 Этот месяц", "excel_month")],
        [Markup.button.callback("🗓 Выбрать период", "excel_custom")],
        [Markup.button.callback("🔙 Назад", "back_main")],
      ]),
    });
  });

  // Генерация отчёта за сегодня
  bot.action("excel_today", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.reply("Генерация отчёта за сегодня...");
    // Здесь вызываем функцию генерации Excel с фильтром на сегодня
  });

  // Генерация отчёта за этот месяц
  bot.action("excel_month", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.reply("Генерация отчёта за этот месяц...");
    // Здесь вызываем функцию генерации Excel с фильтром на месяц
  });

  // Генерация отчёта за пользовательский период
  bot.action("excel_custom", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.reply(
      "Введите начальную и конечную дату в формате YYYY-MM-DD - YYYY-MM-DD"
    );
    // Здесь обрабатываем текст от пользователя и вызываем генерацию Excel
  });
};
