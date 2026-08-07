# Income Bot — Setup Guide (step by step)

This is a Telegram bot that lives on your phone/computer via chat. You type numbers to it,
and it remembers everything and gives you reports.

## Step 1: Create your bot on Telegram (2 minutes)

1. Open Telegram, search for **@BotFather**, and start a chat with it.
2. Send: `/newbot`
3. Give it a name (e.g. "My Income Tracker") and a username ending in `bot` (e.g. `emmanuel_income_bot`).
4. BotFather will reply with a **token** that looks like `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
   **Copy this token** — you'll need it in Step 3.

## Step 2: Install Node.js (one-time, if you don't have it)

1. Go to https://nodejs.org and install the **LTS** version for your OS.
2. Confirm it worked by opening a terminal (Command Prompt on Windows) and running:
   ```
   node -v
   ```
   You should see a version number like `v20.x.x`.

## Step 3: Set up the bot files

1. Unzip/open the `income-bot` folder you downloaded.
2. Inside that folder, make a copy of `.env.example` and rename it to `.env`.
3. Open `.env` in any text editor and paste your token:
   ```
   BOT_TOKEN=123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   OWNER_CHAT_ID=
   ```
   (Leave `OWNER_CHAT_ID` empty for now — you'll fill it in Step 5.)

## Step 4: Install and run

Open a terminal **inside the `income-bot` folder** and run:

```
npm install
npm start
```

You should see:
```
Bot is running...
```

Leave this terminal open — the bot only works while this is running.

## Step 5: Connect your Telegram account

1. In Telegram, search for the bot username you created in Step 1 and open a chat with it.
2. Send `/start`.
3. The bot will reply with your **chat ID** (a number).
4. Copy that number into your `.env` file as `OWNER_CHAT_ID=892403321` (example).
5. Stop the bot (Ctrl+C in the terminal) and run `npm start` again so it picks up the change.

Now the daily 8:00 PM reminder will work too.

## Step 6: Try it out

- Send `500` → logs 500 birr income for today.
- Send `/withdraw 200 transport` → logs a 200 birr withdrawal with a note.
- Send `/today` → today's totals.
- Send `/report` → this month's report.
- Send `/report 2026-07` → a specific month's report.
- Send `/balance` → your all-time net money (income minus withdrawals).
- Send `/undo` → removes your last entry if you made a typo.

## Step 7 (important): Keep it running 24/7

Right now the bot only works while `npm start` is running on your computer. For reminders
to arrive every evening even when your laptop is off, you need to host it somewhere that
stays on. Two easy free options:

- **Railway** (https://railway.app) — connect your GitHub repo, it runs the bot for you.
- **Render** (https://render.com) — same idea, free tier background worker.

Both just need your `BOT_TOKEN` and `OWNER_CHAT_ID` added as environment variables in their
dashboard (same values as your `.env` file). Tell me if you want, and I'll walk you through
deploying to either one step by step.

## Your data

All entries are stored in a file called `income.db` inside the bot folder. Back this file up
occasionally (copy it somewhere safe) so you never lose your records — same lesson as your
other projects: no version control/backup = risk of losing data.
