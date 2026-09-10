import { and, desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { answerCallbackQuery, inlineMenu, mainKeyboard, sendMessage, type TelegramUpdate } from '@/lib/telegram'

export const runtime = 'nodejs'

async function ensureUser(user: NonNullable<TelegramUpdate['message']>['from']) {
  if (!user) return null
  const result = await pool.query(`INSERT INTO bot_users (telegram_id, username, first_name, last_name, language_code) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, language_code = EXCLUDED.language_code, updated_at = NOW() RETURNING id`, [user.id, user.username ?? null, user.first_name ?? null, user.last_name ?? null, user.language_code ?? 'uz'])
  return result.rows[0]?.id as number | undefined
}

async function logEvent(telegramId: number | undefined, eventType: string, payload: unknown) {
  await pool.query('INSERT INTO bot_events (telegram_id, event_type, payload) VALUES ($1, $2, $3)', [telegramId ?? null, eventType, JSON.stringify(payload)])
}

async function handleMessage(update: TelegramUpdate) {
  const message = update.message
  if (!message?.from || !message.text && !message.contact) return
  const userId = await ensureUser(message.from)
  await logEvent(message.from.id, 'message', update)
  const text = message.text?.trim()

  if (message.contact?.phone_number && userId) {
    await pool.query('INSERT INTO user_profiles (user_id, full_name, phone) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, updated_at = NOW()', [userId, message.contact.first_name ?? message.from.first_name ?? null, message.contact.phone_number])
    await sendMessage(message.chat.id, 'Telefon raqamingiz saqlandi. Profilingiz tayyor.', mainKeyboard())
    return
  }

  if (text === '/start' || text === '/help' || text === 'Yordam') {
    await sendMessage(message.chat.id, `Assalomu alaykum, ${message.from.first_name ?? 'do‘st'}!\n\nMen sizning o‘zbekcha yordamchi botingizman. Profilni to‘ldirish, vazifalar qo‘shish va eslatmalarni boshqarishga yordam beraman.\n\nBuyruqlar:\n/start — boshlash\n/profile — profil\n/tasks — vazifalar\n/help — yordam`, mainKeyboard())
    return
  }

  if (text === '/profile' || text === 'Profilim') {
    const profile = await pool.query('SELECT p.full_name, p.phone, p.region, p.district FROM user_profiles p JOIN bot_users u ON u.id = p.user_id WHERE u.telegram_id = $1', [message.from.id])
    const row = profile.rows[0]
    await sendMessage(message.chat.id, row ? `Profilingiz:\nIsm: ${row.full_name ?? 'kiritilmagan'}\nTelefon: ${row.phone ?? 'kiritilmagan'}\nHudud: ${row.region ?? 'kiritilmagan'}\n\nTo‘liq HTML5 profil kartangizni oching:` : 'Profilingiz hali to‘ldirilmagan. Avval telefon raqamingizni yuboring.', row ? inlineMenu() : { keyboard: [[{ text: 'Telefon raqamni yuborish', request_contact: true }]], resize_keyboard: true })
    return
  }

  if (text === '/tasks' || text === 'Vazifalarim') {
    const tasks = await pool.query('SELECT title, status, due_at FROM user_tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId])
    const body = tasks.rows.length ? tasks.rows.map((task, index) => `${index + 1}. ${task.title} — ${task.status === 'done' ? 'bajarilgan' : 'faol'}`).join('\n') : 'Hozircha vazifalar yo‘q.'
    await sendMessage(message.chat.id, `Vazifalaringiz:\n\n${body}\n\nYangi vazifa qo‘shish uchun quyidagi tugmani bosing.`, inlineMenu())
    return
  }

  await sendMessage(message.chat.id, 'Buyruqni tushunmadim. /help buyrug‘i orqali imkoniyatlarni ko‘ring.', mainKeyboard())
}

async function handleCallback(update: TelegramUpdate) {
  const query = update.callback_query
  if (!query?.message || !query.data) return
  await logEvent(query.from.id, 'callback', query)
  await answerCallbackQuery(query.id)
  if (query.data === 'help') await sendMessage(query.message.chat.id, 'Yordam: /profile orqali profilingizni, /tasks orqali vazifalaringizni ko‘ring.')
  else if (query.data === 'profile') await sendMessage(query.message.chat.id, 'Profilni ko‘rish uchun /profile buyrug‘ini yuboring.')
  else if (query.data === 'task_add') await sendMessage(query.message.chat.id, 'Vazifa qo‘shish moduli keyingi bosqichda ulanadi. Hozircha /tasks buyrug‘i ishlaydi.')
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret && request.headers.get('x-telegram-bot-api-secret-token') !== secret) return NextResponse.json({ ok: false }, { status: 401 })
  try {
    const update = (await request.json()) as TelegramUpdate
    if (update.message) await handleMessage(update)
    if (update.callback_query) await handleCallback(update)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[v0] Telegram webhook error', error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
