const ExcelJS = require("exceljs");
const pool = require("../../db");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "../../reports");
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

/**
 * Генерация Excel отчёта
 */
async function generateExcelReport(fromDate, toDate) {
  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
    throw new Error(
      "generateExcelReport: fromDate и toDate должны быть объектами Date"
    );
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Заголовки
  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Название", key: "name", width: 30 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Начало", key: "start_qty", width: 12 },
    { header: "Приход", key: "income", width: 12 },
    { header: "Списание", key: "outcome", width: 12 },
    { header: "Конец", key: "end_qty", width: 12 },
  ];

  // Стиль заголовков
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
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

  // Заполнение строк
  res.rows.forEach((r, idx) => {
    const row = sheet.addRow(r);

    // Автоцентрирование
    row.eachCell((cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Зебра-стиль
    const zebraColor = idx % 2 === 1 ? "FFEAF1FB" : null;
    row.eachCell((cell) => {
      if (zebraColor)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: zebraColor },
        };
    });

    // Цвет конечного остатка
    const endCell = row.getCell("end_qty");
    if (r.end_qty === 0) {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      };
      endCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    } else if (r.end_qty < 50) {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC000" },
      };
    } else {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF92D050" },
      };
    }
  });

  // Легенда цветов
  sheet.addRow([]);
  const legend = [
    { label: "Конечный остаток = 0", color: "FFFF0000" },
    { label: "Конечный остаток < 50", color: "FFFFC000" },
    { label: "Конечный остаток >= 50", color: "FF92D050" },
  ];

  sheet.addRow(["Легенда:"]).font = { bold: true };
  legend.forEach((item) => {
    const row = sheet.addRow([item.label]);
    const cell = row.getCell(1);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: item.color },
    };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Автоширина
  sheet.columns.forEach((col) => {
    let maxLength = 0;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value ? cell.value.toString() : "";
      if (val.length > maxLength) maxLength = val.length;
    });
    col.width = Math.min(maxLength + 2, 50);
  });

  // Файл
  const filePath = path.join(REPORTS_DIR, `stock_report_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = { generateExcelReport };
