module.exports = async function replyOrEdit(ctx, text, extra = {}) {
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch (err) {
      const description = err?.description || err?.message || "";
      if (description && description.includes("message is not modified")) {
        return;
      }
      console.error("replyOrEdit edit error:", err);
    }
  }

  await ctx.reply(text, extra);
};


