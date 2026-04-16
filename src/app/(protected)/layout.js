import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import Sidebar from '@/components/Sidebar'

export default async function ProtectedLayout({ children }) {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, role, full_name, account_id')
    .eq('id', user.id)
    .single()

  const { data: account } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('id', profile?.account_id)
    .single()

  return (
    <div className="min-h-screen min-h-dvh bg-gray-950 flex">
      <Sidebar user={profile} account={account} />
      <main
        className="flex-1 overflow-auto min-w-0 lg:pl-0 pt-14 lg:pt-0"
        id="main-content"
        tabIndex={-1}
      >
        <div className="page-enter">
          {children}
        </div>
      </main>
    </div>
  )
}