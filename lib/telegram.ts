export type TelegramUser = {
  id: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

export type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string }
    from?: TelegramUser
    text?: string
    contact?: { phone_number: string; user_id?: number; first_name?: string }
  }
  callback_query?: {
    id: string
    from: TelegramUser
    data?: string
    message?: { chat: { id: number }; message_id: number }
  }
}

const apiBase = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function telegramRequest<T>(method: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiBase()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Telegram API error: ${response.status}`)
  return response.json() as Promise<{ ok: boolean; result: T }>
}

export function mainKeyboard() {
  return {
    keyboard: [[{ text: 'Profilim' }, { text: 'Vazifalarim' }], [{ text: 'Yordam' }]],
    resize_keyboard: true,
    is_persistent: true,
  }
}

export function inlineMenu() {
  return {
    inline_keyboard: [[{ text: 'Vazifa qo‘shish', callback_data: 'task_add' }, { text: 'Yordam', callback_data: 'help' }]],
  }
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  return telegramRequest('sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup })
}

export async function answerCallbackQuery(id: string) {
  return telegramRequest('answerCallbackQuery', { callback_query_id: id })
}
