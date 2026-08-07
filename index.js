require('dotenv').config();
const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const db = require('./db');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in .env file. See README.md for setup steps.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- helpers ---
function todayStr() {
  // YYYY-MM-DD in Ethiopia time
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
}

function fmt(n) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' birr';
}

function sumWhere(clause, param) {
  return db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM entries WHERE ${clause}`).get(param).t;
}

// --- commands ---
bot.start((ctx) => {
  ctx.reply(
    `Welcome! Your Telegram chat ID is: ${ctx.chat.id}\n\n` +
    `Copy this into your .env file as OWNER_CHAT_ID, then restart the bot so daily reminders work.\n\n` +
    `How to use me:\n` +
    `• Just type a number (e.g. 500) to log today's income\n` +
    `• /withdraw 200 rent — log a withdrawal, note optional\n` +
    `• /today — today's summary\n` +
    `• /report — this month's report\n` +
    `• /report 2026-07 — a specific month\n` +
    `• /balance — your all-time net money\n` +
    `• /undo — remove your last entry (fix mistakes)\n` +
    `• /help — show this again`
  );
});

bot.help((ctx) => {
  ctx.reply(
    `Commands:\n` +
    `• Type a number to log income\n` +
    `• /withdraw <amount> [note]\n` +
    `• /today\n` +
    `• /report [YYYY-MM]\n` +
    `• /balance\n` +
    `• /undo`
  );
});

// plain number -> income
bot.hears(/^\d+(\.\d+)?$/, (ctx) => {
  const amount = parseFloat(ctx.message.text);
  const date = todayStr();
  db.prepare('INSERT INTO entries (type, amount, note, date, created_at) VALUES (?,?,?,?,?)')
    .run('income', amount, null, date, new Date().toISOString());
  const todayTotal = sumWhere("type='income' AND date=?", date);
  ctx.reply(`✅ Logged ${fmt(amount)} income for today.\nToday's total income: ${fmt(todayTotal)}`);
});

bot.command('withdraw', (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  const amount = parseFloat(parts[0]);
  if (!amount || isNaN(amount)) {
    return ctx.reply('Usage: /withdraw 200 rent payment');
  }
  const note = parts.slice(1).join(' ') || null;
  const date = todayStr();
  db.prepare('INSERT INTO entries (type, amount, note, date, created_at) VALUES (?,?,?,?,?)')
    .run('withdrawal', amount, note, date, new Date().toISOString());
  ctx.reply(`💸 Logged ${fmt(amount)} withdrawal${note ? ' (' + note + ')' : ''}.`);
});

bot.command('today', (ctx) => {
  const date = todayStr();
  const income = sumWhere("type='income' AND date=?", date);
  const withdrawal = sumWhere("type='withdrawal' AND date=?", date);
  ctx.reply(
    `📅 Today (${date})\n` +
    `Income: ${fmt(income)}\n` +
    `Withdrawals: ${fmt(withdrawal)}\n` +
    `Net today: ${fmt(income - withdrawal)}`
  );
});

bot.command('report', (ctx) => {
  const arg = ctx.message.text.split(' ')[1];
  const month = arg || todayStr().slice(0, 7); // YYYY-MM
  const income = sumWhere("type='income' AND date LIKE ?", month + '%');
  const withdrawal = sumWhere("type='withdrawal' AND date LIKE ?", month + '%');
  const count = db.prepare('SELECT COUNT(*) as c FROM entries WHERE date LIKE ?').get(month + '%').c;
  ctx.reply(
    `📊 Report for ${month}\n\n` +
    `Total income: ${fmt(income)}\n` +
    `Total withdrawals: ${fmt(withdrawal)}\n` +
    `Net for month: ${fmt(income - withdrawal)}\n` +
    `Entries logged: ${count}`
  );
});

bot.command('balance', (ctx) => {
  const income = sumWhere("type='income'", null);
  const withdrawal = sumWhere("type='withdrawal'", null);
  ctx.reply(
    `💰 All-time balance\n` +
    `Total income: ${fmt(income)}\n` +
    `Total withdrawals: ${fmt(withdrawal)}\n` +
    `Net money you have: ${fmt(income - withdrawal)}`
  );
});

bot.command('undo', (ctx) => {
  const last = db.prepare('SELECT * FROM entries ORDER BY id DESC LIMIT 1').get();
  if (!last) return ctx.reply('No entries to undo.');
  db.prepare('DELETE FROM entries WHERE id=?').run(last.id);
  ctx.reply(`Removed last entry: ${last.type} of ${fmt(last.amount)} on ${last.date}`);
});

// --- daily evening reminder, 8:00 PM Ethiopia time ---
if (OWNER_CHAT_ID) {
  cron.schedule('0 20 * * *', () => {
    bot.telegram.sendMessage(
      OWNER_CHAT_ID,
      "🔔 Evening reminder: don't forget to log today's income! Just type the amount, e.g. 500"
    );
  }, { timezone: 'Africa/Addis_Ababa' });
  console.log('Daily reminder scheduled for 8:00 PM Africa/Addis_Ababa.');
} else {
  console.log('OWNER_CHAT_ID not set yet — reminders are off. Send /start to the bot to get your chat ID.');
}

bot.launch();
console.log('Bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
