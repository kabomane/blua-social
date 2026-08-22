import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '../../api/auth'
import { uploadAvatar } from '../../api/auth'
import { getCapacity, type Capacity, type OutgoingDelivery } from '../../api/deliveries'
import { getPendingMessages, type PendingMessage } from '../../api/messages'
import TrackingCard from './TrackingCard'
import {
  IconBell,
  IconBird,
  IconBookmark,
  IconBranch,
  IconMail,
  IconMapPin,
  IconUser,
} from '../../components/icons'

interface Props {
  route: string
  user: User
  onUserUpdate: (user: User) => void
}

const card = 'rounded-2xl bg-white p-4.5 shadow-[0_4px_14px_rgba(42,157,244,.08)] dark:border dark:border-night-line dark:bg-night-1 dark:shadow-none'
const muted = 'text-[#5b7a94] dark:text-zinc-500'

function PageHeader({ icon: Icon, title, children }: { icon: typeof IconBird; title: string; children: ReactNode }) {
  return (
    <header className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl text-accent dark:bg-accent/15 dark:text-accent-soft"><Icon /></span>
      <div>
        <h1 className="text-xl font-extrabold">{title}</h1>
        <p className={'mt-0.5 text-[13px] leading-relaxed ' + muted}>{children}</p>
      </div>
    </header>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className={card + ' text-center text-[13px] ' + muted}>{children}</p>
}

function usePending(userId: string, type: PendingMessage['type']) {
  const [messages, setMessages] = useState<PendingMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    const refresh = () => {
      void getPendingMessages(userId, type)
        .then((result) => {
          if (active) setMessages(result)
        })
        .catch(() => {
          if (active) setMessages([])
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }
    refresh()
    const interval = window.setInterval(refresh, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [type, userId])

  return { messages, loading }
}

function remainingTime(deliveredAt: number) {
  const minutes = Math.max(1, Math.ceil((deliveredAt - Date.now()) / 60_000))
  if (minutes < 60) return `${minutes} min restantes`
  const hours = Math.ceil(minutes / 60)
  if (hours < 24) return `${hours} h restantes`
  return `${Math.ceil(hours / 24)} j restants`
}

function PendingCards({ messages, user }: { messages: PendingMessage[]; user: User }) {
  if (!messages.length) return null
  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <article key={message.id} className="rounded-2xl border-2 border-dashed border-accent/45 bg-white/70 p-4.5 shadow-none dark:border-accent/35 dark:bg-night-1/70">
          <div className="flex items-center gap-2 text-[12px] font-extrabold text-accent dark:text-accent-soft">
            {message.method === 'BIRD' ? <IconBird className="animate-pulse" /> : <IconMail className="animate-pulse" />}
            Pris en compte · en cours d’envoi
          </div>
          <div className="mt-3 flex items-center gap-2">
            <b className="text-[14px]">{user.username}</b>
            <span className={'text-[12px] ' + muted}>→ {message.destinationLabel}</span>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed">{message.text}</p>
          <small className={'mt-3 block text-[12px] ' + muted}>{remainingTime(message.deliveredAt)}</small>
        </article>
      ))}
    </div>
  )
}

function Branches({ user }: Pick<Props, 'user'>) {
  const pending = usePending(user.id, 'BRANCH')
  return (
    <>
      <PageHeader icon={IconBranch} title="Branches">Communautés ancrées dans un lieu. Position exacte jamais affichée.</PageHeader>
      {pending.loading ? <EmptyState>Chargement…</EmptyState> : pending.messages.length ? <PendingCards messages={pending.messages} user={user} /> : <EmptyState>Aucune branche à afficher.</EmptyState>}
    </>
  )
}

function Messages({ user }: Pick<Props, 'user'>) {
  const pending = usePending(user.id, 'DIRECT')
  return <><PageHeader icon={IconMail} title="Cui-to-cui">Messages privés, seulement entre amis réciproques.</PageHeader>{pending.loading ? <EmptyState>Chargement…</EmptyState> : pending.messages.length ? <PendingCards messages={pending.messages} user={user} /> : <EmptyState>Aucune conversation.</EmptyState>}</>
}

function Notifications() {
  return <><PageHeader icon={IconBell} title="Notifications">Arrivées et activités utiles. Pas de métriques de popularité.</PageHeader><EmptyState>Aucune notification.</EmptyState></>
}

function Bookmarks() {
  return <><PageHeader icon={IconBookmark} title="Signets">Notes conservées pour y revenir plus tard.</PageHeader><EmptyState>Aucun signet.</EmptyState></>
}

function Profile({ user, onUserUpdate }: Pick<Props, 'user' | 'onUserUpdate'>) {
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [capacity, setCapacity] = useState<Capacity | null>(null)
  const [outgoing, setOutgoing] = useState<OutgoingDelivery[]>([])
  useEffect(() => {
    void getCapacity(user.id).then((result) => {
      setCapacity(result.capacity)
      setOutgoing(result.outgoing)
    }).catch(() => {})
  }, [user.id])
  async function changeAvatar(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choisissez une image JPEG, PNG ou WebP de 5 Mo maximum.')
      return
    }
    setUploading(true)
    setError('')
    try {
      onUserUpdate(await uploadAvatar(user.id, file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Photo impossible à enregistrer.')
    } finally {
      setUploading(false)
    }
  }
  return <><PageHeader icon={IconUser} title="Profil">Identité personnelle.</PageHeader><section className={card}><div className="flex items-center gap-3"><label className="relative block shrink-0 cursor-pointer" title="Changer la photo"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void changeAvatar(event.target.files?.[0])} disabled={uploading} />{user.avatarUrl ? <img src={user.avatarUrl} alt="Photo de profil" className="h-16 w-16 rounded-full object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-extrabold text-white">{user.username[0].toUpperCase()}</span>}{uploading && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-[10px] font-bold text-white">…</span>}</label><div><h2 className="text-lg font-extrabold">{user.username}</h2><p className={muted}>@{user.username}</p></div></div>{error && <p role="alert" className="mt-3 text-[12px] font-semibold text-red-600">{error}</p>}<div className="mt-5 border-t border-sky-100 pt-4 dark:border-night-line"><div className="flex items-center gap-2 text-[14px]"><IconMapPin className="text-accent" /><span>{user.city ?? 'Ville non renseignée'}</span></div></div></section><section className={card + ' mt-3'}><b className="text-[15px]">Capacité</b><div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2"><IconBird className="mx-auto text-lg text-accent" /><b className="mt-1 block">{capacity?.bird.available ?? '—'} / 5</b><small className={muted}>pigeons libres</small></div><div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2"><IconMail className="mx-auto text-lg text-accent" /><b className="mt-1 block">{capacity?.post.available ?? '—'} / 5</b><small className={muted}>lettres libres</small></div></div></section><section className="mt-8 space-y-4"><b className="block px-1 text-[15px]">Mes trajets</b>{outgoing.length ? outgoing.map((delivery) => <TrackingCard key={delivery.id} delivery={delivery} />) : <p className={card + ' text-[13px] ' + muted}>Aucun trajet en cours.</p>}</section></>
}

export default function SecondaryPages({ route, user, onUserUpdate }: Props) {
  if (route === '/branches') return <Branches user={user} />
  if (route === '/messages') return <Messages user={user} />
  if (route === '/arrivals') return <Notifications />
  if (route === '/bookmarks') return <Bookmarks />
  return <Profile user={user} onUserUpdate={onUserUpdate} />
}
