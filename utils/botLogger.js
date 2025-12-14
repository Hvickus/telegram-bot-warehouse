const logUserAction = require("./logUserAction");

/**
 * Подключение логирования к боту
 * @param {Telegraf} bot - экземпляр бота
 */
function registerBotLogger(bot) {
  // Логирование всех callback_query
  bot.on("callback_query", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      const data = ctx.callbackQuery?.data;
      if (userId && data) {
        await logUserAction(userId, "callback_query", data);
      }
    } catch (err) {
      console.error("Ошибка логирования callback_query:", err);
    }
    return next();
  });

  // Логирование всех текстовых сообщений (команды и обычные сообщения)
  bot.on("message:text", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      const text = ctx.message?.text;
      if (userId && text) {
        const type = text.startsWith("/") ? "command" : "message";
        await logUserAction(userId, type, text);
      }
    } catch (err) {
      console.error("Ошибка логирования текстового сообщения:", err);
    }
    return next();
  });
}

module.exports = registerBotLogger;
