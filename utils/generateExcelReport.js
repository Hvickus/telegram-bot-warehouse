const ExcelJS = require("exceljs");
const pool = require("../db");

async function generateAdvancedStockReport() {
  // Получаем данные
  const res = await pool.query(`
    SELECT p.id, p.name, 
           COALESCE(s.quantity,0) AS stock,
           COALESCE(SUM(i.quantity),0) AS income_last_week,
           COALESCE(SUM(o.quantity),0) AS outcome_last_week
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN income i ON i.product_id = p.id AND i.date >= NOW() - INTERVAL '7 days'
    LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= NOW() - INTERVAL '7 days'
    GROUP BY p.id, p.name, s.quantity
    ORDER BY p.name
  `);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Шапка отчёта
  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = "Отчёт по складу (последние 7 дней)";
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  // Заголовки колонок
  sheet.columns = [
    { header: "ID", key: "id", width: 5 },
    { header: "Товар", key: "name", width: 30 },
    { header: "Остаток", key: "stock", width: 12 },
    { header: "Приход за неделю", key: "income_last_week", width: 15 },
    { header: "Списание за неделю", key: "outcome_last_week", width: 15 },
  ];

  sheet.getRow(2).font = { bold: true };
  sheet.getRow(2).alignment = { horizontal: "center" };

  // Цветные полосы для читаемости (зебра)
  res.rows.forEach((row, index) => {
    const excelRow = sheet.addRow(row);
    if (index % 2 === 0) {
      excelRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFEFEF" },
      };
    }

    // Минимальные остатки <5 красным
    if (row.stock < 5) {
      excelRow.getCell("stock").font = { color: { argb: "FFFF0000" }, bold: true };
    }

    // Динамика: зелёный если прирост, красный если убыль
    const net = row.income_last_week - row.outcome_last_week;
    if (net > 0) {
      excelRow.getCell("income_last_week").font = { color: { argb: "FF00AA00" } };
      excelRow.getCell("outcome_last_week").font = { color: { argb: "FF000000" } };
    } else if (net < 0) {
      excelRow.getCell("income_last_week").font = { color: { argb: "FF000000" } };
      excelRow.getCell("outcome_last_week").font = { color: { argb: "FFFF0000" } };
    }
  });

  // Итоговая строка
  const totalRow = sheet.addRow([
    "Итого",
    "",
    { formula: `SUM(C3:C${sheet.rowCount})` },
    { formula: `SUM(D3:D${sheet.rowCount})` },
    { formula: `SUM(E3:E${sheet.rowCount})` },
  ]);
  totalRow.font = { bold: true };
  totalRow.alignment = { horizontal: "center" };

  // Добавляем график (диаграмму) – сток vs приход/списание
  const chartSheet = workbook.addWorksheet("График движения");

  chartSheet.addRow(["Товар", "Остаток", "Приход", "Списание"]);
  res.rows.forEach((row) => {
    chartSheet.addRow([row.name, row.stock, row.income_last_week, row.outcome_last_week]);
  });

  // Цветные полосы для графика
  chartSheet.eachRow((r, index) => {
    if (index === 1) return;
    if (index % 2 === 0) {
      r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    }
  });

  const filePath = "advanced_stock_report.xlsx";
  await workbook.xlsx.writeFile(filePath);
  console.log("✅ Продвинутый Excel отчёт сформирован:", filePath);
  return filePath;
}

module.exports = generateAdvancedStockReport;
