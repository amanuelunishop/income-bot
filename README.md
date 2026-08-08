# Ledger — income tracker site

A login-protected site: log income/withdrawal entries (each with its own
comment), see the last 7 entries, and request a PDF report for any date
range sent straight to your Telegram. A nightly Amharic reminder ("please
enter today's income") is sent to Telegram at 9pm automatically.

Backend is Supabase (database + auth + two small serverless "Edge
Functions" for the Telegram/PDF parts). No server of your own to run.

---

## 1. Database — Supabase

1. Go to supabase.com → your project → **SQL Editor** → New query.
2. Paste the contents of `schema.sql` and run it (creates the `entries`
   table with RLS, so each user only ever sees their own rows).
   - If you'd already run the *old* version of this schema before, run the
     commented-out `MIGRATION` block near the top instead of the `create
     table` block — it renames things without losing data.
3. **Settings → API**: copy the **Project URL**, the **anon public** key,
   and the **service_role** key (you'll need the service role key in step 3
   only — never put it in `config.js` or anywhere on the public website).
4. Open `config.js` and paste the Project URL + anon key in (already done
   if you're just updating an existing deploy).
5. **Authentication → Providers**: make sure Email is enabled.

## 2. Telegram bot

You said you already have a bot token from @BotFather — you'll need two
things from it:

- **Bot token** — the string BotFather gave you, like `123456:ABC-...`
- **Your chat ID** — message your bot once (anything, e.g. "hi"), then
  visit this URL in your browser (with your real token):
  `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
  Look for `"chat":{"id": ...}` in the response — that number is your chat ID.

## 3. Deploy the Edge Functions

These are the two small server-side functions in `supabase/functions/`:
- `daily-reminder` — sends the 9pm Amharic Telegram message
- `send-report` — builds the PDF and sends it to Telegram when you tap
  "Send report to Telegram" on the site

You'll need the [Supabase CLI](https://supabase.com/docs/guides/cli) once:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # found in Settings → General

supabase functions deploy daily-reminder
supabase functions deploy send-report
```

## 4. Set the secrets (never go in any file on the website)

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC-your-real-token
supabase secrets set TELEGRAM_CHAT_ID=your-numeric-chat-id
```

(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically into Edge Functions by Supabase — you don't set
those yourself.)

## 5. Schedule the 9pm reminder

In the SQL Editor, run the two `create extension` lines near the bottom of
`schema.sql`, then uncomment and run the `cron.schedule(...)` block —
filling in your project ref and **service_role** key (Settings → API).
`0 18 * * *` = 18:00 UTC = 21:00 (9pm) Addis Ababa time.

Check it's active: `select * from cron.job;`

## 6. Host the site

Same as before — any static host works, no build step:
- **Cloudflare Pages**: pages.cloudflare.com → Create a project → drag and
  drop this folder (`index.html`, `style.css`, `app.js`, `config.js` —
  the `supabase/` folder is *not* part of the website, it only gets
  deployed via the CLI command above).
- **Netlify**: app.netlify.com/drop → drag and drop the same four files.

## 7. Use it

- Sign in, log income and/or withdrawal any time — each save adds a new
  entry (doesn't overwrite the day's earlier ones) and clears the form so
  you can log the next one right away. Each amount gets its own comment
  ("client payment", "supplier restock", etc.).
- **Report tab**: pick a from/to date range (or tap "This month"), tap
  **Send report to Telegram** — you'll get a PDF in your Telegram chat
  listing every entry in that range with its comment, plus totals.
- Every night at 9pm you'll get an Amharic reminder on Telegram if you
  haven't logged anything.

## Notes

- If the Amharic text in the PDF ever shows as boxes instead of letters,
  the font URL the `send-report` function fetches
  (`NotoSansEthiopic-Regular.ttf` from the Noto fonts GitHub repo) has
  probably moved — download any Noto Sans Ethiopic `.ttf`, upload it to a
  public Supabase Storage bucket, and swap in that URL inside
  `supabase/functions/send-report/index.ts`.
- The reminder only fires once at 9pm; it doesn't check whether you've
  already logged today's income first (Supabase's free `pg_cron` schedule
  doesn't easily support "only if" logic). If you want it to skip nights
  you've already logged something, say so and I can add that check.
