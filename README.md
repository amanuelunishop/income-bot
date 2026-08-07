# Ledger — income tracker site

A simple login-protected website: log today's income and withdrawal, see the
last 7 entries, and view weekly/monthly totals with net. Backend is Supabase.
No server of your own needed — this is a static site.

## 1. Set up Supabase (free, no card required)

1. Go to supabase.com → New project.
2. Once it's created, go to **SQL Editor** → New query, paste the contents
   of `schema.sql`, and run it. This creates the `entries` table and locks
   it down with Row Level Security so each user only ever sees their own data.
3. Go to **Settings → API**. Copy the **Project URL** and the **anon public** key.
4. Open `config.js` and paste those two values in.

> The anon key is *meant* to be public — it's normal and safe for it to be
> visible if someone right-clicks → Inspect. It doesn't grant access to
> anyone's data by itself; Row Level Security (from `schema.sql`) is what
> actually enforces that each signed-in user can only read/write their own
> rows. Never put your Supabase **service_role** key in this site — that one
> *is* secret and bypasses RLS entirely; it only belongs in the bot's server-side code.

5. Still in Supabase: **Authentication → Providers**, make sure Email is
   enabled. Under **Authentication → Settings**, you can turn off "Confirm
   email" if you want signup to work instantly without an email step
   (fine for a personal tool with one or two users).

## 2. Host the site (free, no card required)

Any static host works. Two good no-card options:

- **Cloudflare Pages**: pages.cloudflare.com → sign up → Create a project →
  drag and drop this folder (`index.html`, `style.css`, `app.js`, `config.js`).
- **Netlify**: app.netlify.com/drop → drag and drop this folder. You get a
  live URL immediately.

Either way, no build step is needed — it's plain HTML/CSS/JS.

## 3. Use it

- Open the site, sign up with an email + password.
- Log today's income/withdrawal any time — saving again the same day updates
  that day's entry rather than creating a duplicate.
- Switch tabs to see this week's or this month's entries and net total.

## 4. Bot integration (next step)

Once you share your current `index.js`, I'll add `/weekly` and `/monthly`
commands so the bot can pull totals from this same Supabase table and send
them to you on Telegram — using the **service_role** key on the bot's server
only (never in this website), so it can read every entry needed for the report.
