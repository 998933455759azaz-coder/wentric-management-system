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

function employeeKeyboard() {
  return { keyboard: [[{ text: '🏠 Profilim' }, { text: '📋 Vazifalarim' }], [{ text: '🪪 Wentric Card' }, { text: '❔ Yordam' }]], resize_keyboard: true, is_persistent: true }
}

function adminKeyboard() {
  return { keyboard: [[{ text: 'Invite yaratish' }, { text: 'Arizalar' }], [{ text: 'Xodimlar' }, { text: 'Vazifa berish' }]], resize_keyboard: true, is_persistent: true }
}

async function sendAccessDenied(chatId: number) {
  await sendMessage(chatId, 'Kechirasiz, bu bot faqat Wentric Company jamoasi uchun. Sizga taklif havolasi yoki ruxsat berilgan Telegram ID kerak.')
}

async function handleMessage(update: TelegramUpdate) {
  const message = update.message
  if (!message?.from || (!message.text && !message.contact)) return
  const user = message.from
  await ensureUser(user)
  await logEvent(user.id, 'message', update)
  const text = message.text?.trim() ?? ''
  const commandText = text.replace(/^[^\p{L}\p{N}/]+/u, '').trim()
  const contactPhone = message.contact?.phone_number ?? ''
  const photoFileId = message.photo?.at(-1)?.file_id ?? null
  const startPayload = text.startsWith('/start') ? text.split(' ')[1] : null

  if (text.startsWith('/start')) {
    if (isAdmin(user.id)) {
      await sendMessage(message.chat.id, 'Wentric Company boshqaruv markaziga xush kelibsiz, Admin.', adminKeyboard())
      return
    }
    const existing = await applicationFor(user.id)
    if (!startPayload) {
      if (!existing) {
        await sendAccessDenied(message.chat.id)
        return
      }
      if (!existing.privacy_accepted_at) {
        await sendMessage(message.chat.id, 'Wentric Company maxfiylik siyosati va jamoa qoidalariga rozilik berasizmi?', { inline_keyboard: [[{ text: 'Roziman', callback_data: 'consent:accept' }, { text: 'Rad etaman', callback_data: 'consent:reject' }]] })
        return
      }
      await sendMessage(message.chat.id, `Sizning arizangiz holati: ${existing.status === 'pending' ? 'ko‘rib chiqilmoqda' : existing.status === 'approved' ? 'tasdiqlangan' : 'rad etilgan'}.`, existing.status === 'approved' ? employeeKeyboard() : onboardingKeyboard())
      return
    }
    const invite = await pool.query('SELECT id, code, max_uses, used_count FROM bot_invites WHERE code = $1 AND is_active = TRUE AND used_count < max_uses', [startPayload])
    if (!invite.rows[0]) {
      await sendMessage(message.chat.id, 'Bu taklif havolasi yaroqsiz yoki foydalanish limiti tugagan.')
      return
    }
    if (existing) {
      if (!existing.privacy_accepted_at) {
        await sendMessage(message.chat.id, 'Wentric Company maxfiylik siyosati va jamoa qoidalariga rozilik berasizmi?', { inline_keyboard: [[{ text: 'Roziman', callback_data: 'consent:accept' }, { text: 'Rad etaman', callback_data: 'consent:reject' }]] })
        return
      }
      await sendMessage(message.chat.id, `Sizning arizangiz holati: ${existing.status === 'pending' ? 'ko‘rib chiqilmoqda' : existing.status === 'approved' ? 'tasdiqlangan' : 'rad etilgan'}.`, existing.status === 'approved' ? employeeKeyboard() : onboardingKeyboard())
      return
    }
    await pool.query('INSERT INTO employee_applications (telegram_id, invite_id, full_name, temporary_id) VALUES ($1, $2, $3, $4)', [user.id, invite.rows[0].id, '', `TMP-${user.id}`])
    await pool.query('UPDATE bot_invites SET used_count = used_count + 1 WHERE id = $1', [invite.rows[0].id])
    await sendMessage(message.chat.id, 'Wentric Company maxfiylik siyosati va jamoa qoidalariga rozilik berasizmi? Rozilikdan keyin ism-familiya, yosh, telefon va shaxsiy rasmingiz so‘raladi.', { inline_keyboard: [[{ text: 'Roziman', callback_data: 'consent:accept' }, { text: 'Rad etaman', callback_data: 'consent:reject' }]] })
    return
  }

  const application = await applicationFor(user.id)
  if (!isAdmin(user.id) && !application) {
    await sendAccessDenied(message.chat.id)
    return
  }

  if (commandText === 'Ariza topshirish') {
    if (!application?.privacy_accepted_at) { await sendMessage(message.chat.id, 'Avval maxfiylik siyosatiga rozilik bering. /start havolasi orqali qayta kiring.'); return }
    if (!application.full_name) await sendMessage(message.chat.id, 'Ism va familiyangizni yuboring:', { force_reply: true })
    else if (!application.age) await sendMessage(message.chat.id, 'Yoshingizni faqat raqam bilan yozing:', { force_reply: true })
    else if (!application.phone) await sendMessage(message.chat.id, 'Telefon raqamingizni yuboring:', { keyboard: [[{ text: 'Telefon raqamni yuborish', request_contact: true }]], resize_keyboard: true })
    else if (!application.photo_file_id) await sendMessage(message.chat.id, 'Shaxsiy profilingiz uchun rasmingizni yuboring:', { force_reply: true })
    else await sendMessage(message.chat.id, 'Kasbingizni yozing:', { force_reply: true })
    return
  }

  if (commandText === '/apply') {
    await sendMessage(message.chat.id, 'Ariza topshirish uchun ma’lumotlarni ketma-ket yuboring. To‘liq ismingizdan boshlang:', { force_reply: true })
    return
  }

  if (commandText === '/profile' || commandText === 'Profilim') {
    if (application?.status !== 'approved') { await sendMessage(message.chat.id, 'Profil faqat tasdiqlangandan keyin ochiladi. Ariza holatingizni tekshiring.', onboardingKeyboard()); return }
    await sendMessage(message.chat.id, `WENTRIC COMPANY\n━━━━━━━━━━━━\nEmployee ID: ${application.employee_id}\nIsm: ${application.full_name}\nLavozim: ${application.position ?? '-'}\nBo‘lim: ${application.department ?? '-'}\nTelefon: ${application.phone ?? '-'}\nStatus: Faol`, mainKeyboard())
    return
  }

  if (commandText === 'Wentric Card') {
    if (application?.status !== 'approved' || !application.employee_id) { await sendMessage(message.chat.id, 'Card faqat tasdiqlangandan keyin ochiladi.'); return }
    const token = application.website_token ?? crypto.randomUUID()
    if (!application.website_token) await pool.query('UPDATE employee_applications SET website_token = $1 WHERE telegram_id = $2', [token, user.id])
    await sendMessage(message.chat.id, `Wentric Card va profil:\nhttps://wentric-management-system.vercel.app/profile?token=${token}\n\nTo‘g‘ridan-to‘g‘ri PDF:\nhttps://wentric-management-system.vercel.app/api/telegram/card?token=${token}`, employeeKeyboard()); return
  }

  if (commandText === '/tasks' || commandText === 'Vazifalarim') {
    if (application?.status !== 'approved' || !application.employee_id) { await sendMessage(message.chat.id, 'Vazifalarni ko‘rish uchun arizangiz tasdiqlanishi kerak.'); return }
    const tasks = await pool.query('SELECT title, description, status, priority, progress, due_at FROM company_tasks WHERE employee_id = $1 ORDER BY created_at DESC LIMIT 20', [application.employee_id])
    await sendMessage(message.chat.id, tasks.rows.length ? `Vazifalaringiz:\n\n${tasks.rows.map((task, index) => `${index + 1}. ${task.title}\nStatus: ${task.status} · ${task.progress}%\nMuhimlik: ${task.priority}\nMuddat: ${task.due_at ? new Date(task.due_at).toLocaleDateString('uz-UZ') : '-'}`).join('\n\n')}` : 'Sizga hali vazifa biriktirilmagan.', mainKeyboard())
    return
  }

  if (commandText === 'Holatimni tekshirish') {
    await sendMessage(message.chat.id, `Ariza holati: ${application?.status === 'pending' ? 'ko‘rib chiqilmoqda' : application?.status === 'approved' ? `tasdiqlangan. Employee ID: ${application.employee_id}` : 'rad etilgan'}.`, onboardingKeyboard())
    return
  }

  if (!isAdmin(user.id) && application?.status !== 'approved') {
    if (!application?.privacy_accepted_at) { await sendMessage(message.chat.id, 'Arizani boshlash uchun /start havolasidan kiring va qoidalarga rozilik bering.'); return }
    if (text && !application.full_name) {
      await pool.query('UPDATE employee_applications SET full_name = $1, updated_at = NOW() WHERE telegram_id = $2', [text, user.id])
      await sendMessage(message.chat.id, 'Yoshingizni faqat raqam bilan yozing:', { force_reply: true }); return
    }
    if (text && application.full_name && !application.age) {
      const age = Number(text); if (!Number.isInteger(age) || age < 16 || age > 80) { await sendMessage(message.chat.id, 'Yosh 16 dan 80 gacha bo‘lgan raqam bo‘lishi kerak.'); return }
      await pool.query('UPDATE employee_applications SET age = $1, updated_at = NOW() WHERE telegram_id = $2', [age, user.id])
      await sendMessage(message.chat.id, 'Telefon raqamingizni yuboring:', { keyboard: [[{ text: 'Telefon raqamni yuborish', request_contact: true }]], resize_keyboard: true }); return
    }
    if ((text || contactPhone) && application.age && !application.phone) {
      await pool.query('UPDATE employee_applications SET phone = $1, updated_at = NOW() WHERE telegram_id = $2', [contactPhone || text, user.id])
      await sendMessage(message.chat.id, 'Endi shaxsiy profilingiz uchun rasmingizni yuboring:'); return
    }
    if (photoFileId && !application.photo_file_id) {
      await pool.query('UPDATE employee_applications SET photo_file_id = $1, updated_at = NOW() WHERE telegram_id = $2', [photoFileId, user.id])
      await sendMessage(message.chat.id, 'Kasbingizni yozing:', { force_reply: true }); return
    }
    if (text && application.photo_file_id && !application.profession) {
      await pool.query('UPDATE employee_applications SET profession = $1, updated_at = NOW() WHERE telegram_id = $2', [text, user.id])
      await sendMessage(message.chat.id, 'Qaysi bo‘limda ishlaysiz?', { force_reply: true }); return
    }
    if (text && application.profession && !application.department) {
      await pool.query('UPDATE employee_applications SET department = $1, updated_at = NOW() WHERE telegram_id = $2', [text, user.id])
      await sendMessage(message.chat.id, 'Qaysi hududda yashaysiz?', { force_reply: true }); return
    }
    if (text && application.department && !application.region) {
      await pool.query('UPDATE employee_applications SET region = $1, status = \'pending\', updated_at = NOW() WHERE telegram_id = $2', [text, user.id])
      await sendMessage(message.chat.id, 'Arizangiz yuborildi. Admin tasdig‘ini kuting.', onboardingKeyboard())
      if (Number.isFinite(adminId)) await sendMessage(adminId, `Yangi employee arizasi: ${text}\nTelegram ID: ${user.id}\nTasdiqlash uchun admin paneldan foydalaning.`, adminKeyboard())
      return
    }
    await sendMessage(message.chat.id, 'Ariza ma’lumotlarini to‘ldirish uchun “Ariza topshirish” tugmasini bosing.', onboardingKeyboard()); return
  }

  if (isAdmin(user.id) && commandText === 'Invite yaratish') {
    const code = `WENTRIC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    await pool.query('INSERT INTO bot_invites (code, label, max_uses) VALUES ($1, $2, $3)', [code, 'Wentric employee invite', 1])
    await sendMessage(message.chat.id, `Bir martalik invite havola:\nhttps://t.me/WentricEmployeebot?start=${code}`, adminKeyboard()); return
  }
  if (isAdmin(user.id) && commandText === 'Arizalar') { await sendMessage(message.chat.id, 'Kutilayotgan arizalar uchun /pending buyrug‘ini yuboring.', adminKeyboard()); return }
  if (isAdmin(user.id) && commandText === 'Xodimlar') { await sendMessage(message.chat.id, 'Xodimlar ro‘yxati uchun /employees buyrug‘ini yuboring.', adminKeyboard()); return }
  if (isAdmin(user.id) && commandText === 'Vazifa berish') { await sendMessage(message.chat.id, 'Format: /assign WEN-0001 | Vazifa nomi | Tavsif', adminKeyboard()); return }

  if (isAdmin(user.id) && commandText === '/pending') {
    const pending = await pool.query(`SELECT telegram_id, full_name, phone, position, department, temporary_id FROM employee_applications WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20`)
    if (!pending.rows.length) { await sendMessage(message.chat.id, 'Kutilayotgan arizalar yo‘q.', mainKeyboard()); return }
    for (const row of pending.rows) await sendMessage(message.chat.id, `Ariza: ${row.full_name}\nTelefon: ${row.phone ?? '-'}\nLavozim: ${row.position ?? '-'}\nBo‘lim: ${row.department ?? '-'}\nVaqtinchalik ID: ${row.temporary_id}`, { inline_keyboard: [[{ text: 'Tasdiqlash', callback_data: `approve:${row.telegram_id}` }, { text: 'Rad etish', callback_data: `reject:${row.telegram_id}` }]] })
    return
  }

  if (isAdmin(user.id) && commandText === '/employees') {
    const employees = await pool.query(`SELECT employee_id, full_name, position, department, telegram_id FROM employee_applications WHERE status = 'approved' ORDER BY employee_id`)
    await sendMessage(message.chat.id, employees.rows.length ? `Tasdiqlangan xodimlar:\n\n${employees.rows.map((row) => `${row.employee_id} · ${row.full_name}\n${row.position ?? '-'} · ${row.department ?? '-'}\nTelegram: ${row.telegram_id}`).join('\n\n')}` : 'Tasdiqlangan xodimlar yo‘q.', mainKeyboard())
    return
  }

  if (isAdmin(user.id) && commandText.startsWith('/assign ')) {
    const parts = text.slice(8).split('|').map((part) => part.trim())
    if (parts.length < 2 || !parts[0] || !parts[1]) { await sendMessage(message.chat.id, 'Format: /assign WEN-0001 | Vazifa nomi | Tavsif'); return }
    const [employeeId, title, description = ''] = parts
    const employee = await pool.query("SELECT telegram_id FROM employee_applications WHERE employee_id = $1 AND status = 'approved'", [employeeId])
    if (!employee.rows[0]) { await sendMessage(message.chat.id, 'Bunday faol employee ID topilmadi.'); return }
    await pool.query('INSERT INTO company_tasks (employee_id, title, description, assigned_by) VALUES ($1, $2, $3, $4)', [employeeId, title, description, user.id])
    await sendMessage(employee.rows[0].telegram_id, `Sizga yangi vazifa berildi.\n\n${title}\n${description}\n\nVazifalarim tugmasi orqali ko‘ring.`, mainKeyboard())
    await sendMessage(message.chat.id, `Vazifa ${employeeId} ga biriktirildi.`)
    return
  }

  if (isAdmin(user.id) && commandText === '/invite') {
    const code = `WENTRIC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    await pool.query('INSERT INTO bot_invites (code, label, max_uses) VALUES ($1, $2, $3)', [code, 'Wentric employee invite', 1])
    await sendMessage(message.chat.id, `Bir martalik invite havola:\nhttps://t.me/WentricEmployeebot?start=${code}`, adminKeyboard())
    return
  }

  if (isAdmin(user.id)) { await sendMessage(message.chat.id, 'Admin buyruqlari:\n/invite — invite yaratish\n/pending — arizalarni ko‘rish\n/employees — xodimlar ro‘yxati\n/assign WEN-0001 | Vazifa — vazifa berish', adminKeyboard()); return }
  if (application?.status === 'approved') await sendMessage(message.chat.id, `Wentric Employee ID: ${application.employee_id}\n\nSizga hozircha yangi vazifa biriktirilmagan.`, mainKeyboard())
}

async function handleCallback(update: TelegramUpdate) {
  const query = update.callback_query
  if (!query?.message || !query.data) return
  await answerCallbackQuery(query.id)
  if (query.data === 'consent:accept') {
    const application = await applicationFor(query.from.id)
    if (!application) { await sendMessage(query.message.chat.id, 'Bu taklif havolasi yoki Telegram ID orqali berilgan ruxsat topilmadi.'); return }
    await pool.query('UPDATE employee_applications SET privacy_accepted_at = NOW(), updated_at = NOW() WHERE telegram_id = $1', [query.from.id])
    await sendMessage(query.message.chat.id, 'Rozilik qayd etildi. Endi “Ariza topshirish” tugmasini bosing.', onboardingKeyboard()); return
  }
  if (query.data === 'consent:reject') { await sendMessage(query.message.chat.id, 'Roziliksiz Wentric Company tizimidan foydalanib bo‘lmaydi.'); return }
  if (!isAdmin(query.from.id)) return
  const [action, rawId] = query.data.split(':')
  const telegramId = Number(rawId)
  if (!telegramId || !['approve', 'reject'].includes(action)) return
  if (action === 'approve') {
    const next = await pool.query(`SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 5) AS INTEGER)), 0) + 1 AS next_id FROM employee_applications WHERE employee_id LIKE 'WEN-%'`)
    const employeeId = `WEN-${String(next.rows[0].next_id).padStart(4, '0')}`
    await pool.query(`UPDATE employee_applications SET status = 'approved', employee_id = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE telegram_id = $3 AND status = 'pending'`, [employeeId, query.from.id, telegramId])
    await sendMessage(telegramId, `Tabriklaymiz. Siz Wentric Company jamoasiga qabul qilindingiz.\nEmployee ID: ${employeeId}\n\nShaxsiy Wentric Card’ingiz tayyor.`, employeeKeyboard())
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
