import { NextRequest } from 'next/server'
import PDFDocument from 'pdfkit'
import { pool } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const id = request.nextUrl.searchParams.get('id')
  if (!token && !id) return new Response('Unauthorized', { status: 401 })
  const result = await pool.query('SELECT employee_id, full_name, age, phone, profession, department, region, status FROM employee_applications WHERE ' + (token ? 'website_token = $1' : 'employee_id = $1') + ' AND status = $2', [token ?? id, 'approved'])
  const employee = result.rows[0]
  if (!employee) return new Response('Card topilmadi', { status: 404 })
  const doc = new PDFDocument({ size: 'A6', margin: 28 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))
  doc.fontSize(22).fillColor('#111111').text('WENTRIC', { align: 'center' })
  doc.fontSize(9).fillColor('#666666').text('EMPLOYEE CARD', { align: 'center' })
  doc.moveDown(2).fontSize(16).fillColor('#111111').text(employee.full_name, { align: 'center' })
  doc.moveDown().fontSize(12).text(employee.employee_id, { align: 'center' })
  doc.moveDown(2).fontSize(10).text(`Kasb: ${employee.profession ?? '-'}`)
  doc.text(`Bo‘lim: ${employee.department ?? '-'}`)
  doc.text(`Telefon: ${employee.phone ?? '-'}`)
  doc.text(`Hudud: ${employee.region ?? '-'}`)
  doc.moveDown(2).fontSize(8).fillColor('#777777').text('Wentric Company virtual office', { align: 'center' })
  doc.end()
  await new Promise<void>((resolve) => doc.on('end', resolve))
  return new Response(Buffer.concat(chunks), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${employee.employee_id}-wentric-card.pdf"` } })
}
