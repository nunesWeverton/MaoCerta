export const SERVICE_CATEGORIES = {
  obras_manutencao: {
    label: 'Obras, Reformas e Manutenção',
    subcategories: [
      'Pedreiro e Alvenaria',
      'Encanador e Hidráulica',
      'Pintor Residencial e Comercial',
      'Eletricista e Pequenos Reparos',
      'Serralheria, Marcenaria e Vidraçaria',
    ],
  },
  beleza_estetica: {
    label: 'Beleza, Estética e Bem-Estar',
    subcategories: [
      'Cabeleireiro(a) e Escovista',
      'Barbearia',
      'Manicure, Pedicure e Nail Designer',
      'Estética Facial e Corporal',
      'Maquiagem, Sobrancelhas e Cílios',
    ],
  },
} as const

export type CategoryKey = keyof typeof SERVICE_CATEGORIES

export const PRICING_LABELS = {
  fixed: 'Preço Fixo',
  starting_at: 'A partir de',
  quote: 'Sob Orçamento',
} as const

export const SHIFT_LABELS = {
  urgente: 'Urgente / Hoje',
  esta_semana: 'Esta semana',
  sem_pressa: 'Sem pressa / Pesquisando',
} as const

export const STATUS_LABELS = {
  pending: 'Aguardando resposta',
  negotiating: 'Em negociação',
  confirmed: 'Horário confirmado',
  completed: 'Concluído',
  canceled: 'Cancelado',
} as const

export type RequestStatus = keyof typeof STATUS_LABELS

export const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  negotiating: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  canceled: 'bg-slate-200 text-slate-600',
}

export const LOCATION_LABELS = {
  client_site: 'Atende no local do cliente',
  pro_studio: 'Atendimento no estabelecimento',
  both: 'No local do cliente ou no seu espaço',
} as const

export type LocationKey = keyof typeof LOCATION_LABELS

export const OPEN_STATUSES: RequestStatus[] = ['pending', 'negotiating', 'confirmed']

/** Categorias com atendimento somente no estabelecimento e agendamento online */
export const SCHEDULED_CATEGORIES: CategoryKey[] = ['beleza_estetica']

export function isScheduledCategory(category: string): boolean {
  return (SCHEDULED_CATEGORIES as string[]).includes(category)
}

export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || ''
