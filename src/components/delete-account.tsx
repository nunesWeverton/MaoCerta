'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Trash2 } from 'lucide-react'

/** LGPD: exclusão da conta pelo próprio titular dos dados */
export function DeleteAccount() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('delete_my_account')
    if (rpcError) {
      setLoading(false)
      setError(rpcError.message || 'Não foi possível excluir a conta agora.')
      return
    }
    await supabase.auth.signOut().catch(() => null)
    window.location.href = '/?conta=excluida'
  }

  return (
    <section className="rounded-xl border border-red-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">Minha conta e meus dados</h2>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline"
        >
          <Trash2 className="h-4 w-4" /> Excluir minha conta
        </button>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-slate-700">
            Isso apaga <strong>definitivamente</strong> seu perfil, sua vitrine (se tiver), serviços, fotos cadastradas,
            agenda, pedidos e avaliações. Não é possível desfazer.
          </p>
          <label htmlFor="confirm-delete" className="block text-xs text-slate-600">
            Para confirmar, digite <strong>EXCLUIR</strong>:
          </label>
          <input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            autoComplete="off"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={confirmText.trim().toUpperCase() !== 'EXCLUIR' || loading}
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Excluir definitivamente
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setConfirmText('')
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
