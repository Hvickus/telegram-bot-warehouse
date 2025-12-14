const ExcelJS = require("exceljs");
const pool = require("../../db");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "../../reports");
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

/**
 * Генерация Excel отчёта
 * @param {Date} fromDate
 * @param {Date} toDate
 * @returns {string} путь к файлу
 */
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
    { header: "Остаток на начало", key: "start_qty", width: 15 },
    { header: "Приход", key: "income", width: 12 },
    { header: "Списание", key: "outcome", width: 12 },
    { header: "Остаток на конец", key: "end_qty", width: 15 },
  ];

  // Дата отчёта
  sheet.addRow([]);
  sheet.insertRow(1, [
    `Отчёт с ${fromDate.toISOString().slice(0, 10)} по ${toDate
      .toISOString()
      .slice(0, 10)}`,
  ]);
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.getCell("A1").font = { bold: true };

  // Получаем данные
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
    [fromDate, toDate]
  );

  // Добавляем строки
  res.rows.forEach((r) => {
    const row = sheet.addRow(r);

    // Раскраска по конечному остатку
    const end = r.end_qty;
    if (end === 0)
      row.getCell("end_qty").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      }; // красный
    else if (end > 0 && end < 50)
      row.getCell("end_qty").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFA500" },
      }; // оранжевый
    else if (end < 0)
      row.getCell("end_qty").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB0B0B0" },
      }; // серый

    // Выравнивание по центру
    row.eachCell((cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  // Легенда
  const legendStartRow = sheet.rowCount + 2;
  sheet.addRow([]);
  sheet.addRow(["Легенда по цветам:"]);
  sheet.addRow(["Красный", "– 0 остатка"]);
  sheet.addRow(["Оранжевый", "– менее 50"]);
  sheet.addRow(["Серый", "– отрицательный остаток"]);

  // Выравнивание легенды
  for (let i = legendStartRow; i <= sheet.rowCount; i++) {
    sheet.getRow(i).eachCell((cell) => {
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });
  }

  // Автоширина столбцов
  sheet.columns.forEach((col) => {
    let maxLength = col.header.length;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value ? cell.value.toString() : "";
      if (val.length > maxLength) maxLength = val.length;
    });
    col.width = maxLength + 2;
  });

  const filePath = path.join(REPORTS_DIR, `stock_report_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = { generateExcelReport };
