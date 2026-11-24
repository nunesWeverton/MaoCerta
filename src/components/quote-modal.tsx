'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { buildWhatsAppQuoteUrl } from '@/lib/whatsapp'
import { SHIFT_LABELS } from '@/lib/constants'
import { ImageUploader } from '@/components/image-uploader'
import { safeMediaUrl } from '@/lib/security'
import { CheckCircle2, MessageCircle, Loader2 } from 'lucide-react'

interface QuoteModalProps {
  proId: string
  proName: string
  proPhone: string
  services: { id: string; title: string }[]
  zones: { id: number; name: string }[]
  currentUserId: string | null
}

export function QuoteModal({ proId, proName, proPhone, services, zones, currentUserId }: QuoteModalProps) {
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || '')
  const [selectedZoneId, setSelectedZoneId] = useState<string>(zones[0]?.id ? String(zones[0].id) : '')
  const [preferredShift, setPreferredShift] = useState<keyof typeof SHIFT_LABELS>('esta_semana')
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const hasPhone = proPhone.replace(/\D/g, '').length >= 10

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + '#orcamento')}`
      return
    }
    if (description.trim().length < 10) {
      setError('Descreva com um pouco mais de detalhes o que você precisa (mín. 10 caracteres).')
      return
    }

    setLoading(true)
    setError(null)

    const serviceObj = services.find((s) => s.id === selectedServiceId)
    const zoneObj = zones.find((z) => String(z.id) === selectedZoneId)

    const { error: insertError } = await supabase.from('service_requests').insert({
      client_id: currentUserId,
      pro_id: proId,
      service_id: serviceObj?.id || null,
      zone_id: zoneObj?.id || null,
      description: description.trim(),
      preferred_shift: preferredShift,
      photo_url: photoUrl,
      status: 'pending',
    })

    setLoading(false)

    if (insertError) {
      setError('Erro ao registrar pedido. Tente novamente.')
      return
    }

    setDone(true)
    if (hasPhone) {
      const url = buildWhatsAppQuoteUrl({
        proPhone,
        proName,
        serviceTitle: serviceObj?.title || 'Serviço Geral',
        zoneName: zoneObj?.name || 'Ouro Preto',
        description: description.trim(),
        shiftLabel: SHIFT_LABELS[preferredShift],
      })
      setWhatsappUrl(url)
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[#16A34A]" />
        <h3 className="mt-2 text-lg font-bold text-slate-900">Pedido registrado!</h3>
        <p className="mt-1 text-sm text-slate-600">
          {hasPhone
            ? `Agora é só enviar a mensagem para ${proName} no WhatsApp.`
            : `${proName} vai ver seu pedido no painel e entrar em contato.`}
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#16A34A] px-5 py-2.5 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
            </a>
          )}
          <Link href="/cliente/meus-pedidos" className="text-sm font-semibold text-[#0F4C81]">
            Acompanhar meus pedidos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">Solicitar Orçamento / Agendar</h3>

      {!currentUserId && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Para pedir orçamento você precisa de uma conta grátis — leva menos de 1 minuto.{' '}
          <Link href="/login?cadastro=1" className="font-bold underline">
            Criar conta
          </Link>
        </p>
      )}

      <div>
        <label htmlFor="q-service" className="mb-1 block text-sm font-medium text-slate-700">
          Qual serviço você precisa?
        </label>
        <select
          id="q-service"
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-base"
        >
          {services.map((srv) => (
            <option key={srv.id} value={srv.id}>
              {srv.title}
            </option>
          ))}
          <option value="">Outro serviço</option>
        </select>
      </div>

      <div>
        <label htmlFor="q-zone" className="mb-1 block text-sm font-medium text-slate-700">
          Seu Bairro ou Distrito
        </label>
        <select
          id="q-zone"
          value={selectedZoneId}
          onChange={(e) => setSelectedZoneId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-base"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Quando você precisa?</span>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SHIFT_LABELS) as Array<keyof typeof SHIFT_LABELS>).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={preferredShift === key}
              onClick={() => setPreferredShift(key)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                preferredShift === key ? 'border-[#0F4C81] bg-[#0F4C81] text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {SHIFT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="q-desc" className="mb-1 block text-sm font-medium text-slate-700">
          Descreva o que precisa
        </label>
        <textarea
          id="q-desc"
          rows={3}
          maxLength={800}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex.: Troca de resistência de chuveiro na Bauxita ou corte e escova..."
          className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
        />
      </div>

      {currentUserId && (
        <div>
          {photoUrl && <img src={photoUrl} alt="Foto anexada" className="mb-2 h-20 rounded-md object-cover" />}
          <ImageUploader
            folder="requests"
            userId={currentUserId}
            label={photoUrl ? 'Trocar foto anexada' : 'Anexar foto opcional do problema'}
            onUploadSuccess={(url) => setPhotoUrl(safeMediaUrl(url))}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-lg bg-[#16A34A] py-3.5 text-base font-bold text-white hover:bg-[#15803D] disabled:opacity-60"
      >
        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageCircle className="mr-2 h-5 w-5" />}
        {!currentUserId ? 'Entrar para Pedir Orçamento' : hasPhone ? 'Registrar Pedido e Abrir WhatsApp' : 'Enviar Pedido'}
      </button>
    </form>
  )
}
