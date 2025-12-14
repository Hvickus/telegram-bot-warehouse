const ExcelJS = require("exceljs");
const pool = require("../../db");
const path = require("path");
const fs = require("fs");

const REPORTS_DIR = path.join(__dirname, "../../reports");
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

async function generateExcelReport(fromDate, toDate) {
  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
    throw new Error(
      "generateExcelReport: fromDate и toDate должны быть объектами Date"
    );
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Заголовки столбцов
  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Название", key: "name", width: 30 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Начало", key: "start_qty", width: 12 },
    { header: "Приход", key: "income", width: 12 },
    { header: "Списание", key: "outcome", width: 12 },
    { header: "Конец", key: "end_qty", width: 12 },
  ];

  // Стиль заголовка
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  const res = await pool.query(
    `
    SELECT p.id, p.name, c.name AS category,
           COALESCE(s.quantity,0) AS start_qty,
           COALESCE(SUM(i.quantity),0) AS income,
           COALESCE(SUM(o.quantity),0) AS outcome,
           COALESCE(s.quantity,0) + COALESCE(SUM(i.quantity),0) - COALESCE(SUM(o.quantity),0) AS end_qty
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN income i ON i.product_id = p.id AND i.date >= $1 AND i.date <= $2
    LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= $1 AND o.date <= $2
    GROUP BY p.id, p.name, c.name, s.quantity
    ORDER BY p.id
  `,
    [fromStr, toStr]
  );

  res.rows.forEach((r, idx) => {
    const row = sheet.addRow(r);
    row.alignment = { vertical: "middle", horizontal: "center" };

    // Конечный остаток: перекрашивание поверх зебры
    if (r.end_qty === 0) {
      row.getCell("end_qty").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      };
      row.getCell("end_qty").font = { bold: true };
    } else if (r.end_qty < 50) {
      row.getCell("end_qty").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      };
      row.getCell("end_qty").font = { bold: true, color: { argb: "FFFFFFFF" } };
    } else {
      // Зебра только на строки без окрашивания конечного остатка
      if (idx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEAF1FB" },
          };
        });
      }
    }
  });

  // Легенда с окраской
  const legendStartRow = sheet.lastRow.number + 2;
  const legend = [
    ["", "Легенда:"],
    ["", "Конечный остаток < 50", "Красный"],
    ["", "Конечный остаток = 0", "Серый"],
  ];

  legend.forEach((l, i) => {
    const row = sheet.addRow(l);
    row.alignment = { vertical: "middle", horizontal: "center" };
    if (i === 1)
      row.getCell(3).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      };
    if (i === 2)
      row.getCell(3).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      };
  });

  // Автоширина
  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const l = cell.value ? cell.value.toString().length : 10;
      if (l > maxLength) maxLength = l;
    });
    column.width = maxLength + 2;
  });

  // Заголовок с датами отчета
  sheet.insertRow(1, [`Отчет с ${fromStr} по ${toStr}`]);
  sheet.mergeCells(1, 1, 1, sheet.columns.length);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 14 };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  const filePath = path.join(REPORTS_DIR, `stock_report_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = { generateExcelReport };
