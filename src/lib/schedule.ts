// Todas as datas da agenda são exibidas no horário de Ouro Preto (Brasília),
// independentemente do fuso do aparelho de quem está usando.
export const TZ = 'America/Sao_Paulo'
// O Brasil não tem horário de verão desde 2019: o deslocamento é fixo.
const OFFSET = '-03:00'

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** 'YYYY-MM-DD' no fuso de Ouro Preto */
export function dayKey(date: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    typeof date === 'string' ? new Date(date) : date
  )
}

export function todayKey(): string {
  return dayKey(new Date())
}

function noonOf(key: string): Date {
  return new Date(`${key}T12:00:00${OFFSET}`)
}

export function addDays(key: string, n: number): string {
  const d = noonOf(key)
  d.setUTCDate(d.getUTCDate() + n)
  return dayKey(d)
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(key: string): number {
  return noonOf(key).getUTCDay()
}

/** Converte data + 'HH:MM' (horário de Ouro Preto) em ISO */
export function toISO(key: string, hhmm: string): string {
  return new Date(`${key}T${hhmm.slice(0, 5)}:00${OFFSET}`).toISOString()
}

export function timeLabel(iso: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(
    typeof iso === 'string' ? new Date(iso) : iso
  )
}

export function dayLabelShort(key: string): { weekday: string; date: string } {
  const [, m, d] = key.split('-')
  return { weekday: WEEKDAY_SHORT[weekdayOf(key)], date: `${d}/${m}` }
}

export function dayLabelLong(key: string): string {
  const [y, m, d] = key.split('-')
  return `${WEEKDAY_LABELS[weekdayOf(key)]}, ${d}/${m}/${y}`
}

export function dateTimeLabel(iso: string): string {
  const key = dayKey(iso)
  const { weekday, date } = dayLabelShort(key)
  return `${weekday} ${date} às ${timeLabel(iso)}`
}

/** 'HH:MM' + minutos -> 'HH:MM' */
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240]
export const INTERVAL_OPTIONS = [15, 30, 45, 60]
