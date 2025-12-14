const ExcelJS = require("exceljs");
const pool = require("../db");
const fs = require("fs");
const path = require("path");

async function generateStockReport() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Складской отчет");

  // Заголовки
  sheet.columns = [
    { header: "№", key: "index", width: 5 },
    { header: "ID товара", key: "id", width: 10 },
    { header: "Наименование", key: "name", width: 30 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Остаток на складе", key: "quantity", width: 18 },
    { header: "Минимальный остаток", key: "min_qty", width: 18 },
    { header: "Статус", key: "status", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const res = await pool.query(`
    SELECT p.id, p.name, c.name AS category, COALESCE(s.quantity,0) AS quantity
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s ON s.product_id = p.id
    ORDER BY p.id
  `);

  const MIN_QTY = 5;

  res.rows.forEach((p, idx) => {
    const status = p.quantity < MIN_QTY ? "⚠️ Низкий остаток" : "OK";
    const row = sheet.addRow({
      index: idx + 1,
      id: p.id,
      name: p.name,
      category: p.category || "-",
      quantity: p.quantity,
      min_qty: MIN_QTY,
      status,
    });

    // Цвет ячейки «Статус»
    row.getCell("status").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: p.quantity < MIN_QTY ? "FFFFC7CE" : "FFC6EFCE" },
    };
  });

  // Создаем папку reports, если нет
  const reportsDir = path.join(__dirname, "../reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

  const filePath = path.join(reportsDir, "stock_report.xlsx");
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = generateStockReport;
