import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '../../api/auth'
import { uploadAvatar } from '../../api/auth'
import { getCapacity, type Capacity, type OutgoingDelivery } from '../../api/deliveries'
import { getPendingMessages, type PendingMessage } from '../../api/messages'
import { createBranch, getBranches, type BranchSummary } from '../../api/branches'
import TrackingCard from './TrackingCard'
import NoteCard, { type NoteCardData } from './NoteCard'
import { formatArrivalAge } from './note-utils'
import FloatingActionButton from '../../components/FloatingActionButton'
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
  bookmarks: readonly LocalBookmark[]
  onOpenBookmark: (id: string) => void
  onToggleBookmark: (id: string) => void
  onReplyBookmark: (id: string) => void
  onTransmitBookmark: (id: string) => void
  onOpenBranch: (branch: BranchSummary) => void
}

export interface LocalBookmark extends NoteCardData {
  arrivedAt: number
  transmissions: number
  replies: { id: string }[]
}

const card = 'rounded-2xl bg-white p-4.5 shadow-card dark:border dark:border-night-line dark:bg-night-1 dark:shadow-none'
const muted = 'text-ink-muted dark:text-zinc-500'

function currentGpsPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('La géolocalisation GPS n’est pas disponible sur cet appareil.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'La position GPS est obligatoire pour créer une branche.'
          : error.code === error.TIMEOUT
            ? 'La localisation GPS a expiré. Réessayez.'
            : 'Position GPS actuelle impossible à obtenir.'
        reject(new Error(message))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    )
  })
}

function PageHeader({ icon: Icon, title, children }: { icon: typeof IconBird; title: string; children: ReactNode }) {
  return (
    <header className="mb-5 hidden items-start gap-3 lg:flex">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl text-accent dark:bg-accent/15 dark:text-accent-soft"><Icon /></span>
      <div>
        <h1 className="text-xl font-extrabold">{title}</h1>
        <p className={'mt-0.5 text-meta leading-relaxed ' + muted}>{children}</p>
      </div>
    </header>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className={card + ' text-center text-meta ' + muted}>{children}</p>
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
          <div className="flex items-center gap-2 text-caption font-extrabold text-accent dark:text-accent-soft">
            {message.method === 'BIRD' ? <IconBird className="animate-pulse" /> : <IconMail className="animate-pulse" />}
            Pris en compte · en cours d’envoi
          </div>
          <div className="mt-3 flex items-center gap-2">
            <b className="text-label">{user.username}</b>
            <span className={'text-caption ' + muted}>→ {message.destinationLabel}</span>
          </div>
          <p className="mt-3 text-label leading-relaxed">{message.text}</p>
          <small className={'mt-3 block text-caption ' + muted}>{remainingTime(message.deliveredAt)}</small>
        </article>
      ))}
    </div>
  )
}

function Branches({ user, onOpenBranch }: Pick<Props, 'user' | 'onOpenBranch'>) {
  const pending = usePending(user.id, 'BRANCH')
  const [view, setView] = useState<'mine' | 'discover'>('mine')
  const [branches, setBranches] = useState<BranchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void getBranches(user.id, view)
      .then((result) => {
        if (active) setBranches(result.branches)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Branches impossibles à charger.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id, view])

  async function submitBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || name.trim().length < 2) return
    setSaving(true)
    setError('')
    try {
      const position = await currentGpsPosition()
      const result = await createBranch(user.id, name.trim(), visibility, position)
      setBranches((current) => [result.branch, ...current])
      setName('')
      setVisibility('PUBLIC')
      setCreating(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader icon={IconBranch} title="Branches">Communautés ancrées dans un lieu. Position exacte jamais affichée.</PageHeader>

      <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-400/10 p-1 dark:bg-night-2" role="tablist" aria-label="Flux des branches">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'mine'}
          onClick={() => setView('mine')}
          className={'min-h-11 rounded-lg text-label font-extrabold transition ' + (view === 'mine' ? 'bg-white text-accent shadow-sm dark:bg-night-1 dark:text-accent-soft' : muted)}
        >
          Mes branches
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'discover'}
          onClick={() => {
            setView('discover')
            setCreating(false)
          }}
          className={'min-h-11 rounded-lg text-label font-extrabold transition ' + (view === 'discover' ? 'bg-white text-accent shadow-sm dark:bg-night-1 dark:text-accent-soft' : muted)}
        >
          Découvrir
        </button>
      </div>

      <div
        key={view}
        className={view === 'mine' ? 'branch-feed-from-left' : 'branch-feed-from-right'}
      >
      {view === 'mine' && (
        <>
          {creating && (
            <form onSubmit={submitBranch} className={card + ' mb-4'}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <b className="text-control">Nouvelle branche</b>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className={'min-h-10 px-2 text-meta font-bold ' + muted}
                >
                  Annuler
                </button>
              </div>
              <label className="block text-meta font-bold">
                Nom de la branche
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  autoFocus
                  placeholder="Ex. Lecteurs du Vieux-Lille"
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-sky-100 bg-sky-50 px-3 text-body outline-none focus:border-accent dark:border-night-line dark:bg-night-2"
                />
              </label>
              <fieldset className="mt-4">
                <legend className="text-meta font-bold">Visibilité</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['PUBLIC', 'PRIVATE'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={visibility === option}
                      onClick={() => setVisibility(option)}
                      className={'min-h-11 rounded-xl border text-label font-bold transition ' + (visibility === option ? 'border-accent bg-accent/10 text-accent dark:text-accent-soft' : 'border-sky-100 dark:border-night-line ' + muted)}
                    >
                      {option === 'PUBLIC' ? 'Publique' : 'Privée'}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className={'mt-3 text-caption ' + muted}>
                Une nouvelle position GPS est obligatoire à chaque création. Elle ancre définitivement la branche sans modifier la position de votre profil.
              </p>
              <button
                type="submit"
                disabled={saving || name.trim().length < 2}
                className="mt-4 min-h-11 w-full rounded-xl bg-accent px-4 text-label font-extrabold text-white disabled:opacity-40"
              >
                {saving ? 'Localisation et création…' : 'Créer la branche'}
              </button>
            </form>
          )}
        </>
      )}

      {error && <p role="alert" className="mb-4 text-center text-meta font-semibold text-red-600 dark:text-red-400">{error}</p>}

      {!creating && view === 'mine' && pending.messages.length > 0 && (
        <section className="mb-4">
          <b className="mb-2 block px-1 text-meta">Notes en cours d’envoi</b>
          <PendingCards messages={pending.messages} user={user} />
        </section>
      )}

      {!creating && (loading ? (
        <EmptyState>Chargement…</EmptyState>
      ) : branches.length ? (
        <div className="space-y-3">
          {branches.map((branch) => (
            <article
              key={branch.id}
              className={card + (view === 'mine' ? ' cursor-pointer transition hover:ring-2 hover:ring-accent/35' : '')}
              role={view === 'mine' ? 'button' : undefined}
              tabIndex={view === 'mine' ? 0 : undefined}
              onClick={view === 'mine' ? () => onOpenBranch(branch) : undefined}
              onKeyDown={view === 'mine' ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenBranch(branch)
                }
              } : undefined}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl text-accent dark:bg-accent/15 dark:text-accent-soft">
                  <IconBranch />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-body">{branch.name}</b>
                  <p className={'mt-1 text-caption ' + muted}>
                    {branch.visibility === 'PUBLIC' ? 'Publique' : 'Privée'}
                    {branch.role ? ` · ${branch.role === 'OWNER' ? 'Propriétaire' : branch.role === 'MODERATOR' ? 'Modérateur' : 'Membre'}` : ''}
                  </p>
                </div>
                <span className={'shrink-0 text-caption ' + muted}>
                  {branch.distanceKm < 1 ? 'À proximité' : `${Math.round(branch.distanceKm).toLocaleString('fr-FR')} km`}
                </span>
              </div>
              <p className={'mt-3 border-t border-sky-100 pt-3 text-meta dark:border-night-line ' + muted}>
                {branch.memberCount} membre{branch.memberCount > 1 ? 's' : ''}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState>
          {view === 'mine' ? 'Vous ne faites encore partie d’aucune branche.' : 'Aucune branche publique à découvrir.'}
        </EmptyState>
      ))}
      </div>

      {view === 'mine' && !creating && (
        <FloatingActionButton
          label="Créer une branche"
          onClick={() => {
            setCreating(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <IconBranch />
        </FloatingActionButton>
      )}
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

function Bookmarks({
  bookmarks,
  onOpenBookmark,
  onToggleBookmark,
  onReplyBookmark,
  onTransmitBookmark,
}: Pick<Props, 'bookmarks' | 'onOpenBookmark' | 'onToggleBookmark' | 'onReplyBookmark' | 'onTransmitBookmark'>) {
  return (
    <>
      <PageHeader icon={IconBookmark} title="Signets">Notes conservées pour y revenir plus tard.</PageHeader>
      {bookmarks.length ? (
        <div className="space-y-3">
          {bookmarks.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              age={formatArrivalAge(note.arrivedAt)}
              replyCount={note.replies.length}
              transmissionCount={note.transmissions}
              bookmarked
              onOpen={() => onOpenBookmark(note.id)}
              onReply={() => onReplyBookmark(note.id)}
              onTransmit={() => onTransmitBookmark(note.id)}
              onToggleBookmark={() => onToggleBookmark(note.id)}
            />
          ))}
        </div>
      ) : <EmptyState>Aucun signet.</EmptyState>}
    </>
  )
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
  return <><PageHeader icon={IconUser} title="Profil">Identité personnelle.</PageHeader><section className={card}><div className="flex items-center gap-3"><label className="relative block shrink-0 cursor-pointer" title="Changer la photo"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void changeAvatar(event.target.files?.[0])} disabled={uploading} />{user.avatarUrl ? <img src={user.avatarUrl} alt="Photo de profil" className="h-16 w-16 rounded-full object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-extrabold text-white">{user.username[0].toUpperCase()}</span>}{uploading && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-micro font-bold text-white">…</span>}</label><div><h2 className="text-lg font-extrabold">{user.username}</h2><p className={muted}>@{user.username}</p></div></div>{error && <p role="alert" className="mt-3 text-caption font-semibold text-red-600">{error}</p>}<div className="mt-5 border-t border-sky-100 pt-4 dark:border-night-line"><div className="flex items-center gap-2 text-label"><IconMapPin className="text-accent" /><span>{user.city ?? 'Ville non renseignée'}</span></div></div></section><section className={card + ' mt-3'}><b className="text-control">Capacité</b><div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2"><IconBird className="mx-auto text-lg text-accent" /><b className="mt-1 block">{capacity?.bird.available ?? '—'} / 5</b><small className={muted}>pigeons libres</small></div><div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2"><IconMail className="mx-auto text-lg text-accent" /><b className="mt-1 block">{capacity?.post.available ?? '—'} / 5</b><small className={muted}>lettres libres</small></div></div></section><section className="mt-8 space-y-4"><b className="block px-1 text-control">Mes trajets</b>{outgoing.length ? outgoing.map((delivery) => <TrackingCard key={delivery.id} delivery={delivery} />) : <p className={card + ' text-meta ' + muted}>Aucun trajet en cours.</p>}</section></>
}

export default function SecondaryPages({ route, user, onUserUpdate, bookmarks, onOpenBookmark, onToggleBookmark, onReplyBookmark, onTransmitBookmark, onOpenBranch }: Props) {
  if (route === '/branches') return <Branches user={user} onOpenBranch={onOpenBranch} />
  if (route === '/messages') return <Messages user={user} />
  if (route === '/arrivals') return <Notifications />
  if (route === '/bookmarks') return <Bookmarks bookmarks={bookmarks} onOpenBookmark={onOpenBookmark} onToggleBookmark={onToggleBookmark} onReplyBookmark={onReplyBookmark} onTransmitBookmark={onTransmitBookmark} />
  return <Profile user={user} onUserUpdate={onUserUpdate} />
}
