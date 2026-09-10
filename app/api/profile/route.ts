import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function PUT(request: NextRequest) {
  const form = await request.formData()
  const token = String(form.get('token') ?? '')
  if (!token) return NextResponse.json({ error: 'Token kerak' }, { status: 401 })
  const result = await pool.query('UPDATE employee_applications SET full_name = $1, phone = $2, profession = $3, department = $4, region = $5, bio = $6, updated_at = NOW() WHERE website_token = $7 AND status = $8 RETURNING employee_id', [form.get('full_name'), form.get('phone'), form.get('profession'), form.get('department'), form.get('region'), form.get('bio'), token, 'approved'])
  if (!result.rows[0]) return NextResponse.json({ error: 'Profil topilmadi yoki tasdiqlanmagan' }, { status: 404 })
  return NextResponse.json({ ok: true, employeeId: result.rows[0].employee_id })
}
