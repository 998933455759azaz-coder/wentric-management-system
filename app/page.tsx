import Image from 'next/image'
import { Bot, CheckCircle2, ExternalLink, Terminal, Webhook } from 'lucide-react'
import { WebhookSetup } from '@/components/webhook-setup'

const steps = [
  { icon: Terminal, title: 'Tokenni kiriting', text: 'BotFather bergan tokenni TELEGRAM_BOT_TOKEN o‘zgaruvchisiga qo‘ying.' },
  { icon: Webhook, title: 'Webhook ulang', text: 'Deploy qiling va /api/telegram/webhook manzilini Telegramga ulang.' },
  { icon: CheckCircle2, title: 'Sinab ko‘ring', text: 'Telegramda /start yuboring. Profil va vazifalar menyusi tayyor.' },
]

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-8 md:px-10 md:py-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Image src="/wentric-logo.png" alt="Wentric logo" width={40} height={40} className="rounded-xl" /><span className="font-semibold tracking-tight">Wentric Employee Bot</span></div>
          <a className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground" href="/api/telegram/webhook">Webhook <ExternalLink size={14} /></a>
        </header>
        <section className="grid items-center gap-12 md:grid-cols-[1.15fr_.85fr] md:py-12">
          <div className="flex flex-col gap-7">
            <div className="w-fit rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">Wentric Employee Bot · @WentricEmployeebot</div>
            <h1 className="max-w-2xl text-balance text-5xl font-semibold tracking-[-0.05em] md:text-7xl">Xodimlar uchun aqlli Telegram yordamchi.</h1>
            <p className="max-w-xl text-pretty text-lg leading-8 text-muted-foreground">Foydalanuvchilarni ro‘yxatdan o‘tkazing, profilini saqlang va vazifalarini Telegram ichida boshqaring.</p>
            <div className="flex flex-wrap gap-3"><a href="#qollanma" className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5">Qo‘llanmani ko‘rish</a><a href="/api/telegram/webhook" className="rounded-lg border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted">Webhook endpoint</a></div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="mb-6 flex items-center gap-3 border-b border-border pb-5"><Image src="/wentric-logo.png" alt="Wentric logo" width={36} height={36} className="rounded-full" /><div><p className="text-sm font-medium">Wentric Employee Bot</p><p className="text-xs text-muted-foreground">@WentricEmployeebot</p><p className="text-xs text-muted-foreground">online</p></div></div><div className="flex flex-col gap-3 text-sm"><div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted p-3 leading-6">Assalomu alaykum! Men sizning yordamchingizman.</div><div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-sm bg-primary p-3 text-primary-foreground">Vazifalarim</div><div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted p-3 leading-6">Sizda hozircha vazifalar yo‘q.</div></div></div>
        </section>
        <section className="border-t border-border pt-12"><WebhookSetup /></section>
        <section id="qollanma" className="flex flex-col gap-8 border-t border-border pt-12"><div><p className="mb-2 text-sm font-medium text-muted-foreground">Boshlash</p><h2 className="text-3xl font-semibold tracking-tight">Uch qadamda ishga tushiring</h2></div><div className="grid gap-4 md:grid-cols-3">{steps.map((step) => <article key={step.title} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6"><step.icon className="text-primary" size={22} /><h3 className="text-lg font-medium">{step.title}</h3><p className="text-sm leading-6 text-muted-foreground">{step.text}</p></article>)}</div></section>
        <section className="grid gap-8 border-t border-border pt-12 md:grid-cols-2"><div><p className="mb-2 text-sm font-medium text-muted-foreground">Buyruqlar</p><h2 className="text-2xl font-semibold">Bot nimalarni biladi?</h2></div><div className="grid gap-3 text-sm">{[['/start','Boshlash va menyuni ko‘rsatish'],['/profile','Profil ma’lumotlarini ko‘rish'],['/tasks','Faol vazifalarni ko‘rish'],['/help','Yordam va yo‘riqnoma']].map(([command, text]) => <div key={command} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"><code className="font-mono text-primary">{command}</code><span className="text-muted-foreground">{text}</span></div>)}</div></section>
      </div>
    </main>
  )
}
