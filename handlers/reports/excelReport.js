const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const pool = require("../../db");

const reportsFolder = path.join(__dirname, "../../reports");
if (!fs.existsSync(reportsFolder))
  fs.mkdirSync(reportsFolder, { recursive: true });

/**
 * Генерация Excel отчёта
 * @param {Date} fromDate
 * @param {Date} toDate
 * @returns {Promise<string>} Путь к файлу
 */
async function generateExcelReport(fromDate, toDate) {
  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
    throw new Error(
      "generateExcelReport: fromDate и toDate должны быть объектами Date"
    );
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Заголовки таблицы
  sheet.columns = [
    { header: "ID", key: "id" },
    { header: "Название", key: "name" },
    { header: "Категория", key: "category" },
    { header: "Остаток на начало", key: "start_qty" },
    { header: "Приход", key: "income" },
    { header: "Списание", key: "outcome" },
    { header: "Остаток на конец", key: "end_qty" },
  ];

  // Выравнивание и автоширина
  sheet.columns.forEach((col) => {
    col.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Данные по товарам с остатками
  const res = await pool.query(
    `
    SELECT p.id, p.name, c.name AS category,
           COALESCE(s_start.quantity,0) AS start_qty,
           COALESCE(SUM(i.quantity),0) AS income,
           COALESCE(SUM(o.quantity),0) AS outcome,
           COALESCE(s_end.quantity,0) AS end_qty
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s_start ON s_start.product_id = p.id
      AND s_start.date <= $1
    LEFT JOIN stock s_end ON s_end.product_id = p.id
      AND s_end.date <= $2
    LEFT JOIN income i ON i.product_id = p.id AND i.date >= $1 AND i.date <= $2
    LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= $1 AND o.date <= $2
    GROUP BY p.id, p.name, c.name, s_start.quantity, s_end.quantity
    ORDER BY p.id
    `,
    [fromDate, toDate]
  );

  // Добавляем строки
  res.rows.forEach((r, index) => {
    const row = sheet.addRow(r);

    // Раскраска остатков
    ["start_qty", "end_qty"].forEach((key) => {
      const cell = row.getCell(key);
      if (cell.value === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF0000" },
        }; // красный
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      } else if (cell.value < 50) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFA500" },
        }; // оранжевый
        cell.font = { color: { argb: "FF000000" }, bold: true };
      }
    });

    // Границы
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Заголовки жирные и синие
  const headerRow = sheet.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Зебра
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (!cell.fill || cell.fill.fgColor.argb === "FFFFFFFF") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEAF1FB" },
          };
        }
      });
    }
  });

  // Легенда справа
  const legendColStart = sheet.columns.length + 2;
  const legend = [
    ["Легенда:"],
    ["0 – красный: нулевой остаток"],
    ["<50 – оранжевый: малый остаток"],
    [">=50 – белый: нормальный остаток"],
  ];
  legend.forEach((rowVals, idx) => {
    const row = sheet.getRow(idx + 2);
    row.getCell(legendColStart).value = rowVals[0];
    row.getCell(legendColStart).alignment = {
      horizontal: "left",
      vertical: "middle",
    };
  });

  // Автоширина
  sheet.columns.forEach((col) => {
    let maxLength = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const l = cell.value ? cell.value.toString().length : 0;
      if (l > maxLength) maxLength = l;
    });
    col.width = maxLength + 2;
  });

  const fileName = `stock_report_${Date.now()}.xlsx`;
  const filePath = path.join(reportsFolder, fileName);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = { generateExcelReport };
