const ExcelJS = require("exceljs");
const pool = require("../../db");
const fs = require("fs");
const path = require("path");

const REPORTS_DIR = path.join(__dirname, "../../reports");
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

async function generateExcelReport(ctx, fromDate, toDate) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  /* ===== Заголовок ===== */
  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  sheet.mergeCells("A1:H1");
  sheet.getCell(
    "A1"
  ).value = `Отчёт по складу за период: ${fromStr} — ${toStr}`;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.addRow([]);

  /* ===== Колонки ===== */
  sheet.columns = [
    { header: "ID", key: "id" },
    { header: "Название", key: "name" },
    { header: "Категория", key: "category" },
    { header: "Начальный остаток", key: "begin_qty" },
    { header: "Приход", key: "income" },
    { header: "Списание", key: "outcome" },
    { header: "Конечный остаток", key: "end_qty" },
  ];

  const headerRow = sheet.getRow(3);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };
  });

  /* ===== SQL ===== */
  const sql = `
    WITH movements_after AS (
      SELECT
        p.id,
        COALESCE(SUM(i.quantity), 0) AS income_after,
        COALESCE(SUM(o.quantity), 0) AS outcome_after
      FROM products p
      LEFT JOIN income i
        ON i.product_id = p.id
       AND i.date > $2
      LEFT JOIN outcome o
        ON o.product_id = p.id
       AND o.date > $2
      GROUP BY p.id
    ),
    movements_period AS (
      SELECT
        p.id,
        COALESCE(SUM(i.quantity), 0) AS income_period,
        COALESCE(SUM(o.quantity), 0) AS outcome_period
      FROM products p
      LEFT JOIN income i
        ON i.product_id = p.id
       AND i.date >= $1
       AND i.date <= $2
      LEFT JOIN outcome o
        ON o.product_id = p.id
       AND o.date >= $1
       AND o.date <= $2
      GROUP BY p.id
    )
    SELECT
      p.id,
      p.name,
      c.name AS category,

      (
        COALESCE(s.quantity, 0)
          - ma.income_after
          + ma.outcome_after
          - mp.income_period
          + mp.outcome_period
      ) AS begin_qty,

      mp.income_period AS income,
      mp.outcome_period AS outcome,

      (
        COALESCE(s.quantity, 0)
          - ma.income_after
          + ma.outcome_after
      ) AS end_qty

    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN movements_after ma ON ma.id = p.id
    LEFT JOIN movements_period mp ON mp.id = p.id

    ORDER BY p.id;
  `;

  const res = await pool.query(sql, [fromDate, toDate]);

  /* ===== Данные ===== */
  res.rows.forEach((r) => {
    const row = sheet.addRow({
      id: r.id,
      name: r.name,
      category: r.category || "-",
      begin_qty: r.begin_qty,
      income: r.income,
      outcome: r.outcome,
      end_qty: r.end_qty,
    });

    row.eachCell((cell) => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    /* Раскраска конечного остатка */
    const endCell = row.getCell("end_qty");

    if (r.end_qty === 0) {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC7CE" }, // красный
      };
    } else if (r.end_qty <= 50) {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEB9C" }, // жёлтый
      };
    } else {
      endCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFC6EFCE" }, // зелёный
      };
    }
  });

  /* ===== Автоширина ===== */
  sheet.columns.forEach((col) => {
    let max = col.header.length;
    col.eachCell({ includeEmpty: true }, (cell) => {
      max = Math.max(max, String(cell.value || "").length);
    });
    col.width = max + 2;
  });

  /* ===== Легенда ===== */
  sheet.addRow([]);
  sheet.addRow(["Легенда:"]);
  sheet.addRow(["Зелёный", "Остаток > 50"]);
  sheet.addRow(["Жёлтый", "Остаток от 1 до 50"]);
  sheet.addRow(["Красный", "Остаток = 0"]);

  /* ===== Файл ===== */
  const filePath = path.join(REPORTS_DIR, `stock_report_${Date.now()}.xlsx`);

  await workbook.xlsx.writeFile(filePath);
  await ctx.replyWithDocument({ source: filePath });
  fs.unlinkSync(filePath);
}

module.exports = {
  generateExcelReport,
};
