const { Markup } = require("telegraf");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

module.exports = function (bot) {
  bot.action("excel_report", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    await replyOrEdit(
      ctx,
      "Выберите период для Excel отчёта:",
      Markup.inlineKeyboard([
        [Markup.button.callback("📅 Сегодня", "excel_today")],
        [Markup.button.callback("📆 Этот месяц", "excel_month")],
        [Markup.button.callback("🗓 Выбрать период", "excel_custom")],
        [Markup.button.callback("🔙 Назад", "back_main")],
      ])
    );
  });

  // Примеры обработчиков для каждой кнопки
  bot.action("excel_today", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.reply("Генерация отчёта за сегодня...");
    // Тут вызываешь функцию генерации Excel с фильтром на сегодня
  });

  bot.action("excel_month", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.reply("Генерация отчёта за этот месяц...");
    // Тут вызываешь функцию генерации Excel с фильтром на месяц
  });

  bot.action("excel_custom", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.reply("Введите начальную и конечную дату в формате YYYY-MM-DD - YYYY-MM-DD");
    // Здесь дальше обрабатываешь текст от пользователя и генерируешь Excel
  });
};
