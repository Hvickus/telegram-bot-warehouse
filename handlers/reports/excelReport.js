async function generateExcelReport(period) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Заголовки с жирным шрифтом и заливкой
  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Название", key: "name", width: 30 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Остаток", key: "quantity", width: 12 },
    { header: "Приход", key: "income", width: 12 },
    { header: "Списание", key: "outcome", width: 12 },
  ];

  // Оформление заголовка
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" }, // синий фон
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // SQL-запрос с фильтром по периоду
  let dateCondition = "";
  if (period === "today") dateCondition = "AND i.date >= CURRENT_DATE";
  else if (period === "month")
    dateCondition = "AND i.date >= date_trunc('month', CURRENT_DATE)";
  else dateCondition = "AND i.date >= NOW() - INTERVAL '7 days'";

  const query = `
    SELECT p.id, p.name, c.name AS category,
           COALESCE(s.quantity,0) AS quantity,
           COALESCE(SUM(i.quantity),0) AS income,
           COALESCE(SUM(o.quantity),0) AS outcome
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN income i ON i.product_id = p.id ${dateCondition.replace(
      /i.date/g,
      "i.date"
    )}
    LEFT JOIN outcome o ON o.product_id = p.id ${dateCondition.replace(
      /i.date/g,
      "o.date"
    )}
    GROUP BY p.id, p.name, c.name, s.quantity
    ORDER BY p.id
  `;

  const res = await pool.query(query);

  res.rows.forEach((r) => {
    const row = sheet.addRow(r);

    // Выделяем товары с остатком <5 красным цветом
    if (r.quantity < 5) {
      row.getCell("quantity").font = {
        color: { argb: "FFFF0000" },
        bold: true,
      };
    }
  });

  // Альтернативная окраска строк для удобства чтения
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAF1FB" }, // светло-синий фон
      };
    }
  });

  const filePath = path.join(reportsFolder, `stock_report_${period}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}
