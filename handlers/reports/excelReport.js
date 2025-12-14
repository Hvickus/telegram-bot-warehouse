const { Markup } = require("telegraf");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const pool = require("../../db");

const reportsFolder = path.join(__dirname, "../../reports");

// Создаём папку reports, если её нет
if (!fs.existsSync(reportsFolder)) {
  fs.mkdirSync(reportsFolder, { recursive: true });
}

module.exports = function (bot) {
  // Кнопка "Excel отчёт"
  bot.action("excel_report", async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.editMessageText("Выберите период для Excel отчета:", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📅 Сегодня", "excel_today")],
        [Markup.button.callback("📆 Этот месяц", "excel_month")],
        [Markup.button.callback("🗓 Выбрать период", "excel_custom")],
        [Markup.button.callback("🔙 Назад", "back_main")],
      ]),
    });
  });

  async function generateExcelReport(period, startDate = null, endDate = null) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Отчёт по складу");

    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Название", key: "name", width: 30 },
      { header: "Категория", key: "category", width: 20 },
      { header: "Остаток", key: "quantity", width: 12 },
      { header: "Приход", key: "income", width: 12 },
      { header: "Списание", key: "outcome", width: 12 },
    ];

    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Дата для фильтрации
    let dateCondition = "";
    if (period === "today")
      dateCondition = `i.date >= CURRENT_DATE AND o.date >= CURRENT_DATE`;
    else if (period === "month")
      dateCondition = `i.date >= date_trunc('month', CURRENT_DATE) AND o.date >= date_trunc('month', CURRENT_DATE)`;
    else if (period === "custom" && startDate && endDate)
      dateCondition = `i.date >= '${startDate}' AND i.date <= '${endDate}' AND o.date >= '${startDate}' AND o.date <= '${endDate}'`;
    else dateCondition = "1=1";

    const query = `
      SELECT p.id, p.name, c.name AS category,
             COALESCE(s.quantity,0) AS quantity,
             COALESCE(SUM(i.quantity),0) AS income,
             COALESCE(SUM(o.quantity),0) AS outcome
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock s ON s.product_id = p.id
      LEFT JOIN income i ON i.product_id = p.id ${
        period !== "custom" ? dateCondition.replace(/o\.date/g, "i.date") : ""
      }
      LEFT JOIN outcome o ON o.product_id = p.id ${
        period !== "custom" ? dateCondition.replace(/i\.date/g, "o.date") : ""
      }
      GROUP BY p.id, p.name, c.name, s.quantity
      ORDER BY p.id
    `;

    const res = await pool.query(query);

    res.rows.forEach((r) => {
      const row = sheet.addRow(r);
      if (r.quantity < 5) {
        row.getCell("quantity").font = {
          color: { argb: "FFFF0000" },
          bold: true,
        };
      }
    });

    // Зебра-стиль
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAF1FB" },
        };
      }
    });

    const fileName = `stock_report_${period}.xlsx`;
    const filePath = path.join(reportsFolder, fileName);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  // Обработчики периодов
  bot.action("excel_today", async (ctx) => {
    await ctx.answerCbQuery();
    const filePath = await generateExcelReport("today");
    await ctx.replyWithDocument({ source: filePath });
  });

  bot.action("excel_month", async (ctx) => {
    await ctx.answerCbQuery();
    const filePath = await generateExcelReport("month");
    await ctx.replyWithDocument({ source: filePath });
  });

  bot.action("excel_custom", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.flow = "excel_custom_start";
    await ctx.reply("Введите период в формате: YYYY-MM-DD - YYYY-MM-DD");
  });

  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "excel_custom_start") return next();

    const text = ctx.message.text.trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/);
    if (!match)
      return ctx.reply("Неверный формат. Используйте: YYYY-MM-DD - YYYY-MM-DD");

    const startDate = match[1];
    const endDate = match[2];

    const filePath = await generateExcelReport("custom", startDate, endDate);

    delete ctx.session.flow;
    await ctx.replyWithDocument({ source: filePath });
  });
};
