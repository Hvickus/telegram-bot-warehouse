const ExcelJS = require("exceljs");
const pool = require("../db");
const path = require("path");

module.exports = async function generateAdvancedStockReport() {
  const workbook = new ExcelJS.Workbook();

  // --- Лист "Отчёт по складу" ---
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Шапка отчёта
  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = "Отчёт по складу (последние 7 дней)";
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  // Заголовки колонок
  sheet.addRow(["ID", "Товар", "Остаток", "Приход за неделю", "Списание за неделю"]);
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(2).alignment = { horizontal: "center" };

  // Получение данных
  const res = await pool.query(`
    SELECT p.id, p.name,
           COALESCE(s.quantity,0) AS stock,
           COALESCE(SUM(i.quantity),0) AS income,
           COALESCE(SUM(o.quantity),0) AS outcome
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN income i ON i.product_id = p.id AND i.date >= NOW() - INTERVAL '7 days'
    LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= NOW() - INTERVAL '7 days'
    GROUP BY p.id, p.name, s.quantity
    ORDER BY p.name
  `);

  res.rows.forEach((p) => {
    sheet.addRow([p.id, p.name, p.stock, p.income, p.outcome]);
  });

  // Настройка ширины колонок
  sheet.columns.forEach((col) => {
    col.width = 15;
  });

  // Сохраняем файл
  const filePath = path.join(__dirname, "../reports/advanced_stock_report.xlsx");
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};
