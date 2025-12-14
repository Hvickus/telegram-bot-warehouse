const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const pool = require("../../db");
const logUserAction = require("../../utils/logUserAction");
const { Markup } = require("telegraf");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const safeEditMessage = require("../../utils/safeEditMessage");

const REPORTS_DIR = path.join(__dirname, "../../reports");
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

/**
 * Генерация Excel отчёта по fn_stock_report
 */
async function generateExcelReport(fromDate, toDate) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Заголовки
  const columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Название", key: "name", width: 30 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Остаток на начало", key: "start_qty", width: 15 },
    { header: "Приход", key: "income", width: 12 },
    { header: "Списание", key: "outcome", width: 12 },
    { header: "Остаток на конец", key: "end_qty", width: 15 },
  ];
  sheet.columns = columns;

  // Стиль заголовков
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Получаем данные через функцию fn_stock_report
  const res = await pool.query("SELECT * FROM fn_stock_report($1, $2)", [
    fromDate,
    toDate,
  ]);

  // Добавляем строки и применяем цветовое оформление
  res.rows.forEach((r, index) => {
    const row = sheet.addRow(r);
    row.alignment = { vertical: "middle", horizontal: "center" };

    ["start_qty", "end_qty"].forEach((key) => {
      const cell = row.getCell(key);
      if (cell.value === 0)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF0000" },
        };
      else if (cell.value < 50)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFF00" },
        };
      else
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF00FF00" },
        };
    });

    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = cell.fill || {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAF1FB" },
        };
      });
    }

    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Легенда справа от таблицы
  const legendStartCol = columns.length + 2;
  const legendRows = [
    { text: "0 — красный", color: "FFFF0000" },
    { text: "<50 — желтый", color: "FFFFFF00" },
    { text: ">=50 — зеленый", color: "FF00FF00" },
  ];

  legendRows.forEach((l, i) => {
    const cell = sheet.getRow(i + 2).getCell(legendStartCol);
    cell.value = l.text;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: l.color },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Автоширина колонок
  sheet.columns.forEach((c) => {
    let maxLength = 10;
    c.eachCell({ includeEmpty: true }, (cell) => {
      const len = cell.value ? cell.value.toString().length : 0;
      if (len > maxLength) maxLength = len;
    });
    c.width = maxLength + 2;
  });

  const filePath = path.join(
    REPORTS_DIR,
    `Отчет по остаткам ${Date.now()}.xlsx`
  );
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

/**
 * Регистрация обработчиков для Excel-отчёта
 */
function registerExcelReport(bot) {
  bot.action("excel_report", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    ctx.session = ctx.session || {};
    ctx.session.flow = "excel_report";
    await safeEditMessage(
      ctx,
      "Введите период отчёта в формате: YYYY-MM-DD - YYYY-MM-DD"
    );
  });

  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "excel_report") return next();

    const input = ctx.message.text.trim();
    const match = input.match(
      /^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/
    );
    if (!match)
      return ctx.reply("Неверный формат. Используйте: YYYY-MM-DD - YYYY-MM-DD");

    const fromDate = new Date(match[1]);
    const toDate = new Date(match[2]);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()))
      return ctx.reply("Некорректные даты.");

    await safeAnswerCbQuery(ctx);
    await safeEditMessage(ctx, "Генерируем Excel отчёт, подождите...");

    try {
      const filePath = await generateExcelReport(fromDate, toDate);

      // Логируем действие пользователя
      await logUserAction(
        ctx.from.id,
        "generate_excel_report",
        `Период: ${match[1]} - ${match[2]}`
      );

      // Отправляем Excel
      await ctx.replyWithDocument({
        source: filePath,
        filename: path.basename(filePath),
      });

      // Восстанавливаем меню после отчёта
      await safeEditMessage(
        ctx,
        "Excel-отчёт готов. Выберите действие:",
        Markup.inlineKeyboard([
          [Markup.button.callback("📊 Отчёты по складу", "menu_reports")],
          [Markup.button.callback("⬅️ Назад", "main_menu")],
        ])
      );

      delete ctx.session.flow;
    } catch (err) {
      console.error("Ошибка генерации Excel отчёта:", err);
      await ctx.reply("Ошибка при генерации отчёта.");
    }
  });
}

module.exports = { generateExcelReport, registerExcelReport };
