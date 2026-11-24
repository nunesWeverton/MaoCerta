'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, PricingType } from '@/lib/format'
import { formatBrazilianPhone } from '@/lib/whatsapp'
import { addDays, dateTimeLabel, dayKey, dayLabelLong, dayLabelShort, formatDuration, timeLabel, todayKey } from '@/lib/schedule'
import { CalendarCheck, CalendarDays, CheckCircle2, Clock, Loader2, MapPin, MessageCircle } from 'lucide-react'

const DAYS_AHEAD = 14

export interface BookableService {
  id: string
  title: string
  duration_minutes: number
  pricing_type: PricingType
  price_value: number | null
}

interface BookingWidgetProps {
  proId: string
  proName: string
  proPhone: string
  address: string | null
  services: BookableService[]
  currentUserId: string | null
}

export function BookingWidget({ proId, proName, proPhone, address, services, currentUserId }: BookingWidgetProps) {
  const supabase = useMemo(() => createClient(), [])
  const [serviceId, setServiceId] = useState(services[0]?.id || '')
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [booked, setBooked] = useState<string | null>(null)

  const service = services.find((s) => s.id === serviceId)

  const loadSlots = useCallback(async () => {
    if (!service) return
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('available_slots', {
      p_pro_id: proId,
      p_duration: service.duration_minutes,
      p_from: todayKey(),
      p_days: DAYS_AHEAD,
    })
    setLoading(false)
    if (rpcError) {
      setError('Não foi possível carregar a agenda agora.')
      setSlots([])
      return
    }
    const list = ((data as { slot_start: string }[]) || []).map((r) => r.slot_start)
    setSlots(list)
    setSelectedSlot(null)
    setSelectedDay((current) => {
      if (current && list.some((s) => dayKey(s) === current)) return current
      return list.length > 0 ? dayKey(list[0]) : null
    })
  }, [proId, service, supabase])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  const slotsByDay = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const s of slots) (map[dayKey(s)] ||= []).push(s)
    return map
  }, [slots])

  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(todayKey(), i)), [])

  async function handleBook() {
    if (!currentUserId) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + '#agendar')}`
      return
    }
    if (!service || !selectedSlot) return
    setBooking(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('book_appointment', {
      p_service_id: service.id,
      p_start: selectedSlot,
      p_note: note.trim() || null,
      p_photo_url: null,
    })
    setBooking(false)
    if (rpcError) {
      setError(rpcError.message || 'Não foi possível agendar. Tente outro horário.')
      loadSlots()
      return
    }
    setBooked(selectedSlot)
  }

  if (services.length === 0) return null

  if (booked && service) {
    const phone = formatBrazilianPhone(proPhone)
    const msg = [
      `Olá *${proName}*! Acabei de agendar pelo *MãoCerta*:`,
      `*Serviço:* ${service.title}`,
      `*Horário:* ${dateTimeLabel(booked)}`,
      note.trim() ? `*Obs.:* ${note.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[#16A34A]" />
        <h3 className="mt-2 text-lg font-bold text-slate-900">Horário reservado!</h3>
        <p className="mt-1 text-sm text-slate-700">
          <strong>{service.title}</strong> • {dateTimeLabel(booked)}
        </p>
        {address && (
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-600">
            <MapPin className="h-3.5 w-3.5" /> {address}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">{proName} vai confirmar o horário. Você acompanha em Meus Pedidos.</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          {phone.length >= 12 && (
            <a
              href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#16A34A] px-5 py-2.5 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> Avisar no WhatsApp
            </a>
          )}
          <Link href="/cliente/meus-pedidos" className="text-sm font-semibold text-[#0F4C81]">
            Ver meus agendamentos
          </Link>
        </div>
      </div>
    )
  }

  const daySlots = selectedDay ? slotsByDay[selectedDay] || [] : []

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <CalendarDays className="h-5 w-5 text-[#0F4C81]" /> Agendar horário
        </h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" /> Atendimento no estabelecimento{address ? `: ${address}` : ''}
        </p>
      </div>

      {!currentUserId && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Escolha o horário; para confirmar você precisa de uma conta grátis.{' '}
          <Link href="/login?cadastro=1" className="font-bold underline">
            Criar conta
          </Link>
        </p>
      )}

      <div>
        <label htmlFor="b-service" className="mb-1 block text-sm font-medium text-slate-700">
          Serviço
        </label>
        <select
          id="b-service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-base"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} • {formatDuration(s.duration_minutes)} • {formatPrice(s.pricing_type, s.price_value)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Datas disponíveis (próximos {DAYS_AHEAD} dias)</span>
        {loading ? (
          <p className="flex items-center gap-2 py-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando agenda...
          </p>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((key) => {
              const count = slotsByDay[key]?.length || 0
              const { weekday, date } = dayLabelShort(key)
              const active = key === selectedDay
              return (
                <button
                  key={key}
                  type="button"
                  disabled={count === 0}
                  onClick={() => {
                    setSelectedDay(key)
                    setSelectedSlot(null)
                  }}
                  className={`flex w-16 shrink-0 flex-col items-center rounded-lg border px-1 py-2 text-xs transition ${
                    active
                      ? 'border-[#0F4C81] bg-[#0F4C81] text-white'
                      : count === 0
                        ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#0F4C81]'
                  }`}
                >
                  <span className="font-semibold">{weekday}</span>
                  <span className="text-sm font-bold">{date}</span>
                  <span className={`mt-0.5 text-[10px] ${active ? 'text-blue-100' : count === 0 ? '' : 'text-green-700'}`}>
                    {count === 0 ? 'Sem vaga' : `${count} livre${count > 1 ? 's' : ''}`}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!loading && slots.length === 0 && !error && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Nenhum horário livre nos próximos {DAYS_AHEAD} dias. Fale com {proName} pelo WhatsApp para verificar encaixes.
        </p>
      )}

      {selectedDay && daySlots.length > 0 && (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Horários livres • {dayLabelLong(selectedDay)}</span>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {daySlots.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={selectedSlot === s}
                onClick={() => setSelectedSlot(s)}
                className={`rounded-lg border py-2 text-sm font-semibold transition ${
                  selectedSlot === s
                    ? 'border-[#16A34A] bg-[#16A34A] text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-[#16A34A]'
                }`}
              >
                {timeLabel(s)}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedSlot && service && (
        <>
          <p className="flex items-center gap-1.5 rounded-lg bg-green-50 p-2.5 text-sm text-green-900">
            <Clock className="h-4 w-4" /> {service.title}: {dateTimeLabel(selectedSlot)} (duração {formatDuration(service.duration_minutes)})
          </p>
          <textarea
            rows={2}
            maxLength={400}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação opcional (ex.: cabelo longo, alergia a algum produto...)"
            aria-label="Observação"
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
          />
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleBook}
        disabled={!selectedSlot || booking}
        className="flex w-full items-center justify-center rounded-lg bg-[#16A34A] py-3.5 text-base font-bold text-white hover:bg-[#15803D] disabled:opacity-50"
      >
        {booking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CalendarCheck className="mr-2 h-5 w-5" />}
        {!selectedSlot ? 'Escolha um horário' : currentUserId ? 'Confirmar agendamento' : 'Entrar para confirmar'}
      </button>
    </div>
  )
}
