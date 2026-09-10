'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, Webhook } from 'lucide-react'

type Status = { url?: string; pending_update_count?: number; last_error_message?: string }

export function WebhookSetup() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadStatus() {
    const response = await fetch('/api/telegram/setup', { cache: 'no-store' })
    const data = await response.json()
    if (data.ok) setStatus(data.result)
  }

  useEffect(() => { void loadStatus() }, [])

  async function connectWebhook() {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/telegram/setup', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Webhook ulanmagan.')
      setMessage(data.message)
      await loadStatus()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Noma’lum xatolik yuz berdi.')
    } finally { setLoading(false) }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Webhook size={19} /></span><div><h3 className="font-semibold">Webhook sozlamalari</h3><p className="text-sm text-muted-foreground">Botni domeningizga avtomatik ulang</p></div></div>
        <button aria-label="Webhook holatini yangilash" onClick={() => void loadStatus()} className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><RefreshCw size={16} /></button>
      </div>
      <div className="mb-5 rounded-xl bg-muted/60 p-4 text-sm leading-6"><p className="font-medium">Webhook manzili</p><code className="break-all text-xs text-primary">https://wentric-management-system.vercel.app/api/telegram/webhook</code></div>
      {status?.url ? <div className="mb-5 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={17} /> Ulangan. Kutilayotgan yangilanishlar: {status.pending_update_count ?? 0}</div> : <p className="mb-5 text-sm text-muted-foreground">Hozircha webhook ulanmagan.</p>}
      {status?.last_error_message && <p className="mb-4 text-sm text-destructive">Telegram xabari: {status.last_error_message}</p>}
      {message && <p className="mb-4 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <button onClick={() => void connectWebhook()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{loading && <Loader2 className="animate-spin" size={16} />} {loading ? 'Ulanmoqda...' : 'Telegramga webhook ulash'}</button>
    </div>
  )
}
