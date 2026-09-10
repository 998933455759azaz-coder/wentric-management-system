import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SITE_URL = 'https://wentric-management-system.vercel.app'

export async function POST() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!token) {
    return NextResponse.json({ ok: false, message: 'TELEGRAM_BOT_TOKEN topilmadi.' }, { status: 500 })
  }

  const webhookUrl = `${SITE_URL}/api/telegram/webhook`
  const body: Record<string, unknown> = { url: webhookUrl, drop_pending_updates: false }
  if (secret) body.secret_token = secret

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const result = (await response.json()) as { ok?: boolean; description?: string }

  if (!response.ok || !result.ok) {
    return NextResponse.json({ ok: false, message: result.description ?? 'Telegram webhookni ulashda xatolik yuz berdi.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, webhookUrl, secured: Boolean(secret), message: 'Webhook muvaffaqiyatli ulandi.' })
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ ok: false, message: 'TELEGRAM_BOT_TOKEN topilmadi.' }, { status: 500 })

  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { cache: 'no-store' })
  const result = (await response.json()) as { ok?: boolean; result?: { url?: string; pending_update_count?: number; last_error_message?: string } }
  return NextResponse.json(result, { status: response.ok ? 200 : 502 })
}
