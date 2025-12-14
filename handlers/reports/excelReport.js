const ExcelJS = require("exceljs");
const pool = require("../../db");
const path = require("path");
const fs = require("fs");

const reportsFolder = path.join(__dirname, "../../reports");
if (!fs.existsSync(reportsFolder))
  fs.mkdirSync(reportsFolder, { recursive: true });

async function generateExcelReport(ctx, fromDate, toDate) {
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

  const res = await pool.query(
    `
    SELECT p.id, p.name, c.name AS category,
           COALESCE(s.quantity,0) AS quantity,
           COALESCE(SUM(i.quantity),0) AS income,
           COALESCE(SUM(o.quantity),0) AS outcome
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN income i ON i.product_id = p.id AND i.date >= $1 AND i.date <= $2
    LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= $1 AND o.date <= $2
    GROUP BY p.id, p.name, c.name, s.quantity
    ORDER BY p.name
    `,
    [fromDate, toDate]
  );

  // Определим максимумы для градиента
  const maxQuantity = Math.max(...res.rows.map((r) => r.quantity));
  const maxIncome = Math.max(...res.rows.map((r) => r.income));
  const maxOutcome = Math.max(...res.rows.map((r) => r.outcome));

  function getGradientColor(value, max, startColor, endColor) {
    const ratio = max ? Math.min(value / max, 1) : 0;
    const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
    const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * ratio);
    const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * ratio);
    const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * ratio);
    return `FF${hex(r)}${hex(g)}${hex(b)}`;
  }

  res.rows.forEach((r) => {
    const row = sheet.addRow({
      id: r.id,
      name: r.name,
      category: r.category || "-",
      quantity: r.quantity,
      income: r.income,
      outcome: r.outcome,
    });

    // Остаток: красно-зелёная шкала
    row.getCell("quantity").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: getGradientColor(
          r.quantity,
          maxQuantity,
          [255, 0, 0],
          [0, 176, 80]
        ),
      },
    };
    // Приход: светло-синий → насыщенный синий
    row.getCell("income").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: getGradientColor(
          r.income,
          maxIncome,
          [198, 224, 255],
          [0, 112, 192]
        ),
      },
    };
    // Списание: светло-фиолетовый → насыщенный фиолетовый
    row.getCell("outcome").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: getGradientColor(
          r.outcome,
          maxOutcome,
          [230, 230, 255],
          [102, 0, 204]
        ),
      },
    };
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

  const filePath = path.join(reportsFolder, `stock_report_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  await ctx.replyWithDocument({ source: filePath });
  fs.unlinkSync(filePath);
}

module.exports = function (bot) {
  bot.action("excel_today", async (ctx) => {
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
    await generateExcelReport(ctx, from, to);
  });

  bot.action("excel_month", async (ctx) => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    await generateExcelReport(ctx, from, to);
  });

  bot.action("excel_custom", async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.flow = "excel_custom";
    await ctx.reply("Введите период в формате: YYYY-MM-DD - YYYY-MM-DD");
  });

  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "excel_custom") return next();

    const match = ctx.message.text.match(
      /^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/
    );
    if (!match)
      return ctx.reply("Неверный формат. Используйте: YYYY-MM-DD - YYYY-MM-DD");

    const from = new Date(match[1]);
    const to = new Date(match[2]);
    to.setHours(23, 59, 59);

    s.flow = null;
    await generateExcelReport(ctx, from, to);
  });
};
