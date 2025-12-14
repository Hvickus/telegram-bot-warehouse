const { Markup } = require("telegraf");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const pool = require("../../db");

const reportsFolder = path.join(__dirname, "../../reports");
if (!fs.existsSync(reportsFolder)) {
  fs.mkdirSync(reportsFolder, { recursive: true });
}

module.exports = function (bot) {
  bot.action("excel_report", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText("Выберите период для Excel отчёта:", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📅 Сегодня", "excel_today")],
        [Markup.button.callback("📆 Этот месяц", "excel_month")],
        [Markup.button.callback("🗓 Выбрать период", "excel_custom")],
        [Markup.button.callback("🔙 Назад", "back_main")],
      ]),
    });
  });

  async function generateExcelReport(fromDate, toDate) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Отчёт по складу");

    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Название", key: "name", width: 30 },
      { header: "Категория", key: "category", width: 20 },
      { header: "Начальный остаток", key: "start_qty", width: 15 },
      { header: "Приход", key: "income", width: 10 },
      { header: "Списание", key: "outcome", width: 10 },
      { header: "Конечный остаток", key: "end_qty", width: 15 },
    ];

    // Стиль заголовков
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    const query = `
      SELECT 
        p.id,
        p.name,
        c.name AS category,
        COALESCE(s.quantity,0)
          - COALESCE(SUM(i.quantity) FILTER (WHERE i.date < $1),0)
          + COALESCE(SUM(o.quantity) FILTER (WHERE o.date < $1),0) AS start_qty,
        COALESCE(SUM(i.quantity) FILTER (WHERE i.date >= $1 AND i.date <= $2),0) AS income,
        COALESCE(SUM(o.quantity) FILTER (WHERE o.date >= $1 AND o.date <= $2),0) AS outcome,
        (
          COALESCE(s.quantity,0)
          - COALESCE(SUM(i.quantity) FILTER (WHERE i.date < $1),0)
          + COALESCE(SUM(o.quantity) FILTER (WHERE o.date < $1),0)
          + COALESCE(SUM(i.quantity) FILTER (WHERE i.date >= $1 AND i.date <= $2),0)
          - COALESCE(SUM(o.quantity) FILTER (WHERE o.date >= $1 AND o.date <= $2),0)
        ) AS end_qty
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock s ON s.product_id = p.id
      LEFT JOIN income i ON i.product_id = p.id
      LEFT JOIN outcome o ON o.product_id = p.id
      GROUP BY p.id, p.name, c.name, s.quantity
      ORDER BY p.id
    `;

    const res = await pool.query(query, [fromDate, toDate]);

    res.rows.forEach((r) => {
      const row = sheet.addRow(r);

      // Конечный остаток
      const endCell = row.getCell("end_qty");
      if (r.end_qty === 0) {
        endCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF0000" },
        };
        endCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      } else if (r.end_qty < 5) {
        endCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFC000" },
        };
        endCell.font = { bold: true };
      } else {
        endCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF92D050" },
        };
      }

      // Условное форматирование прихода
      const incomeCell = row.getCell("income");
      if (r.income > 50) {
        incomeCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF00B050" },
        };
        incomeCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      }

      // Условное форматирование списания
      const outcomeCell = row.getCell("outcome");
      if (r.outcome > 50) {
        outcomeCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF0000" },
        };
        outcomeCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
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

    // Легенда цветов
    const legendRow = sheet.rowCount + 2;
    sheet.getCell(`A${legendRow}`).value = "Легенда:";
    sheet.getCell(`A${legendRow}`).font = { bold: true };

    sheet.getCell(`B${legendRow}`).value =
      "Конечный остаток = 0 (нет на складе)";
    sheet.getCell(`B${legendRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFF0000" },
    };
    sheet.getCell(`B${legendRow}`).font = {
      color: { argb: "FFFFFFFF" },
      bold: true,
    };

    sheet.getCell(`B${legendRow + 1}`).value =
      "Конечный остаток < 5 (мало на складе)";
    sheet.getCell(`B${legendRow + 1}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC000" },
    };

    sheet.getCell(`B${legendRow + 2}`).value = "Конечный остаток ≥ 5 (в норме)";
    sheet.getCell(`B${legendRow + 2}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF92D050" },
    };

    sheet.getCell(`B${legendRow + 3}`).value = "Приход > 50 (большой приход)";
    sheet.getCell(`B${legendRow + 3}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00B050" },
    };
    sheet.getCell(`B${legendRow + 3}`).font = {
      color: { argb: "FFFFFFFF" },
      bold: true,
    };

    sheet.getCell(`B${legendRow + 4}`).value =
      "Списание > 50 (большое списание)";
    sheet.getCell(`B${legendRow + 4}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFF0000" },
    };
    sheet.getCell(`B${legendRow + 4}`).font = {
      color: { argb: "FFFFFFFF" },
      bold: true,
    };

    const filePath = path.join(
      reportsFolder,
      `stock_report_${Date.now()}.xlsx`
    );
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  bot.action("excel_today", async (ctx) => {
    await ctx.answerCbQuery();
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

    await ctx.reply("Генерация отчёта за сегодня...");
    const filePath = await generateExcelReport(from, to);
    await ctx.replyWithDocument({ source: filePath });
  });

  bot.action("excel_month", async (ctx) => {
    await ctx.answerCbQuery();
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await ctx.reply("Генерация отчёта за текущий месяц...");
    const filePath = await generateExcelReport(from, to);
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

    const from = new Date(match[1]);
    const to = new Date(match[2]);
    to.setHours(23, 59, 59);

    delete ctx.session.flow;
    await ctx.reply("Генерация отчёта за выбранный период...");
    const filePath = await generateExcelReport(from, to);
    await ctx.replyWithDocument({ source: filePath });
  });
};
