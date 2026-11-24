'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS, STATUS_STYLES, RequestStatus } from '@/lib/constants'
import { formatBrazilianPhone } from '@/lib/whatsapp'
import { one } from '@/lib/format'
import {
  addDays,
  dayKey,
  dayLabelLong,
  dayLabelShort,
  INTERVAL_OPTIONS,
  minutesOf,
  timeLabel,
  todayKey,
  toISO,
  weekdayOf,
  WEEKDAY_LABELS,
} from '@/lib/schedule'
import { CalendarDays, CheckCircle2, Coffee, Loader2, Lock, MessageCircle, Plus, Settings2, Trash2, Unlock, XCircle } from 'lucide-react'

const DAYS_AHEAD = 14
// Ordem de exibição: segunda a domingo
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

type Rel<T> = T | T[] | null

interface AvailabilityWindow {
  weekday: number
  start_time: string
  end_time: string
}

interface Appointment {
  id: string
  client_id: string | null
  request_id: string | null
  starts_at: string
  ends_at: string
  note: string | null
  profiles: Rel<{ full_name: string; phone_whatsapp: string | null }>
  services: Rel<{ title: string }>
  service_requests: Rel<{ status: RequestStatus }>
}

type TimelineItem =
  | { kind: 'appt'; start: number; end: number; appt: Appointment }
  | { kind: 'free' | 'past'; start: number; end: number; iso: string }

interface ProAgendaProps {
  userId: string
  version: number
  notify: (type: 'ok' | 'error', text: string) => void
  onRequestsChanged: () => void
}

export function ProAgenda({ userId, version, notify, onRequestsChanged }: ProAgendaProps) {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<'agenda' | 'config'>('agenda')
  const [loading, setLoading] = useState(true)
  const [windows, setWindows] = useState<AvailabilityWindow[]>([])
  const [interval, setIntervalMin] = useState(30)
  const [timeOff, setTimeOff] = useState<Set<string>>(new Set())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDay, setSelectedDay] = useState(todayKey())
  const [busy, setBusy] = useState<string | null>(null)

  // Configuração (edição)
  const [draft, setDraft] = useState<Record<number, { start: string; end: string }[]>>({})
  const [draftInterval, setDraftInterval] = useState(30)
  const [savingConfig, setSavingConfig] = useState(false)

  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(todayKey(), i)), [])

  const load = useCallback(async () => {
    const from = toISO(days[0], '00:00')
    const to = toISO(addDays(days[days.length - 1], 1), '00:00')
    const [{ data: av }, { data: off }, { data: appts }, { data: details }] = await Promise.all([
      supabase.from('pro_availability').select('weekday, start_time, end_time').eq('pro_id', userId).order('start_time'),
      supabase.from('pro_time_off').select('day').eq('pro_id', userId).gte('day', days[0]),
      supabase
        .from('appointments')
        .select(
          'id, client_id, request_id, starts_at, ends_at, note, profiles(full_name, phone_whatsapp), services(title), service_requests(status)'
        )
        .eq('pro_id', userId)
        .eq('status', 'booked')
        .gte('starts_at', from)
        .lt('starts_at', to)
        .order('starts_at'),
      supabase.from('pro_details').select('slot_interval_minutes').eq('user_id', userId).single(),
    ])
    const list = ((av as AvailabilityWindow[]) || []).map((w) => ({
      ...w,
      start_time: w.start_time.slice(0, 5),
      end_time: w.end_time.slice(0, 5),
    }))
    setWindows(list)
    setTimeOff(new Set((off || []).map((o: { day: string }) => o.day)))
    setAppointments((appts as unknown as Appointment[]) || [])
    const iv = details?.slot_interval_minutes || 30
    setIntervalMin(iv)
    setDraftInterval(iv)
    const d: Record<number, { start: string; end: string }[]> = {}
    for (const w of list) (d[w.weekday] ||= []).push({ start: w.start_time, end: w.end_time })
    setDraft(d)
    if (list.length === 0) setTab('config')
    setLoading(false)
  }, [days, supabase, userId])

  useEffect(() => {
    load()
  }, [load, version])

  // Monta a linha do tempo de um dia: agendamentos + horários livres/passados
  const buildTimeline = useCallback(
    (key: string): TimelineItem[] => {
      const now = Date.now()
      const dayAppts = appointments.filter((a) => dayKey(a.starts_at) === key)
      const items: TimelineItem[] = dayAppts.map((a) => ({
        kind: 'appt',
        start: new Date(a.starts_at).getTime(),
        end: new Date(a.ends_at).getTime(),
        appt: a,
      }))
      if (!timeOff.has(key)) {
        const wd = weekdayOf(key)
        for (const w of windows.filter((x) => x.weekday === wd)) {
          const startMs = new Date(toISO(key, w.start_time)).getTime()
          const endMs = new Date(toISO(key, w.end_time)).getTime()
          for (let t = startMs; t + interval * 60000 <= endMs; t += interval * 60000) {
            const tEnd = t + interval * 60000
            if (dayAppts.some((a) => new Date(a.starts_at).getTime() < tEnd && new Date(a.ends_at).getTime() > t)) continue
            items.push({ kind: t <= now ? 'past' : 'free', start: t, end: tEnd, iso: new Date(t).toISOString() })
          }
        }
      }
      return items.sort((a, b) => a.start - b.start)
    },
    [appointments, interval, timeOff, windows]
  )

  const summary = useMemo(() => {
    const map: Record<string, { booked: number; blocked: number; free: number }> = {}
    for (const key of days) {
      const tl = buildTimeline(key)
      map[key] = {
        booked: tl.filter((i) => i.kind === 'appt' && i.appt.client_id).length,
        blocked: tl.filter((i) => i.kind === 'appt' && !i.appt.client_id).length,
        free: tl.filter((i) => i.kind === 'free').length,
      }
    }
    return map
  }, [buildTimeline, days])

  async function blockSlot(item: { start: number; end: number }) {
    setBusy(String(item.start))
    const { error } = await supabase.from('appointments').insert({
      pro_id: userId,
      starts_at: new Date(item.start).toISOString(),
      ends_at: new Date(item.end).toISOString(),
      note: 'Bloqueado pelo profissional',
    })
    setBusy(null)
    if (error) notify('error', 'Não foi possível bloquear: o horário pode ter acabado de ser reservado.')
    load()
  }

  async function unblock(id: string) {
    setBusy(id)
    await supabase.from('appointments').delete().eq('id', id)
    setBusy(null)
    load()
  }

  async function setRequestStatus(appt: Appointment, status: RequestStatus) {
    if (!appt.request_id) return
    if (status === 'canceled' && !window.confirm('Cancelar este agendamento? O horário volta a ficar livre.')) return
    setBusy(appt.id)
    const { error } = await supabase.from('service_requests').update({ status }).eq('id', appt.request_id)
    setBusy(null)
    if (error) notify('error', error.message || 'Não foi possível atualizar.')
    else notify('ok', status === 'confirmed' ? 'Horário confirmado!' : 'Agendamento atualizado.')
    onRequestsChanged()
    load()
  }

  async function toggleDayOff(key: string) {
    if (timeOff.has(key)) {
      await supabase.from('pro_time_off').delete().eq('pro_id', userId).eq('day', key)
    } else {
      const hasBookings = (summary[key]?.booked || 0) > 0
      if (
        hasBookings &&
        !window.confirm('Este dia já tem clientes agendados. Eles continuarão marcados; avise-os ou cancele os horários. Continuar?')
      )
        return
      await supabase.from('pro_time_off').insert({ pro_id: userId, day: key })
    }
    load()
  }

  async function saveConfig() {
    // Validação
    for (const wd of WEEK_ORDER) {
      const list = (draft[wd] || []).slice().sort((a, b) => minutesOf(a.start) - minutesOf(b.start))
      for (let i = 0; i < list.length; i++) {
        if (!list[i].start || !list[i].end || minutesOf(list[i].end) <= minutesOf(list[i].start)) {
          return notify('error', `${WEEKDAY_LABELS[wd]}: o horário final precisa ser depois do inicial.`)
        }
        if (i > 0 && minutesOf(list[i].start) < minutesOf(list[i - 1].end)) {
          return notify('error', `${WEEKDAY_LABELS[wd]}: há turnos sobrepostos.`)
        }
      }
    }
    setSavingConfig(true)
    const rows = WEEK_ORDER.flatMap((wd) =>
      (draft[wd] || []).map((r) => ({ pro_id: userId, weekday: wd, start_time: r.start, end_time: r.end }))
    )
    const { error: delError } = await supabase.from('pro_availability').delete().eq('pro_id', userId)
    let error = delError
    if (!error && rows.length > 0) error = (await supabase.from('pro_availability').insert(rows)).error
    if (!error && draftInterval !== interval) {
      error = (await supabase.from('pro_details').update({ slot_interval_minutes: draftInterval }).eq('user_id', userId)).error
    }
    setSavingConfig(false)
    if (error) return notify('error', 'Erro ao salvar os horários.')
    notify('ok', 'Horários de atendimento salvos!')
    setTab('agenda')
    load()
  }

  function updateDraft(wd: number, idx: number, field: 'start' | 'end', value: string) {
    const list = [...(draft[wd] || [])]
    list[idx] = { ...list[idx], [field]: value }
    setDraft({ ...draft, [wd]: list })
  }

  if (loading) {
    return (
      <section className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando agenda...
      </section>
    )
  }

  const timeline = buildTimeline(selectedDay)
  const sel = summary[selectedDay] || { booked: 0, blocked: 0, free: 0 }
  const isOff = timeOff.has(selectedDay)
  const hasWindowsToday = windows.some((w) => w.weekday === weekdayOf(selectedDay))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <CalendarDays className="h-5 w-5 text-[#0F4C81]" /> Minha Agenda
        </h2>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('agenda')}
            className={`rounded-md px-3 py-1.5 ${tab === 'agenda' ? 'bg-white text-[#0F4C81] shadow-sm' : 'text-slate-600'}`}
          >
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setTab('config')}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 ${
              tab === 'config' ? 'bg-white text-[#0F4C81] shadow-sm' : 'text-slate-600'
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" /> Horários
          </button>
        </div>
      </div>

      {tab === 'agenda' && (
        <>
          {windows.length === 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Configure seus horários de atendimento na aba <strong>Horários</strong> para os clientes poderem agendar.
            </p>
          )}

          {/* Próximos dias */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {days.map((key) => {
              const s = summary[key]
              const { weekday, date } = dayLabelShort(key)
              const active = key === selectedDay
              const off = timeOff.has(key)
              const closed = !windows.some((w) => w.weekday === weekdayOf(key))
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={`flex w-[72px] shrink-0 flex-col items-center rounded-lg border px-1 py-2 text-xs transition ${
                    active ? 'border-[#0F4C81] bg-[#0F4C81] text-white' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span className="font-semibold">{key === todayKey() ? 'Hoje' : weekday}</span>
                  <span className="text-sm font-bold">{date}</span>
                  {off ? (
                    <span className={`text-[10px] ${active ? 'text-blue-100' : 'text-slate-400'}`}>Folga</span>
                  ) : closed && s.booked === 0 ? (
                    <span className={`text-[10px] ${active ? 'text-blue-100' : 'text-slate-400'}`}>Fechado</span>
                  ) : (
                    <>
                      <span className={`text-[10px] ${active ? 'text-blue-100' : 'text-indigo-700'}`}>{s.booked} marc.</span>
                      <span className={`text-[10px] ${active ? 'text-blue-100' : 'text-green-700'}`}>{s.free} livres</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {/* Dia selecionado */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{dayLabelLong(selectedDay)}</p>
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-indigo-700">{sel.booked} marcados</span> •{' '}
                <span className="font-semibold text-green-700">{sel.free} livres</span> • {sel.blocked} bloqueados
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleDayOff(selectedDay)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              <Coffee className="h-3.5 w-3.5" /> {isOff ? 'Remover folga' : 'Marcar folga neste dia'}
            </button>
          </div>

          {isOff && (
            <p className="mt-2 rounded-lg bg-slate-100 p-2.5 text-xs text-slate-600">
              Dia marcado como folga: nenhum horário fica disponível para os clientes.
            </p>
          )}
          {!isOff && !hasWindowsToday && windows.length > 0 && (
            <p className="mt-2 rounded-lg bg-slate-100 p-2.5 text-xs text-slate-600">
              Você não atende neste dia da semana.
            </p>
          )}

          <ul className="mt-3 space-y-1.5">
            {timeline.map((item) => {
              if (item.kind === 'appt') {
                const a = item.appt
                const client = one(a.profiles)
                const reqStatus = one(a.service_requests)?.status
                const range = `${timeLabel(a.starts_at)} – ${timeLabel(a.ends_at)}`
                if (!a.client_id) {
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2"
                    >
                      <span className="flex items-center gap-2 text-sm text-slate-600">
                        <Lock className="h-4 w-4" /> <strong className="tabular-nums">{range}</strong> Bloqueado
                      </span>
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => unblock(a.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-300"
                      >
                        <Unlock className="h-3.5 w-3.5" /> Liberar
                      </button>
                    </li>
                  )
                }
                const phone = client?.phone_whatsapp ? formatBrazilianPhone(client.phone_whatsapp) : ''
                return (
                  <li key={a.id} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-indigo-950">
                        <strong className="tabular-nums">{range}</strong> • {client?.full_name || 'Cliente'}
                      </span>
                      {reqStatus && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[reqStatus]}`}>
                          {STATUS_LABELS[reqStatus]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-900/80">
                      {one(a.services)?.title || 'Serviço'}
                      {a.note ? ` • Obs.: ${a.note}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {phone && (
                        <a
                          href={`https://wa.me/${phone}?text=${encodeURIComponent(
                            `Olá ${client?.full_name?.split(' ')[0] || ''}! Sobre seu horário de ${dayLabelLong(selectedDay)} às ${timeLabel(a.starts_at)}:`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-[#16A34A] px-2.5 py-1 text-xs font-bold text-white"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      )}
                      {reqStatus === 'pending' && (
                        <button
                          type="button"
                          disabled={busy === a.id}
                          onClick={() => setRequestStatus(a, 'confirmed')}
                          className="inline-flex items-center gap-1 rounded-md bg-[#0F4C81] px-2.5 py-1 text-xs font-bold text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar
                        </button>
                      )}
                      {reqStatus && reqStatus !== 'completed' && reqStatus !== 'canceled' && (
                        <button
                          type="button"
                          disabled={busy === a.id}
                          onClick={() => setRequestStatus(a, 'canceled')}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-600"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      )}
                    </div>
                  </li>
                )
              }
              const label = timeLabel(new Date(item.start))
              if (item.kind === 'past') {
                return (
                  <li key={item.iso} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-300">
                    <strong className="tabular-nums">{label}</strong> já passou
                  </li>
                )
              }
              return (
                <li
                  key={item.iso}
                  className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5"
                >
                  <span className="text-sm text-green-900">
                    <strong className="tabular-nums">{label}</strong> Livre
                  </span>
                  <button
                    type="button"
                    disabled={busy === String(item.start)}
                    onClick={() => blockSlot(item)}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-300"
                  >
                    <Lock className="h-3.5 w-3.5" /> Bloquear
                  </button>
                </li>
              )
            })}
            {timeline.length === 0 && !isOff && hasWindowsToday && (
              <li className="text-sm text-slate-500">Nenhum horário neste dia.</li>
            )}
          </ul>
          <p className="mt-3 text-[11px] text-slate-400">
            Use &quot;Bloquear&quot; para horários marcados fora do app (telefone, balcão). Clientes só veem os horários livres.
          </p>
        </>
      )}

      {tab === 'config' && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">
            Defina os dias e turnos em que você atende no seu estabelecimento. Para uma pausa de almoço, crie dois turnos
            (ex.: 08:00–12:00 e 13:30–18:00).
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="interval" className="text-sm font-medium text-slate-700">
              Grade de horários a cada
            </label>
            <select
              id="interval"
              value={draftInterval}
              onChange={(e) => setDraftInterval(Number(e.target.value))}
              className="rounded-lg border border-slate-300 p-1.5 text-sm"
            >
              {INTERVAL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>

          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {WEEK_ORDER.map((wd) => {
              const list = draft[wd] || []
              const open = list.length > 0
              return (
                <li key={wd} className="flex flex-wrap items-start gap-3 p-3">
                  <label className="flex w-28 items-center gap-2 pt-1.5 text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={open}
                      onChange={() =>
                        setDraft({ ...draft, [wd]: open ? [] : [{ start: '08:00', end: '18:00' }] })
                      }
                    />
                    {WEEKDAY_LABELS[wd]}
                  </label>
                  <div className="flex-1 space-y-1.5">
                    {!open && <p className="pt-1.5 text-sm text-slate-400">Fechado</p>}
                    {list.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <input
                          type="time"
                          aria-label={`${WEEKDAY_LABELS[wd]} início`}
                          value={r.start}
                          step={900}
                          onChange={(e) => updateDraft(wd, idx, 'start', e.target.value)}
                          className="rounded-lg border border-slate-300 p-1.5 text-sm"
                        />
                        <span className="text-slate-400">até</span>
                        <input
                          type="time"
                          aria-label={`${WEEKDAY_LABELS[wd]} fim`}
                          value={r.end}
                          step={900}
                          onChange={(e) => updateDraft(wd, idx, 'end', e.target.value)}
                          className="rounded-lg border border-slate-300 p-1.5 text-sm"
                        />
                        <button
                          type="button"
                          aria-label="Remover turno"
                          onClick={() => setDraft({ ...draft, [wd]: list.filter((_, i) => i !== idx) })}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {open && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            [wd]: [...list, { start: list[list.length - 1]?.end || '13:00', end: '18:00' }],
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F4C81]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar turno
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={() => {
              const monday = draft[1] || []
              if (monday.length === 0) return notify('error', 'Configure a segunda-feira primeiro.')
              setDraft({ ...draft, 2: [...monday], 3: [...monday], 4: [...monday], 5: [...monday] })
            }}
            className="text-xs font-semibold text-[#0F4C81]"
          >
            Copiar horários de segunda para terça a sexta
          </button>

          <button
            type="button"
            onClick={saveConfig}
            disabled={savingConfig}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#EA580C] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {savingConfig && <Loader2 className="h-4 w-4 animate-spin" />} Salvar Horários de Atendimento
          </button>
        </div>
      )}
    </section>
  )
}
