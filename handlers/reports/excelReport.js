const { Markup } = require("telegraf");
const pool = require("../../db");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");

const reportsDir = path.join(__dirname, "../../reports");

// Создание папки, если не существует
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

module.exports = function (bot) {
  // Выбор периода
  bot.action("report_excel_period", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    await ctx.editMessageText("Выберите период для отчёта Excel:", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📅 Сегодня", "excel_today")],
        [Markup.button.callback("📆 Этот месяц", "excel_month")],
        [Markup.button.callback("🗓 Выбрать период", "excel_custom")],
        [Markup.button.callback("🔙 Назад", "back_main")],
      ]),
    });
  });

  // Генерация отчета за сегодня
  bot.action("excel_today", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    await generateExcelReport(ctx, start, end);
  });

  // Генерация отчета за месяц
  bot.action("excel_month", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date();
    await generateExcelReport(ctx, start, end);
  });

  // Простой выбор периода (на текущий момент – за 7 дней)
  bot.action("excel_custom", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7); // пример: последние 7 дней
    await generateExcelReport(ctx, start, end);
  });

  async function generateExcelReport(ctx, startDate, endDate) {
    try {
      // Получаем данные
      const res = await pool.query(
        `
        SELECT p.name,
               COALESCE(SUM(i.quantity),0) AS income,
               COALESCE(SUM(o.quantity),0) AS outcome,
               COALESCE(s.quantity,0) AS stock
        FROM products p
        LEFT JOIN income i ON i.product_id = p.id AND i.date >= $1 AND i.date <= $2
        LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= $1 AND o.date <= $2
        LEFT JOIN stock s ON s.product_id = p.id
        GROUP BY p.id, p.name, s.quantity
        ORDER BY p.name
        `,
        [startDate, endDate]
      );

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Отчёт по складу");

      // Заголовки
      sheet.columns = [
        { header: "Товар", key: "name", width: 30 },
        { header: "Приход", key: "income", width: 15 },
        { header: "Списание", key: "outcome", width: 15 },
        { header: "Остаток на складе", key: "stock", width: 20 },
      ];

      res.rows.forEach((row) => {
        sheet.addRow({
          name: row.name,
          income: row.income,
          outcome: row.outcome,
          stock: row.stock,
        });
      });

      const fileName = `warehouse_report_${Date.now()}.xlsx`;
      const filePath = path.join(reportsDir, fileName);

      await workbook.xlsx.writeFile(filePath);

      await ctx.replyWithDocument({ source: filePath, filename: "Отчёт.xlsx" });
    } catch (err) {
      console.error("Ошибка генерации Excel отчёта:", err);
      await ctx.reply("❌ Ошибка при генерации отчёта.");
    }
  }
};
