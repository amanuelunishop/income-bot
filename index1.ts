// supabase/functions/daily-reminder/index.ts
//
// Sends a nightly Amharic reminder to your Telegram chat: "put today's income".
// Triggered by pg_cron (see the SCHEDULING block at the bottom of schema.sql) —
// you don't call this yourself, and it doesn't need the app to be open.
//
// Secrets needed (set once, see README §4):
//   TELEGRAM_BOT_TOKEN   — from @BotFather
//   TELEGRAM_CHAT_ID     — your personal chat id

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')!;

const REMINDER_TEXT =
  '🌙 እባክዎ የዛሬውን ገቢ ያስገቡ።\n' +
  '(Please enter today\'s income.)';

Deno.serve(async (req) => {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: REMINDER_TEXT,
        }),
      }
    );

    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram error:', data);
      return new Response(JSON.stringify({ ok: false, error: data }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
