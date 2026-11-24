'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Loader2, Megaphone } from 'lucide-react'

interface DemandFormProps {
  q?: string
  categoria?: string
  bairro?: string
  compact?: boolean
}

/** Registra o que o morador procurou e não encontrou (validação de demanda) */
export function DemandForm({ q, categoria, bairro, compact = false }: DemandFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(!compact)
  const [details, setDetails] = useState(q || '')
  const [whatsapp, setWhatsapp] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (details.trim().length < 3) {
      setError('Conte em poucas palavras o serviço que você procura.')
      return
    }
    setSending(true)
    setError(null)
    const zoneId = bairro && /^\d+$/.test(bairro) ? Number(bairro) : null
    const { error: insertError } = await supabase.from('demand_signals').insert({
      category: categoria || null,
      zone_id: zoneId,
      search_text: q?.slice(0, 200) || null,
      details: details.trim().slice(0, 500),
      contact_whatsapp: whatsapp.replace(/\D/g, '').slice(0, 20) || null,
    })
    setSending(false)
    if (insertError) {
      setError('Não foi possível enviar agora. Tente novamente.')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <CheckCircle2 className="h-5 w-5" /> Obrigado! Vamos buscar profissionais para esse serviço na sua região.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F4C81] hover:underline"
      >
        <Megaphone className="h-4 w-4" /> Não encontrou o que precisava? Conte para a gente
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left">
      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        <Megaphone className="h-4 w-4 text-[#EA580C]" /> Não encontrou? Conte o que você precisa
      </p>
      <p className="text-xs text-slate-500">
        Usamos esses pedidos para convidar profissionais para Ouro Preto e distritos.
      </p>
      <textarea
        rows={2}
        maxLength={500}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Ex.: diarista em Cachoeira do Campo, conserto de geladeira..."
        aria-label="Serviço que você procura"
        className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
      />
      <input
        type="tel"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        placeholder="Seu WhatsApp (opcional, para avisarmos)"
        aria-label="WhatsApp opcional"
        className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
      />
      {whatsapp && (
        <p className="text-[11px] text-slate-500">
          Ao informar o WhatsApp, você autoriza o MãoCerta a contatá-lo apenas sobre este pedido.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA580C] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {sending && <Loader2 className="h-4 w-4 animate-spin" />} Enviar
      </button>
    </form>
  )
}
