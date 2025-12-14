const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const pool = require("../../db");

const reportsFolder = path.join(__dirname, "../../reports");
if (!fs.existsSync(reportsFolder)) {
  fs.mkdirSync(reportsFolder, { recursive: true });
}

async function generateExcelReport(fromDate, toDate) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Склад");

  /*
   * ====== ШАПКА ОТЧЁТА ======
   */
  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = "Отчёт по складу";
  sheet.getCell("A1").font = { size: 16, bold: true };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:F2");
  sheet.getCell(
    "A2"
  ).value = `Период: ${fromDate.toLocaleDateString()} — ${toDate.toLocaleDateString()}`;
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.addRow([]);

  /*
   * ====== ЗАГОЛОВКИ ТАБЛИЦЫ ======
   */
  const headerRow = sheet.addRow([
    "ID",
    "Товар",
    "Категория",
    "Остаток на начало",
    "Приход",
    "Списание",
    "Остаток на конец",
  ]);

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  /*
   * ====== ДАННЫЕ ======
   */
  const res = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      c.name AS category,

      COALESCE((
        SELECT SUM(i.quantity) - SUM(o.quantity)
        FROM income i
        FULL JOIN outcome o ON o.product_id = i.product_id
        WHERE i.product_id = p.id
          AND COALESCE(i.date, o.date) < $1
      ), 0) AS start_qty,

      COALESCE(SUM(i2.quantity), 0) AS income,
      COALESCE(SUM(o2.quantity), 0) AS outcome,

      COALESCE((
        SELECT SUM(i.quantity) - SUM(o.quantity)
        FROM income i
        FULL JOIN outcome o ON o.product_id = i.product_id
        WHERE i.product_id = p.id
          AND COALESCE(i.date, o.date) <= $2
      ), 0) AS end_qty

    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN income i2 ON i2.product_id = p.id AND i2.date BETWEEN $1 AND $2
    LEFT JOIN outcome o2 ON o2.product_id = p.id AND o2.date BETWEEN $1 AND $2
    GROUP BY p.id, p.name, c.name
    ORDER BY p.name
    `,
    [fromDate, toDate]
  );

  res.rows.forEach((r) => {
    const row = sheet.addRow([
      r.id,
      r.name,
      r.category || "-",
      r.start_qty,
      r.income,
      r.outcome,
      r.end_qty,
    ]);

    row.eachCell((cell, col) => {
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 2 ? "left" : "center",
      };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    const endQtyCell = row.getCell(7);

    if (r.end_qty === 0) {
      endQtyCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC7CE" },
      };
    } else if (r.end_qty < 5) {
      endQtyCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEB9C" },
      };
    } else {
      endQtyCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC6EFCE" },
      };
    }
  });

  /*
   * ====== АВТОШИРИНА ======
   */
  sheet.columns.forEach((column) => {
    let max = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value ? cell.value.toString().length : 0;
      max = Math.max(max, len);
    });
    column.width = max + 2;
  });

  /*
   * ====== ЛЕГЕНДА ======
   */
  sheet.getCell("I5").value = "Легенда:";
  sheet.getCell("I5").font = { bold: true };

  sheet.getCell("I6").value = "0 — нет товара";
  sheet.getCell("I6").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFC7CE" },
  };

  sheet.getCell("I7").value = "< 5 — низкий остаток";
  sheet.getCell("I7").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFEB9C" },
  };

  sheet.getCell("I8").value = "≥ 5 — норма";
  sheet.getCell("I8").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC6EFCE" },
  };

  const filePath = path.join(reportsFolder, `stock_report_${Date.now()}.xlsx`);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = { generateExcelReport };
