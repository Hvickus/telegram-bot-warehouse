const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const pool = require("../../db");

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
  const columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Название", key: "name", width: 30 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Остаток на начало", key: "start_qty", width: 15 },
    { header: "Приход", key: "income", width: 12 },
    { header: "Списание", key: "outcome", width: 12 },
    { header: "Остаток на конец", key: "end_qty", width: 15 },
  ];
  sheet.columns = columns;

  // Стиль заголовков
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  const res = await pool.query(
    `
    SELECT p.id, p.name, c.name AS category,
           COALESCE(s.quantity,0) + COALESCE(SUM(o.quantity),0) - COALESCE(SUM(i.quantity),0) AS start_qty,
           COALESCE(SUM(i.quantity),0) AS income,
           COALESCE(SUM(o.quantity),0) AS outcome,
           COALESCE(s.quantity,0) AS end_qty
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

  // Добавляем строки и применяем цветовое оформление
  res.rows.forEach((r, index) => {
    const row = sheet.addRow(r);

    // Центрирование
    row.alignment = { vertical: "middle", horizontal: "center" };

    // Цвет по остаткам
    ["start_qty", "end_qty"].forEach((key) => {
      const cell = row.getCell(key);
      if (cell.value === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF0000" },
        };
      } else if (cell.value < 50) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFF00" },
        };
      } else {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF00FF00" },
        };
      }
    });

    // Зебра-стиль
    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = cell.fill || {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAF1FB" },
        };
      });
    }

    // Границы
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Легенда справа от таблицы
  const legendStartCol = columns.length + 2;
  const legendRows = [
    { text: "0 — красный", color: "FFFF0000" },
    { text: "<50 — желтый", color: "FFFFFF00" },
    { text: ">=50 — зеленый", color: "FF00FF00" },
  ];

  legendRows.forEach((l, i) => {
    const cell = sheet.getRow(i + 2).getCell(legendStartCol);
    cell.value = l.text;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: l.color },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Автоширина колонок
  sheet.columns.forEach((c) => {
    let maxLength = 10;
    c.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value ? cell.value.toString().length : 0;
      if (len > maxLength) maxLength = len;
    });
    c.width = maxLength + 2;
  });

  const filePath = path.join(REPORTS_DIR, `stock_report_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = { generateExcelReport };
