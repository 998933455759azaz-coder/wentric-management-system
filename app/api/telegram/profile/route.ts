import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

function verifyInitData(initData: string) {
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash || !process.env.TELEGRAM_BOT_TOKEN) return null
  params.delete('hash')
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest()
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  const expected = Buffer.from(calculatedHash, 'hex')
  const received = Buffer.from(receivedHash, 'hex')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null
  const user = JSON.parse(params.get('user') ?? '{}') as { id?: number }
  return user.id ? user : null
}

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json() as { initData?: string }
    const telegramUser = initData ? verifyInitData(initData) : null
    if (!telegramUser?.id) return NextResponse.json({ error: 'Telegram sessiyasi tasdiqlanmadi.' }, { status: 401 })
    const result = await pool.query(`SELECT u.telegram_id, u.username, u.first_name, u.last_name, u.language_code, u.created_at, p.full_name, p.phone, p.region, p.district, p.bio, p.avatar_url FROM bot_users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.telegram_id = $1`, [telegramUser.id])
    if (!result.rows[0]) return NextResponse.json({ error: 'Profil topilmadi.' }, { status: 404 })
    return NextResponse.json({ profile: result.rows[0] })
  } catch (error) {
    console.error('[v0] Profile API error', error)
    return NextResponse.json({ error: 'Profilni yuklashda xatolik yuz berdi.' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Bu endpoint Telegram Web App initData bilan POST so‘rovni qabul qiladi.' }, { status: 405 })
}
