const ExcelJS = require("exceljs");
const pool = require("../../db");
const { Markup } = require("telegraf");
const replyOrEdit = require("../../utils/replyOrEdit");
const safeAnswerCbQuery = require("../../utils/safeAnswerCbQuery");
const fs = require("fs");
const path = require("path");

// Папка для временных файлов отчёта
const REPORTS_DIR = path.join(__dirname, "../../reports");
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

async function generateExcelReport(ctx, fromDate, toDate) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт по складу");

  // Заголовки столбцов
  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Название", key: "name", width: 30 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Остаток", key: "quantity", width: 10 },
    { header: "Приход", key: "income", width: 10 },
    { header: "Списание", key: "outcome", width: 10 },
  ];

  // Получаем данные по товарам и движениям
  const res = await pool.query(
    `
    SELECT p.id, p.name, c.name AS category,
           COALESCE(s.quantity,0) AS quantity,
           COALESCE(SUM(i.quantity),0) AS income,
           COALESCE(SUM(o.quantity),0) AS outcome
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN income i ON i.product_id = p.id AND i.date >= $1 AND i.date <= $2
    LEFT JOIN outcome o ON o.product_id = p.id AND o.date >= $1 AND o.date <= $2
    GROUP BY p.id, p.name, c.name, s.quantity
    ORDER BY p.name
    `,
    [fromDate, toDate]
  );

  res.rows.forEach((r) => {
    sheet.addRow({
      id: r.id,
      name: r.name,
      category: r.category || "-",
      quantity: r.quantity,
      income: r.income,
      outcome: r.outcome,
    });
  });

  // Сохраняем файл временно
  const filePath = path.join(REPORTS_DIR, `stock_report_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  // Отправляем пользователю
  await ctx.replyWithDocument({ source: filePath });

  // Удаляем файл после отправки
  fs.unlinkSync(filePath);
}

module.exports = function (bot) {
  bot.action("excel_report", async (ctx) => {
    await safeAnswerCbQuery(ctx);

    await replyOrEdit(ctx, "Выберите период для Excel отчёта:", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📅 Сегодня", "excel_today")],
        [Markup.button.callback("📆 Этот месяц", "excel_month")],
        [Markup.button.callback("🗓 Выбрать период", "excel_custom")],
        [Markup.button.callback("🔙 Назад", "back_main")],
      ]),
    });
  });

  bot.action("excel_today", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const today = new Date();
    const from = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const to = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59
    );

    await replyOrEdit(ctx, "Генерация отчёта за сегодня...");
    await generateExcelReport(ctx, from, to);
  });

  bot.action("excel_month", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await replyOrEdit(ctx, "Генерация отчёта за текущий месяц...");
    await generateExcelReport(ctx, from, to);
  });

  bot.action("excel_custom", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    ctx.session = ctx.session || {};
    ctx.session.flow = "excel_custom";
    await replyOrEdit(
      ctx,
      "Введите начальную и конечную дату в формате YYYY-MM-DD - YYYY-MM-DD"
    );
  });

  bot.on("text", async (ctx, next) => {
    const s = ctx.session;
    if (!s || s.flow !== "excel_custom") return next();

    const match = ctx.message.text.match(
      /^(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})$/
    );
    if (!match) return replyOrEdit(ctx, "Неверный формат. Попробуйте снова.");

    const from = new Date(match[1]);
    const to = new Date(match[2]);
    to.setHours(23, 59, 59);

    s.flow = null;
    await replyOrEdit(ctx, "Генерация отчёта за указанный период...");
    await generateExcelReport(ctx, from, to);
  });
};
