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
 * @returns {string} filePath
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
  const headers = [
    { header: "ID", key: "id" },
    { header: "Название", key: "name" },
    { header: "Категория", key: "category" },
    { header: "Начало периода", key: "start_qty" },
    { header: "Приход", key: "income" },
    { header: "Списание", key: "outcome" },
    { header: "Конец периода", key: "end_qty" },
  ];
  sheet.columns = headers.map((h) => ({
    ...h,
    width: h.header.length + 5,
    alignment: { horizontal: "center", vertical: "middle" },
  }));

  // Стиль заголовка
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

  // SQL для данных
  const res = await pool.query(
    `
    SELECT 
      p.id, 
      p.name, 
      c.name AS category,
      -- Начальный остаток
      COALESCE(s.quantity,0)
        + COALESCE((SELECT SUM(i.quantity) FROM income i WHERE i.product_id = p.id AND i.date < $1),0)
        - COALESCE((SELECT SUM(o.quantity) FROM outcome o WHERE o.product_id = p.id AND o.date < $1),0) AS start_qty,
      -- Приход за период
      COALESCE(SUM(i.quantity),0) AS income,
      -- Списание за период
      COALESCE(SUM(o.quantity),0) AS outcome,
      -- Конечный остаток
      COALESCE(s.quantity,0)
        + COALESCE((SELECT SUM(i.quantity) FROM income i WHERE i.product_id = p.id AND i.date <= $2),0)
        - COALESCE((SELECT SUM(o.quantity) FROM outcome o WHERE o.product_id = p.id AND o.date <= $2),0) AS end_qty
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
  res.rows.forEach((r, idx) => {
    const row = sheet.addRow(r);

    // Зебра
    if (idx % 2 === 1) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAF1FB" },
      };
    }

    // Цвета по количеству
    const qtyCells = ["start_qty", "end_qty"];
    qtyCells.forEach((k) => {
      const cell = row.getCell(k);
      if (cell.value === 0) {
        cell.font = { color: { argb: "FFFF0000" }, bold: true };
      } else if (cell.value < 50) {
        cell.font = { color: { argb: "FFFFA500" }, bold: true };
      }
    });

    // Границы
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Легенда
  const legendStartRow = sheet.rowCount + 2;
  const legend = [
    ["Цвет", "Обозначение"],
    ["Красный", "Остаток = 0"],
    ["Оранжевый", "Остаток < 50"],
    ["Белый", "Остаток >= 50"],
  ];
  legend.forEach((r, i) => {
    const row = sheet.addRow(r);
    if (i === 0) {
      row.font = { bold: true };
      row.alignment = { horizontal: "center" };
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      row.font.color = { argb: "FFFFFFFF" };
    } else {
      // Цвет ячейки
      const colorMap = {
        Красный: "FFFF0000",
        Оранжевый: "FFFFA500",
        Белый: "FFFFFFFF",
      };
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorMap[r[0]] },
      };
    }
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  const fileName = `stock_report_${Date.now()}.xlsx`;
  const filePath = path.join(reportsFolder, fileName);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = { generateExcelReport };
