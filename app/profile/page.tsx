'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function ProfilePage() {
  const [status, setStatus] = useState('')
  const [saved, setSaved] = useState(false)
  async function submit(formData: FormData) {
    setStatus('Saqlanmoqda...')
    const response = await fetch('/api/profile', { method: 'PUT', body: formData })
    setStatus(response.ok ? 'Profil saqlandi.' : 'Profilni saqlashda xatolik.')
    setSaved(response.ok)
  }
  return <main className="min-h-screen bg-background px-5 py-10 text-foreground"><div className="mx-auto max-w-xl"><header className="mb-8 flex items-center gap-3"><Image src="/wentric-logo.png" alt="Wentric logo" width={44} height={44} className="rounded-xl" /><div><h1 className="font-semibold">Wentric Employee Profile</h1><p className="text-sm text-muted-foreground">Shaxsiy ma’lumotlarni to‘ldirish</p></div></header><form action={submit} className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-xl"><input type="hidden" name="token" value={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') ?? '' : ''} /><label className="grid gap-2 text-sm">Ism-familiya<input name="full_name" required className="rounded-xl border border-input bg-background px-4 py-3" /></label><label className="grid gap-2 text-sm">Telefon<input name="phone" required className="rounded-xl border border-input bg-background px-4 py-3" /></label><label className="grid gap-2 text-sm">Kasb<input name="profession" required className="rounded-xl border border-input bg-background px-4 py-3" /></label><label className="grid gap-2 text-sm">Bo‘lim<input name="department" required className="rounded-xl border border-input bg-background px-4 py-3" /></label><label className="grid gap-2 text-sm">Hudud<input name="region" required className="rounded-xl border border-input bg-background px-4 py-3" /></label><label className="grid gap-2 text-sm">O‘zingiz haqingizda<textarea name="bio" rows={4} className="rounded-xl border border-input bg-background px-4 py-3" /></label><button className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground" type="submit">Profilni saqlash</button>{status && <p className="text-sm text-muted-foreground">{status}</p>}{saved && <p className="text-sm">Card: <a className="underline" href={`/api/telegram/card?token=${typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') ?? '' : ''}`}>PDF yuklab olish</a></p>}</form></div></main>
}
