const ExcelJS = require("exceljs");
const pool = require("../../db");
const path = require("path");
const fs = require("fs");

const reportsFolder = path.join(__dirname, "../../reports");
if (!fs.existsSync(reportsFolder))
  fs.mkdirSync(reportsFolder, { recursive: true });

/**
 * Генерация Excel-отчёта
 * fromDate, toDate - объекты Date
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
    { header: "Начало периода", key: "start_qty", width: 15 },
    { header: "Приход", key: "income", width: 12 },
    { header: "Списание", key: "outcome", width: 12 },
    { header: "Конец периода", key: "end_qty", width: 15 },
  ];

  // Стили для заголовка
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // Получение данных
  const query = `
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
  `;

  const res = await pool.query(query, [fromDate, toDate]);

  res.rows.forEach((r, idx) => {
    const row = sheet.addRow(r);

    // Центрирование всех ячеек
    row.eachCell((cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Конечный остаток (7-я колонка)
    const endCell = row.getCell(7);
    if (endCell.value === 0) {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      };
      endCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    } else if (endCell.value > 0 && endCell.value < 50) {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFA500" },
      };
      endCell.font = { bold: true, color: { argb: "FF000000" } };
    } else if (endCell.value < 0) {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB0B0B0" },
      };
      endCell.font = { bold: true, color: { argb: "FF000000" } };
    }

    // Зебра-стиль для остальных ячеек
    if ((idx + 1) % 2 === 0) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 7) {
          // не перекрывать конечный остаток
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEAF1FB" },
          };
        }
      });
    }
  });

  // Автоширина по содержимому
  sheet.columns.forEach((col) => {
    let maxLength = col.header.length;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value ? cell.value.toString() : "";
      if (val.length > maxLength) maxLength = val.length;
    });
    col.width = maxLength + 2;
  });

  // Легенда цветов
  const legendRow = sheet.addRow([]);
  sheet.mergeCells(`A${sheet.lastRow.number}:C${sheet.lastRow.number}`);
  const cellLegend = sheet.getCell(`A${sheet.lastRow.number}`);
  cellLegend.value = "Легенда: Красный = 0, Оранжевый <50, Серый <0";
  cellLegend.font = { italic: true, bold: true };
  cellLegend.alignment = { horizontal: "left", vertical: "middle" };

  // Даты отчёта сверху
  sheet.insertRow(1, [
    `Отчёт с ${fromDate.toISOString().slice(0, 10)} по ${toDate
      .toISOString()
      .slice(0, 10)}`,
  ]);
  sheet.mergeCells(`A1:G1`);
  const topCell = sheet.getCell("A1");
  topCell.alignment = { horizontal: "center" };
  topCell.font = { bold: true, size: 14 };

  const filePath = path.join(reportsFolder, `stock_report_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = { generateExcelReport };
