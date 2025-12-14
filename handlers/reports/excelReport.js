const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const pool = require("../../db");

const reportsFolder = path.join(__dirname, "../../reports");
if (!fs.existsSync(reportsFolder))
  fs.mkdirSync(reportsFolder, { recursive: true });

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
    width: Math.max(h.header.length + 5, 15),
    alignment: { horizontal: "center", vertical: "middle" },
  }));

  // Стиль заголовка только для используемых колонок
  const headerRow = sheet.getRow(1);
  headers.forEach((_, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // SQL запрос
  const res = await pool.query(
    `
    SELECT 
      p.id, 
      p.name, 
      c.name AS category,
      COALESCE(s.quantity,0)
        + COALESCE((SELECT SUM(i.quantity) FROM income i WHERE i.product_id = p.id AND i.date < $1),0)
        - COALESCE((SELECT SUM(o.quantity) FROM outcome o WHERE o.product_id = p.id AND o.date < $1),0) AS start_qty,
      COALESCE(SUM(i.quantity),0) AS income,
      COALESCE(SUM(o.quantity),0) AS outcome,
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

  // Добавляем строки с данными
  res.rows.forEach((r, idx) => {
    const row = sheet.addRow(r);

    // Зебра только для существующих колонок
    if (idx % 2 === 1) {
      headers.forEach((_, colIdx) => {
        row.getCell(colIdx + 1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAF1FB" },
        };
      });
    }

    // Цвета по количеству для start_qty и end_qty
    ["start_qty", "end_qty"].forEach((k) => {
      const cell = row.getCell(k);
      if (cell.value === 0) {
        cell.font = { color: { argb: "FFFF0000" }, bold: true };
      } else if (cell.value < 50) {
        cell.font = { color: { argb: "FFFFA500" }, bold: true };
      }
    });

    // Границы всех ячеек
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Легенда справа от таблицы
  const legendCol = headers.length + 2;
  const legend = [
    ["Цвет", "Обозначение"],
    ["Красный", "Остаток = 0"],
    ["Оранжевый", "Остаток < 50"],
    ["Белый", "Остаток >= 50"],
  ];
  legend.forEach((r, i) => {
    const excelRow = sheet.getRow(i + 2); // начинаем с 2-й строки
    r.forEach((val, j) => {
      const cell = excelRow.getCell(legendCol + j);
      cell.value = val;

      // Цвет только для первой колонки
      if (j === 0) {
        const colorMap = {
          Красный: "FFFF0000",
          Оранжевый: "FFFFA500",
          Белый: "FFFFFFFF",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colorMap[val] },
        };
      }

      cell.font = { bold: i === 0 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  const fileName = `stock_report_${Date.now()}.xlsx`;
  const filePath = path.join(reportsFolder, fileName);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = { generateExcelReport };
