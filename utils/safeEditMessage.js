module.exports = async function safeEditMessage(ctx, text, extra) {
  try {
    await ctx.editMessageText(text, extra);
  } catch (err) {
    const description = err?.description || err?.message || "";
    if (
      description.includes("message is not modified") ||
      description.includes("message can't be edited")
    ) {
      return;
    }
    throw err;
  }
};


