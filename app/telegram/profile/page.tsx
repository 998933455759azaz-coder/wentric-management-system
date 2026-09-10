'use client'

import Image from 'next/image'
import Script from 'next/script'
import { useEffect, useState } from 'react'

type Profile = { telegram_id: number; username?: string; first_name?: string; last_name?: string; language_code?: string; created_at: string; full_name?: string; phone?: string; region?: string; district?: string; bio?: string; avatar_url?: string }
declare global { interface Window { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void; close: () => void; themeParams?: { bg_color?: string; text_color?: string; secondary_bg_color?: string } } } } }

export default function TelegramProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) { setError('Bu sahifani Telegram botidagi Profil tugmasi orqali oching.'); setLoading(false); return }
    webApp.ready(); webApp.expand()
    fetch('/api/telegram/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: webApp.initData }) })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setProfile(data.profile) })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  const displayName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Wentric xodimi'
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return <><Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" /><main className="min-h-screen bg-[#050505] px-5 py-7 text-white"><div className="mx-auto flex max-w-md flex-col gap-5"><header className="flex items-center gap-3"><Image src="/wentric-logo.png" alt="Wentric logo" width={42} height={42} className="rounded-xl" /><div><p className="text-sm font-semibold">Wentric Employee Bot</p><p className="text-xs text-white/50">@WentricEmployeebot</p></div></header>{loading ? <div className="rounded-3xl border border-white/10 bg-white/[.06] p-7 text-center text-white/60">Profil yuklanmoqda...</div> : error ? <div className="rounded-3xl border border-white/10 bg-white/[.06] p-7 text-center"><p className="text-sm leading-6 text-white/70">{error}</p></div> : profile ? <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[.07] shadow-2xl"><div className="h-24 bg-white/[.08]" /><div className="-mt-12 px-6 pb-7"><div className="grid size-24 place-items-center rounded-3xl border-4 border-[#050505] bg-white text-2xl font-semibold text-black">{profile.avatar_url ? <Image src={profile.avatar_url} alt={displayName} width={88} height={88} className="size-full rounded-[20px] object-cover" /> : initials}</div><div className="mt-4"><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1><span className="size-2 rounded-full bg-white" /></div><p className="mt-1 text-sm text-white/50">{profile.username ? `@${profile.username}` : 'Telegram foydalanuvchisi'}</p></div><div className="mt-7 grid gap-3">{[['Telegram ID', String(profile.telegram_id)], ['Telefon', profile.phone || 'Kiritilmagan'], ['Hudud', [profile.region, profile.district].filter(Boolean).join(', ') || 'Kiritilmagan'], ['Til', profile.language_code || 'uz']].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-white/10 py-3 text-sm"><span className="text-white/50">{label}</span><span className="max-w-[60%] truncate text-right font-medium">{value}</span></div>)}</div>{profile.bio && <p className="mt-5 rounded-2xl bg-black/20 p-4 text-sm leading-6 text-white/70">{profile.bio}</p>}</div></section> : null}<p className="text-center text-xs text-white/30">Profil ma’lumotlari Wentric Employee Bot orqali himoyalangan.</p></div></main></>
}
