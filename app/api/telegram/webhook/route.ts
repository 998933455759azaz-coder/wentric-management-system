import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { answerCallbackQuery, inlineMenu, mainKeyboard, sendMessage, type TelegramUpdate } from '@/lib/telegram'

export const runtime = 'nodejs'

const adminId = Number(process.env.ADMIN_TELEGRAM_ID)
const isAdmin = (telegramId: number) => Number.isFinite(adminId) && telegramId === adminId

async function logEvent(telegramId: number | undefined, eventType: string, payload: unknown) {
  await pool.query('INSERT INTO bot_events (telegram_id, event_type, payload) VALUES ($1, $2, $3)', [telegramId ?? null, eventType, JSON.stringify(payload)])
}

async function ensureUser(user: NonNullable<NonNullable<TelegramUpdate['message']>['from']>) {
  const result = await pool.query(`INSERT INTO bot_users (telegram_id, username, first_name, last_name, language_code) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, language_code = EXCLUDED.language_code, updated_at = NOW() RETURNING id`, [user.id, user.username ?? null, user.first_name ?? null, user.last_name ?? null, user.language_code ?? 'uz'])
  return result.rows[0]?.id as number
}

async function applicationFor(telegramId: number) {
  const result = await pool.query('SELECT * FROM employee_applications WHERE telegram_id = $1', [telegramId])
  return result.rows[0]
}

function onboardingKeyboard() {
  return { keyboard: [[{ text: 'Ariza topshirish' }], [{ text: 'Holatimni tekshirish' }]], resize_keyboard: true, is_persistent: true }
}

async function sendAccessDenied(chatId: number) {
  await sendMessage(chatId, 'Kechirasiz, bu bot faqat Wentric Company jamoasi uchun. Sizga taklif havolasi yoki ruxsat berilgan Telegram ID kerak.', onboardingKeyboard())
}

async function handleMessage(update: TelegramUpdate) {
  const message = update.message
  if (!message?.from || (!message.text && !message.contact)) return
  const user = message.from
  await ensureUser(user)
  await logEvent(user.id, 'message', update)
  const text = message.text?.trim() ?? ''
  const startPayload = text.startsWith('/start') ? text.split(' ')[1] : null

  if (text.startsWith('/start')) {
    if (isAdmin(user.id)) {
      await sendMessage(message.chat.id, 'Wentric boshqaruv markaziga xush kelibsiz, Admin.', mainKeyboard())
      return
    }
    if (!startPayload) {
      await sendAccessDenied(message.chat.id)
      return
    }
    const invite = await pool.query('SELECT id, code, max_uses, used_count FROM bot_invites WHERE code = $1 AND is_active = TRUE AND used_count < max_uses', [startPayload])
    if (!invite.rows[0]) {
      await sendMessage(message.chat.id, 'Bu taklif havolasi yaroqsiz yoki foydalanish limiti tugagan.', onboardingKeyboard())
      return
    }
    const existing = await applicationFor(user.id)
    if (existing) {
      await sendMessage(message.chat.id, `Sizning arizangiz holati: ${existing.status === 'pending' ? 'ko‘rib chiqilmoqda' : existing.status === 'approved' ? 'tasdiqlangan' : 'rad etilgan'}.`, onboardingKeyboard())
      return
    }
    await pool.query('INSERT INTO employee_applications (telegram_id, invite_id, full_name, temporary_id) VALUES ($1, $2, $3, $4)', [user.id, invite.rows[0].id, '', `TMP-${user.id}`])
    await pool.query('UPDATE bot_invites SET used_count = used_count + 1 WHERE id = $1', [invite.rows[0].id])
    await sendMessage(message.chat.id, 'Taklif havolasi qabul qilindi. Arizani to‘ldirish uchun “Ariza topshirish” tugmasini bosing.', onboardingKeyboard())
    return
  }

  const application = await applicationFor(user.id)
  if (!isAdmin(user.id) && !application) {
    await sendAccessDenied(message.chat.id)
    return
  }

  if (text === 'Ariza topshirish') {
    await sendMessage(message.chat.id, 'To‘liq ismingizni yuboring:', { force_reply: true })
    return
  }

  if (text === 'Holatimni tekshirish') {
    await sendMessage(message.chat.id, `Ariza holati: ${application?.status === 'pending' ? 'ko‘rib chiqilmoqda' : application?.status === 'approved' ? `tasdiqlangan. Employee ID: ${application.employee_id}` : 'rad etilgan'}.`, onboardingKeyboard())
    return
  }

  if (!isAdmin(user.id) && application?.status !== 'approved') {
    if (text && !application?.full_name) {
      await pool.query('UPDATE employee_applications SET full_name = $1, updated_at = NOW() WHERE telegram_id = $2', [text, user.id])
      await sendMessage(message.chat.id, 'Telefon raqamingizni yuboring yoki yozing:', { force_reply: true })
      return
    }
    if (text && application?.full_name && !application.phone) {
      await pool.query('UPDATE employee_applications SET phone = $1, updated_at = NOW() WHERE telegram_id = $2', [text, user.id])
      await sendMessage(message.chat.id, 'Lavozimingizni yozing:', { force_reply: true })
      return
    }
    if (text && application?.phone && !application.position) {
      await pool.query('UPDATE employee_applications SET position = $1, updated_at = NOW() WHERE telegram_id = $2', [text, user.id])
      await sendMessage(message.chat.id, 'Qaysi bo‘limda ishlaysiz?', { force_reply: true })
      return
    }
    if (text && application?.position && !application.department) {
      await pool.query('UPDATE employee_applications SET department = $1, updated_at = NOW() WHERE telegram_id = $2', [text, user.id])
      await sendMessage(message.chat.id, 'Arizangiz yuborildi. Admin tasdig‘ini kuting.', onboardingKeyboard())
      if (Number.isFinite(adminId)) await sendMessage(adminId, `Yangi employee arizasi: ${application.full_name}\nTelegram ID: ${user.id}\nTasdiqlash uchun /pending buyrug‘ini bosing.`)
      return
    }
    await sendMessage(message.chat.id, 'Ariza ma’lumotlarini ketma-ket yuboring. “Ariza topshirish” tugmasidan boshlang.', onboardingKeyboard())
    return
  }

  if (isAdmin(user.id) && text === '/pending') {
    const pending = await pool.query(`SELECT telegram_id, full_name, phone, position, department, temporary_id FROM employee_applications WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20`)
    if (!pending.rows.length) { await sendMessage(message.chat.id, 'Kutilayotgan arizalar yo‘q.', mainKeyboard()); return }
    for (const row of pending.rows) await sendMessage(message.chat.id, `Ariza: ${row.full_name}\nTelefon: ${row.phone ?? '-'}\nLavozim: ${row.position ?? '-'}\nBo‘lim: ${row.department ?? '-'}\nVaqtinchalik ID: ${row.temporary_id}`, { inline_keyboard: [[{ text: 'Tasdiqlash', callback_data: `approve:${row.telegram_id}` }, { text: 'Rad etish', callback_data: `reject:${row.telegram_id}` }]] })
    return
  }

  if (isAdmin(user.id) && text === '/invite') {
    const code = `WENTRIC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    await pool.query('INSERT INTO bot_invites (code, label, max_uses) VALUES ($1, $2, $3)', [code, 'Wentric employee invite', 1])
    await sendMessage(message.chat.id, `Bir martalik invite havola:\nhttps://t.me/WentricEmployeebot?start=${code}`, mainKeyboard())
    return
  }

  if (isAdmin(user.id)) { await sendMessage(message.chat.id, 'Admin buyruqlari: /invite — invite yaratish, /pending — arizalarni ko‘rish.', mainKeyboard()); return }
  if (application?.status === 'approved') await sendMessage(message.chat.id, `Wentric Employee ID: ${application.employee_id}\n\nSizga hozircha yangi vazifa biriktirilmagan.`, mainKeyboard())
}

async function handleCallback(update: TelegramUpdate) {
  const query = update.callback_query
  if (!query?.message || !query.data) return
  await answerCallbackQuery(query.id)
  if (!isAdmin(query.from.id)) return
  const [action, rawId] = query.data.split(':')
  const telegramId = Number(rawId)
  if (!telegramId || !['approve', 'reject'].includes(action)) return
  if (action === 'approve') {
    const next = await pool.query(`SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 5) AS INTEGER)), 0) + 1 AS next_id FROM employee_applications WHERE employee_id LIKE 'WEN-%'`)
    const employeeId = `WEN-${String(next.rows[0].next_id).padStart(4, '0')}`
    await pool.query(`UPDATE employee_applications SET status = 'approved', employee_id = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE telegram_id = $3 AND status = 'pending'`, [employeeId, query.from.id, telegramId])
    await sendMessage(telegramId, `Tabriklaymiz. Siz Wentric Company jamoasiga qabul qilindingiz.\nEmployee ID: ${employeeId}`, mainKeyboard())
    await sendMessage(query.message.chat.id, `Ariza tasdiqlandi: ${employeeId}`)
  } else {
    await pool.query(`UPDATE employee_applications SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW() WHERE telegram_id = $2 AND status = 'pending'`, [query.from.id, telegramId])
    await sendMessage(telegramId, 'Arizangiz hozircha tasdiqlanmadi. Admin bilan bog‘laning.')
    await sendMessage(query.message.chat.id, 'Ariza rad etildi.')
  }
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
    console.error('[v0] Telegram office webhook error', error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
