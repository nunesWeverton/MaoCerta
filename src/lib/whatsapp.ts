export function formatBrazilianPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits
  }
  return `55${digits}`
}

interface WhatsAppQuoteParams {
  proPhone: string
  proName: string
  serviceTitle: string
  zoneName: string
  description: string
  shiftLabel: string
}

export function buildWhatsAppQuoteUrl({
  proPhone,
  proName,
  serviceTitle,
  zoneName,
  description,
  shiftLabel,
}: WhatsAppQuoteParams): string {
  const cleanPhone = formatBrazilianPhone(proPhone)
  const message = [
    `Olá *${proName}*! Encontrei seu perfil no *MãoCerta* (Ouro Preto).`,
    `*Serviço:* ${serviceTitle}`,
    `*Bairro/Distrito:* ${zoneName}`,
    `*Prazo:* ${shiftLabel}`,
    `*Detalhes:* ${description}`,
    `Podemos conversar sobre um orçamento?`,
  ].join('\n')

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}
