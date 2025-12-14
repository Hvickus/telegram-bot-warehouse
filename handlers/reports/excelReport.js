const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const pool = require("../../db");

const reportsFolder = path.join(__dirname, "../../reports");
if (!fs.existsSync(reportsFolder))
  fs.mkdirSync(reportsFolder, { recursive: true });

async function generateExcelReport(ctx, fromDate, toDate) {
  // Защита от неправильных аргументов
  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
    throw new Error(
      "generateExcelReport: fromDate и toDate должны быть объектами Date"
    );
  }

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Заголовки
  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Название", key: "name", width: 30 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Остаток на начало", key: "start_qty", width: 15 },
    { header: "Приход", key: "income", width: 12 },
    { header: "Списание", key: "outcome", width: 12 },
    { header: "Остаток на конец", key: "end_qty", width: 15 },
  ];

  // Форматируем заголовок
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Получаем данные
  const res = await pool.query(
    `
    SELECT p.id, p.name, c.name AS category,
           COALESCE(s_start.quantity,0) AS start_qty,
           COALESCE(SUM(i.quantity),0) AS income,
           COALESCE(SUM(o.quantity),0) AS outcome,
           COALESCE(s_end.quantity,0) AS end_qty
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s_start ON s_start.product_id = p.id AND s_start.date <= $1
    LEFT JOIN stock s_end ON s_end.product_id = p.id AND s_end.date <= $2
    LEFT JOIN income i ON i.product_id = p.id AND i.date >= $1 AND i.date <= $2
    LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= $1 AND o.date <= $2
    GROUP BY p.id, p.name, c.name, s_start.quantity, s_end.quantity
    ORDER BY p.id
    `,
    [fromStr, toStr]
  );

  res.rows.forEach((r) => {
    const row = sheet.addRow(r);

    // Цвета для конечного остатка
    const cell = row.getCell("end_qty");
    if (r.end_qty === 0)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      }; // красный
    else if (r.end_qty < 50)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC000" },
      }; // оранжевый
    else
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      }; // серый
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
    row.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Легенда
  const legendRow = sheet.addRow([]);
  legendRow.getCell(1).value = "Легенда:";
  legendRow.getCell(1).font = { bold: true };
  const legend = sheet.addRow([
    "0 — красный",
    "<50 — оранжевый",
    ">=50 — серый",
  ]);
  legend.eachCell((cell) => {
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const fileName = `stock_report_${Date.now()}.xlsx`;
  const filePath = path.join(reportsFolder, fileName);
  await workbook.xlsx.writeFile(filePath);

  await ctx.replyWithDocument({ source: filePath });

  fs.unlinkSync(filePath);
}

module.exports = { generateExcelReport };
