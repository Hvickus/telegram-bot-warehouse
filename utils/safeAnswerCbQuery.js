module.exports = async function safeAnswerCbQuery(ctx, options) {
  if (!ctx || typeof ctx.answerCbQuery !== "function") return;
  try {
    await ctx.answerCbQuery(options);
  } catch (err) {
    const description = err?.description || err?.message || "";
    if (
      description.includes("query is too old") ||
      description.includes("query ID is invalid")
    ) {
      return;
    }
    console.error("safeAnswerCbQuery error:", err);
  }
};


