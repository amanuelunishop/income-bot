// supabase/functions/send-report/index.ts
//
// Called from the website's "Report" tab. Takes a { from, to } date range,
// pulls that user's entries, builds a PDF (each income/withdrawal line with
// its own comment — "withdrew X for <reason>", "income X for <reason>"),
// and sends the PDF to your Telegram chat.
//
// Secrets needed (set once, see README §4):
//   TELEGRAM_BOT_TOKEN        — from @BotFather
//   TELEGRAM_CHAT_ID          — your personal chat id
//   SUPABASE_URL              — auto-provided by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided by Supabase
//   SUPABASE_ANON_KEY         — auto-provided by Supabase

import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// A font that can render Amharic (Ethiopic script) glyphs, since your
// comments will likely be written in Amharic. If this URL ever goes stale,
// download any .ttf of "Noto Sans Ethiopic", upload it to a public Supabase
// Storage bucket, and swap the URL below for that bucket's public URL.
const AMHARIC_FONT_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansEthiopic/NotoSansEthiopic-Regular.ttf';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not signed in.' }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    // Identify the calling user from their JWT.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Not signed in.' }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }
    const userId = userData.user.id;

    const { from, to } = await req.json();
    if (!from || !to) {
      return new Response(JSON.stringify({ error: 'Missing from/to dates.' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    // Service-role client to actually read the rows (RLS would also allow
    // this via userClient, but service role avoids any RLS edge cases here).
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rows, error: qErr } = await admin
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date', { ascending: true });

    if (qErr) {
      return new Response(JSON.stringify({ error: qErr.message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }

    const entries = rows || [];
    const totalIncome = entries.reduce((s, r) => s + Number(r.income || 0), 0);
    const totalWithdrawal = entries.reduce((s, r) => s + Number(r.withdrawal || 0), 0);
    const net = totalIncome - totalWithdrawal;

    // ---------- build the PDF ----------
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontBytes = await (await fetch(AMHARIC_FONT_URL)).arrayBuffer();
    const font = await pdfDoc.embedFont(fontBytes, { subset: true });

    const PAGE_W = 595.28; // A4
    const PAGE_H = 841.89;
    const MARGIN = 48;
    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const black = rgb(0.08, 0.1, 0.11);
    const green = rgb(0.25, 0.49, 0.42);
    const red = rgb(0.54, 0.23, 0.23);
    const gray = rgb(0.42, 0.44, 0.42);

    function newPageIfNeeded(needed: number) {
      if (y - needed < MARGIN) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
    }

    function line(text: string, size: number, color = black, x = MARGIN) {
      page.drawText(text, { x, y, size, font, color });
      y -= size + 8;
    }

    line('Income & Withdrawal Report', 20, black);
    line(`${from}  →  ${to}`, 11, gray);
    y -= 10;

    line(`Total income:      +${fmt(totalIncome)}`, 12, green);
    line(`Total withdrawal:  -${fmt(totalWithdrawal)}`, 12, red);
    line(`Net:               ${net >= 0 ? '+' : ''}${fmt(net)}`, 13, black);
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 1,
      color: gray,
    });
    y -= 20;

    if (entries.length === 0) {
      line('No entries in this period.', 11, gray);
    }

    for (const r of entries) {
      newPageIfNeeded(70);
      line(r.entry_date, 11, black);

      if (Number(r.income) > 0) {
        const reason = r.income_note ? ` — ${r.income_note}` : '';
        newPageIfNeeded(20);
        line(`  income +${fmt(Number(r.income))}${reason}`, 10.5, green, MARGIN + 10);
      }
      if (Number(r.withdrawal) > 0) {
        const reason = r.withdrawal_note ? ` — ${r.withdrawal_note}` : '';
        newPageIfNeeded(20);
        line(`  withdrew -${fmt(Number(r.withdrawal))}${reason}`, 10.5, red, MARGIN + 10);
      }
      y -= 6;
    }

    const pdfBytes = await pdfDoc.save();

    // ---------- send to Telegram ----------
    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('caption', `Report: ${from} → ${to}\nNet: ${net >= 0 ? '+' : ''}${fmt(net)}`);
    form.append(
      'document',
      new Blob([pdfBytes], { type: 'application/pdf' }),
      `report-${from}-to-${to}.pdf`
    );

    const tgRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      { method: 'POST', body: form }
    );
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      console.error('Telegram error:', tgData);
      return new Response(JSON.stringify({ error: 'Telegram send failed', detail: tgData }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
