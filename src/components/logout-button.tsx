'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200/60 ${className}`}
    >
      <LogOut className="h-4 w-4" /> Sair
    </button>
  )
}
