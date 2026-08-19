import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { clearUser, type User } from '../../api/auth'
import MobileNavigation, {
  type MobileNavDestination,
} from '../../components/MobileNavigation'
import SecondaryPages from './SecondaryPages'
import { getCapacity, sendHome } from '../../api/deliveries'
import { kvGet, kvSet } from '../../lib/blua-local'
import {
  IconBell,
  IconBird,
  IconBookmark,
  IconBranch,
  IconHome,
  IconLogout,
  IconMail,
  IconMapPin,
  IconMoon,
  IconRepeat,
  IconReply,
  IconSend,
  IconSettings,
  IconSun,
  IconUser,
} from '../../components/icons'

interface Props {
  user: User
  dark: boolean
  toggleDark: () => void
  onLogout: () => void
  onUserUpdate: (user: User) => void
}

interface Note {
  id: string
  author: string
  handle: string
  color: string
  method: 'BIRD' | 'POST'
  distance: string
  arrivedAt: number
  text: string
  transmissions: number
  replies: DemoReply[]
}

interface DemoReply {
  id: string
  author: string
  handle: string
  text: string
  age: string
}

interface PendingReply extends DemoReply {
  method: Carrier
}

interface BranchEcho {
  id: string
  echo: true
  branch: string
  distance: string
  activity: string
  text: string
}

/**
 * Libellé d'arrivée homogène, sans préfixe « il y a ».
 * < 1 h : min · aujourd'hui : h · nuit : cette nuit · hier : hier ·
 * < 30 j : j · < 24 mois : mois · ensuite : ans.
 */
function formatArrivalAge(arrivedAt: number, now = new Date()): string {
  const date = new Date(arrivedAt)
  const elapsedMs = Math.max(0, now.getTime() - arrivedAt)
  const minutes = Math.floor(elapsedMs / 60_000)
  const hours = Math.floor(elapsedMs / 3_600_000)
  const days = Math.floor(elapsedMs / 86_400_000)
  const isToday = date.toDateString() === now.toDateString()

  if (isToday && date.getHours() < 6) return 'cette nuit'
  if (minutes < 1) return 'maintenant'
  if (minutes < 60) return `${minutes} min`
  if (isToday) return `${hours}h`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'hier'
  if (days < 30) return `${days}j`

  const months = Math.floor(days / 30)
  if (months < 24) return `${months} mois`
  return `${Math.floor(months / 12)} ans`
}

// ---------------------------------------------------------------------------
// Données de démonstration — remplacées par l'API (messages/deliveries)
// quand le backend feed sera branché.
// ---------------------------------------------------------------------------
const DEMO_NOW = Date.now()
const DEMO_FEED: (Note | BranchEcho)[] = [
  {
    id: 'm1',
    author: 'Alice',
    handle: 'alice',
    color: '#f47f2a',
    method: 'BIRD' as const,
    distance: '391 km',
    arrivedAt: DEMO_NOW - 20 * 60_000,
    replies: [
      { id: 'r1', author: 'Noah', handle: 'noah', text: 'Oui, la discussion après la séance était incroyable.', age: '14 min' },
      { id: 'r2', author: 'Lina', handle: 'lina', text: 'Je cherche encore où le revoir. Tu me diras si tu trouves.', age: '8 min' },
    ],
    transmissions: 4,
    text: "Quelqu'un a vu le film hier soir au ciné-club ? Je n'arrête pas d'y penser…",
  },
  {
    id: 'e1',
    echo: true as const,
    branch: 'Photo de rue Paris',
    distance: '4,1 km',
    activity: '89 arrivées récentes',
    text: '« Vous shootez avec quoi la nuit ? Le grain de la pellicule me manque… »',
  },
  {
    id: 'm2',
    author: 'Marc',
    handle: 'marc',
    color: '#7d4cd6',
    method: 'POST' as const,
    distance: '264 km',
    arrivedAt: DEMO_NOW - 2 * 3_600_000,
    replies: [
      { id: 'r3', author: 'Maya', handle: 'maya', text: 'Cette branche près du Fuji est restée dans ma tête aussi.', age: '1 h' },
    ],
    transmissions: 1,
    text: "Je viens de rentrer du Japon. J'ai laissé une branche là-bas, près du Fuji — envoyez-y un message un jour.",
  },
  {
    id: 'm3',
    author: 'Emma',
    handle: 'emma',
    color: '#d64c7d',
    method: 'BIRD' as const,
    distance: '9 726 km',
    arrivedAt: DEMO_NOW - 29 * 86_400_000,
    replies: [
      { id: 'r4', author: 'Noah', handle: 'noah', text: 'Tokyo à Paris, quel trajet. Bien reçu de mon côté.', age: '12 j' },
      { id: 'r5', author: 'Lina', handle: 'lina', text: 'Paris te répond : le ciel est gris, mais les cafés sont pleins.', age: '8 j' },
    ],
    transmissions: 8,
    text: "Ce message a quitté Tokyo il y a un mois. S'il est arrivé jusqu'à toi, raconte-moi Paris.",
  },
]

const DEMO_BRANCHES = [
  { name: 'Étudiants Paris', info: '2,3 km · très active' },
  { name: 'Cinéma indépendant', info: "6,7 km · 41 arrivées aujourd'hui" },
  { name: 'Insomniaques de Soho', info: 'Londres · forte activité' },
]

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>

interface NavDestination extends MobileNavDestination {
  icon: IconCmp
  desktopBadge?: number
}

// Explorer et Mes branches sont réunis dans une seule destination Branches.
const NAV: NavDestination[] = [
  { route: '/home', icon: IconHome, label: 'Home' },
  { route: '/branches', icon: IconBranch, label: 'Branches' },
  { route: '/messages', icon: IconMail, label: 'Cui-to-cui', desktopBadge: 2 },
  { route: '/arrivals', icon: IconBell, label: 'Notifications' },
  { route: '/bookmarks', icon: IconBookmark, label: 'Signets', kind: 'bookmarks' },
  { route: '/profile', icon: IconUser, label: 'Profil' },
  { route: '/settings', icon: IconSettings, label: 'Paramètres' },
]

const SHORTCUT_OPTIONS = NAV.filter(
  ({ route }) => route !== '/home' && route !== '/settings',
)

const mobileShortcutsKey = (userId: string) => `pref:mobile-shortcuts:${userId}`

type Carrier = 'BIRD' | 'POST'

export default function HomePage({ user, dark, toggleDark, onLogout, onUserUpdate }: Props) {
  const [currentRoute, setCurrentRoute] = useState(() => {
    const route = window.location.pathname
    return NAV.some((item) => item.route === route) ? route : '/home'
  })
  const [shortcutRoutes, setShortcutRoutes] = useState<[string, string]>([
    '/branches',
    '/bookmarks',
  ])
  const [bookmarkCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [text, setText] = useState('')
  const [carrier, setCarrier] = useState<Carrier>('BIRD')
  const [pigeonsFree, setPigeonsFree] = useState(5)
  const [stamps, setStamps] = useState(5)
  const [inFlight, setInFlight] = useState(0)
  const [sendError, setSendError] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Note | null>(null)
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [transmitFor, setTransmitFor] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [actionCarrier, setActionCarrier] = useState<Carrier>('BIRD')
  const [pendingReplies, setPendingReplies] = useState<Record<string, PendingReply[]>>({})
  const [pendingTransmissions, setPendingTransmissions] = useState<Record<string, Carrier>>({})
  const [transmissionCounts, setTransmissionCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    void kvGet<[string, string]>(mobileShortcutsKey(user.id)).then((saved) => {
      if (
        saved?.length === 2 &&
        saved.every((route) => SHORTCUT_OPTIONS.some((item) => item.route === route)) &&
        saved[0] !== saved[1]
      ) {
        setShortcutRoutes(saved)
      }
    })

    const handleHistoryNavigation = () => {
      const route = window.location.pathname
      setCurrentRoute(NAV.some((item) => item.route === route) ? route : '/home')
    }
    window.addEventListener('popstate', handleHistoryNavigation)
    return () => window.removeEventListener('popstate', handleHistoryNavigation)
  }, [user.id])

  useEffect(() => {
    void getCapacity(user.id).then(({ capacity }) => {
      setPigeonsFree(capacity.bird.available)
      setStamps(capacity.post.available)
      setInFlight(capacity.bird.busy + capacity.post.busy)
    }).catch(() => {})
  }, [user.id])

  useEffect(() => {
    if (!menuOpen) return

    const previousBodyOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousRootOverflow
    }
  }, [menuOpen])

  function navigate(route: string) {
    if (!NAV.some((item) => item.route === route)) return
    if (window.location.pathname !== route) window.history.pushState({}, '', route)
    setCurrentRoute(route)
    setSelectedPost(null)
    setComposeOpen(false)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function setMobileShortcut(index: 0 | 1, route: string) {
    if (!SHORTCUT_OPTIONS.some((item) => item.route === route)) return
    const next: [string, string] = [...shortcutRoutes]
    const otherIndex = index === 0 ? 1 : 0
    if (next[otherIndex] === route) next[otherIndex] = next[index]
    next[index] = route
    setShortcutRoutes(next)
    void kvSet(mobileShortcutsKey(user.id), next)
  }

  const mobileShortcuts = shortcutRoutes.map(
    (route) => SHORTCUT_OPTIONS.find((item) => item.route === route)!,
  ) as [NavDestination, NavDestination]
  const mobileMenuOverlay = menuOpen && (
    <button
      type="button"
      aria-label="Fermer le menu"
      onClick={() => setMenuOpen(false)}
      className="fixed inset-0 z-45 bg-[#102c43]/55 lg:hidden dark:bg-black/70"
    />
  )

  const canSend =
    text.trim().length > 0 && (carrier === 'BIRD' ? pigeonsFree > 0 : stamps > 0)

  async function send() {
    if (!canSend) return
    setSendError('')
    try {
      const { capacity } = await sendHome(user.id, text.trim(), carrier)
      setPigeonsFree(capacity.bird.available)
      setStamps(capacity.post.available)
      setInFlight(capacity.bird.busy + capacity.post.busy)
      setText('')
      setComposeOpen(false)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Envoi impossible.')
    }
  }

  async function logout() {
    await clearUser()
    onLogout()
  }

  function carrierAvailable(selectedCarrier: Carrier) {
    return selectedCarrier === 'BIRD' ? pigeonsFree > 0 : stamps > 0
  }

  function consumeCarrier(selectedCarrier: Carrier) {
    if (selectedCarrier === 'BIRD') {
      setPigeonsFree((count) => count - 1)
      setInFlight((count) => count + 1)
    } else {
      setStamps((count) => count - 1)
    }
  }

  function replyTotal(note: Note) {
    return note.replies.length + (pendingReplies[note.id]?.length ?? 0)
  }

  function closeActionComposer() {
    setReplyFor(null)
    setTransmitFor(null)
    setReplyText('')
  }

  function openReply(note: Note) {
    setReplyFor(note.id)
    setTransmitFor(null)
    setReplyText('')
  }

  function submitReply(note: Note) {
    if (!replyText.trim() || !carrierAvailable(actionCarrier)) return
    consumeCarrier(actionCarrier)
    setPendingReplies((replies) => ({
      ...replies,
      [note.id]: [
        ...(replies[note.id] ?? []),
        {
          id: `pending-${Date.now()}`,
          author: user.username,
          handle: user.username,
          text: replyText.trim(),
          age: '',
          method: actionCarrier,
        },
      ],
    }))
    setReplyText('')
    closeActionComposer()
  }

  function openTransmit(note: Note) {
    if (pendingTransmissions[note.id]) return
    setTransmitFor(note.id)
    setReplyFor(null)
  }

  function submitTransmit(note: Note) {
    if (!carrierAvailable(actionCarrier) || pendingTransmissions[note.id]) return
    consumeCarrier(actionCarrier)
    setPendingTransmissions((transmissions) => ({
      ...transmissions,
      [note.id]: actionCarrier,
    }))
    setTransmissionCounts((counts) => ({
      ...counts,
      [note.id]: (counts[note.id] ?? 0) + 1,
    }))
    closeActionComposer()
  }

  const panel =
    'rounded-2xl bg-white shadow-[0_4px_14px_rgba(42,157,244,.08)] dark:bg-night-1 dark:shadow-none dark:border dark:border-night-line'
  const mutedText = 'text-[#5b7a94] dark:text-zinc-500'
  const actionCarrierToggle = (
    <div className="flex w-fit items-center gap-0.5 rounded-lg bg-slate-100 p-1 dark:bg-night-2">
      <button
        type="button"
        onClick={() => setActionCarrier('BIRD')}
        title={`Pigeon (${pigeonsFree} disponibles)`}
        aria-label={`Pigeon, ${pigeonsFree} disponibles`}
        className={'flex h-8 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-[12px] font-bold ' + (actionCarrier === 'BIRD' ? 'bg-white text-[#1272b8] shadow-sm dark:bg-night-1 dark:text-accent-soft' : mutedText)}
      >
        <IconBird /> {pigeonsFree}
      </button>
      <button
        type="button"
        onClick={() => setActionCarrier('POST')}
        title={`Lettre (${stamps} disponibles)`}
        aria-label={`Lettre, ${stamps} disponibles`}
        className={'flex h-8 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-[12px] font-bold ' + (actionCarrier === 'POST' ? 'bg-white text-[#1272b8] shadow-sm dark:bg-night-1 dark:text-accent-soft' : mutedText)}
      >
        <IconMail /> {stamps}
      </button>
    </div>
  )

  if (selectedPost) {
    const replyCount = replyTotal(selectedPost)
    const visibleReplies = [...selectedPost.replies, ...(pendingReplies[selectedPost.id] ?? [])]

    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-strong via-sky-soft to-[#f6fbff] text-[#1c3d5a] dark:from-night-0 dark:via-night-0 dark:to-night-0 dark:text-zinc-100">
        {mobileMenuOverlay}
        <header className="sticky top-0 z-30 border-b border-white/50 bg-white/85 backdrop-blur dark:border-night-line dark:bg-night-0/90">
          <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3">
            <button
              onClick={() => {
                setSelectedPost(null)
                closeActionComposer()
              }}
              className={'rounded-full px-3 py-2 text-sm font-bold hover:bg-sky-50 dark:hover:bg-night-2 ' + mutedText}
            >
              ← Home
            </button>
            <b className="text-[17px]">Note</b>
            <div className={'ml-auto flex items-center gap-3 text-[13px] font-bold ' + mutedText}>
              <span className="flex items-center gap-1" title="Pigeons disponibles">
                <IconBird className="text-base" /> {pigeonsFree}
              </span>
              <span className="flex items-center gap-1" title="Lettres disponibles">
                <IconMail className="text-base" /> {stamps}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[720px] px-4 py-5 pb-32 lg:pb-12">
          <article className={panel + ' p-4.5'}>
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                style={{ background: selectedPost.color }}
              >
                {selectedPost.author.charAt(0)}
              </div>
              <div>
                <b className="block text-[15px]">{selectedPost.author}</b>
                <small className={mutedText}>@{selectedPost.handle}</small>
              </div>
              <div className={'ml-auto flex items-center gap-1.5 text-[12px] whitespace-nowrap ' + mutedText}>
                {selectedPost.method === 'BIRD' ? <IconBird /> : <IconMail />}
                <span>{formatArrivalAge(selectedPost.arrivedAt)} · {selectedPost.distance}</span>
              </div>
            </div>
            <p className="my-4 text-[16px] leading-relaxed">{selectedPost.text}</p>
            <div className="mt-4 flex items-center gap-5 border-t border-sky-100 pt-2.5 dark:border-night-line">
              <button onClick={() => openReply(selectedPost)} className={'flex min-h-[36px] items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold transition hover:bg-sky-50 hover:text-[#1272b8] dark:hover:bg-night-2 ' + mutedText}>
                <IconReply /> {replyCount} réponses
              </button>
              <button onClick={() => openTransmit(selectedPost)} className={'flex min-h-[36px] items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold transition hover:bg-sky-50 hover:text-[#1272b8] dark:hover:bg-night-2 ' + mutedText}>
                <IconRepeat /> {selectedPost.transmissions + (transmissionCounts[selectedPost.id] ?? 0)} transmissions
              </button>
              {pendingTransmissions[selectedPost.id] && (
                <span title="Transmission en cours vers le hub" className={'ml-auto ' + mutedText}><IconSend className="text-[13px]" /></span>
              )}
            </div>
          </article>

          <section className="mt-6">
            <div className="flex items-center gap-3">
              <b className="text-[15px]">Conversation · {replyCount} réponses</b>
            </div>

            {replyFor === selectedPost.id && (
              <form
                className={panel + ' mt-4 border border-sky-100 p-4 dark:border-night-line'}
                onSubmit={(event) => {
                  event.preventDefault()
                  submitReply(selectedPost)
                }}
              >
                <textarea
                  autoFocus
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={`Répondre à ${selectedPost.author}…`}
                  maxLength={280}
                  className="min-h-[72px] w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-[#5b7a94]/70 dark:placeholder:text-zinc-600"
                />
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-sky-100 pt-3 dark:border-night-line">
                  {actionCarrierToggle}
                  <div className="flex gap-2">
                    <button type="button" onClick={closeActionComposer} className={'px-2 py-2 text-[13px] font-bold ' + mutedText}>Annuler</button>
                    <button type="submit" disabled={!replyText.trim() || !carrierAvailable(actionCarrier)} className="rounded-lg bg-accent px-3 py-2 text-[13px] font-extrabold text-white disabled:opacity-40">Répondre</button>
                  </div>
                </div>
              </form>
            )}

            {transmitFor === selectedPost.id && (
              <div className={panel + ' mt-4 border border-sky-100 p-4 dark:border-night-line'}>
                <div>
                  <b className="block text-sm">Transmettre à vos abonnés</b>
                  <small className={mutedText}>Votre envoi suivra son propre trajet.</small>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-sky-100 pt-3 dark:border-night-line">
                  {actionCarrierToggle}
                  <div className="flex gap-2">
                    <button onClick={closeActionComposer} className={'px-2 py-2 text-[13px] font-bold ' + mutedText}>Annuler</button>
                    <button onClick={() => submitTransmit(selectedPost)} disabled={!carrierAvailable(actionCarrier) || !!pendingTransmissions[selectedPost.id]} className="rounded-lg bg-accent px-3 py-2 text-[13px] font-extrabold text-white disabled:opacity-40">Transmettre</button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {visibleReplies.map((reply) => (
                <article key={reply.id} className={'border-l-2 pl-3 ' + ('method' in reply ? 'border-dashed border-accent opacity-70' : 'border-sky-200 dark:border-night-line')}>
                  <div className="flex flex-wrap items-baseline gap-1.5 text-sm">
                    <b>{reply.author}</b>
                    {'method' in reply ? (
                      <span className={'flex items-center gap-1 ' + mutedText} title="Livraison en cours">@{reply.handle} {reply.method === 'BIRD' ? <IconBird /> : <IconMail />}</span>
                    ) : (
                      <span className={mutedText}>@{reply.handle} · {reply.age}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[14px] leading-relaxed">{reply.text}</p>
                </article>
              ))}
            </div>
          </section>

        </main>
        <MobileNavigation
          currentRoute={currentRoute}
          bookmarkCount={bookmarkCount}
          shortcuts={mobileShortcuts}
          menuItems={NAV}
          onNavigate={navigate}
          onOpenMenu={() => setMenuOpen((open) => !open)}
          menuOpen={menuOpen}
        />
      </div>
    )
  }

  // ------- morceaux partagés du composer (desktop inline / mobile plein écran)
  const carrierToggle = (
    <div className="flex items-center gap-1 rounded-full bg-slate-400/10 p-1 dark:bg-night-2">
      <button
        onClick={() => setCarrier('BIRD')}
        title={`Pigeon — rapide sur courte distance (${pigeonsFree} disponibles)`}
        className={
          'flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition ' +
          (carrier === 'BIRD' ? 'bg-accent text-white' : mutedText)
        }
      >
        <IconBird className="text-sm" /> {pigeonsFree}
      </button>
      <button
        onClick={() => setCarrier('POST')}
        title={`Lettre — efficace sur longue distance (${stamps} timbres)`}
        className={
          'flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition ' +
          (carrier === 'POST' ? 'bg-accent text-white' : mutedText)
        }
      >
        <IconMail className="text-sm" /> {stamps}
      </button>
    </div>
  )

  const capacityWarning = !canSend && text.trim().length > 0 && (
    <p className="mt-2 text-[12.5px] font-semibold text-amber-600 dark:text-amber-400">
      {carrier === 'BIRD'
        ? 'Aucun pigeon disponible — attendez un retour ou envoyez une lettre.'
        : 'Aucun timbre disponible — attendez le réassort ou envoyez un pigeon.'}
    </p>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-strong via-sky-soft to-[#f6fbff] text-[#1c3d5a] transition-colors dark:from-night-0 dark:via-night-0 dark:to-night-0 dark:text-zinc-100">
      {mobileMenuOverlay}
      {/* ================= HEADER MOBILE ================= */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/50 bg-white/80 px-4 py-3 backdrop-blur lg:hidden dark:border-night-line dark:bg-night-0/85">
        <IconBird className="text-xl text-accent" />
        <b className="text-[17px] font-extrabold">Blue Atmosphere</b>
        <div className={'ml-auto flex items-center gap-3 text-[13px] font-bold ' + mutedText}>
          <span className="flex items-center gap-1">
            <IconBird className="text-base" /> {pigeonsFree}
          </span>
          <span className="flex items-center gap-1">
            <IconMail className="text-base" /> {stamps}
          </span>
        </div>
      </header>

      <div
        className="mobile-nav-safe-padding mx-auto grid max-w-[1240px] grid-cols-1 gap-6 p-4 lg:grid-cols-[250px_1fr_310px] lg:gap-10 lg:px-8"
      >
        {/* ================= NAV GAUCHE (fixe) ================= */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 flex h-screen flex-col pt-8 pb-10">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[21px] font-extrabold">
              <IconBird className="text-accent" /> Blue Atmosphere
            </div>

            <nav className="mt-3">
              {NAV.map((n) => (
                <a
                  key={n.route}
                  href={n.route}
                  aria-current={currentRoute === n.route ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    navigate(n.route)
                  }}
                  className={
                    'my-1 flex items-center gap-3.5 rounded-full px-4 py-3 text-[15.5px] font-semibold transition ' +
                    (currentRoute === n.route
                      ? 'bg-white shadow-[0_4px_14px_rgba(42,157,244,.18)] dark:bg-night-2 dark:shadow-none'
                      : 'hover:bg-white/70 dark:hover:bg-night-2/60')
                  }
                >
                  <n.icon className={'text-xl ' + (currentRoute === n.route ? 'text-accent' : '')} />
                  {n.label}
                  {(n.desktopBadge || (n.kind === 'bookmarks' && bookmarkCount > 0)) && (
                    <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                      {n.kind === 'bookmarks' ? bookmarkCount : n.desktopBadge}
                    </span>
                  )}
                </a>
              ))}
            </nav>

            {/* pilule user — collée en bas de la colonne */}
            <div className={'mt-auto flex items-center gap-2.5 rounded-full px-3.5 py-2.5 ' + panel}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Photo de profil" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-extrabold text-white">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <b className="block truncate text-sm">{user.username}</b>
                <small className={'block truncate text-xs ' + mutedText}>
                  @{user.username}
                </small>
              </div>
              <div className="ml-auto flex shrink-0 gap-0.5">
                <button
                  onClick={toggleDark}
                  title="Thème"
                  className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-night-2"
                >
                  {dark ? <IconSun /> : <IconMoon />}
                </button>
                <button
                  onClick={logout}
                  title="Se déconnecter"
                  className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-night-2"
                >
                  <IconLogout />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ================= FEED ================= */}
        <main className="lg:py-8">
          {currentRoute !== '/home' && currentRoute !== '/settings' ? (
            <SecondaryPages route={currentRoute} user={user} onUserUpdate={onUserUpdate} />
          ) : (
            <>
          {/* compose inline — desktop uniquement.
              La Home publie vers les abonnés : pas de choix de destination ici. */}
          <div className={panel + ' hidden p-4.5 lg:block'}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={280}
              placeholder="Partager quelque chose avec vos abonnés…"
              className="min-h-[64px] w-full resize-none bg-transparent text-[16.5px] outline-none placeholder:text-[#5b7a94]/70 dark:placeholder:text-zinc-600"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {carrierToggle}
              <span className={'ml-auto text-[13px] ' + mutedText}>{text.length}/280</span>
              <button
                onClick={send}
                disabled={!canSend}
                className="rounded-full bg-accent px-5 py-2.5 text-[14.5px] font-extrabold text-white transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg enabled:hover:shadow-accent/40 disabled:opacity-40"
              >
                Envoyer
              </button>
            </div>
            {capacityWarning}
            {sendError && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-red-600 dark:text-red-400">{sendError}</p>}
          </div>

          {/* posts */}
          {DEMO_FEED.map((p) =>
            'echo' in p ? (
              <article
                key={p.id}
                className="mt-4 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 p-4.5 first:mt-0 lg:first:mt-4 dark:border-emerald-900 dark:bg-emerald-950/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <IconBranch className="text-lg" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400">
                      ÉCHO D'UNE BRANCHE · {p.distance?.toUpperCase()}
                    </span>
                    <b className="block text-[16px]">{p.branch}</b>
                  </div>
                </div>
                <p className="my-3 text-[15px] leading-relaxed">{p.text}</p>
                <div className="flex items-center gap-3">
                  <small className={'min-w-0 flex-1 truncate ' + mutedText}>
                    <b>{p.activity}</b>
                  </small>
                  <button
                    type="button"
                    onClick={() => navigate('/branches')}
                    className="shrink-0 whitespace-nowrap rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-extrabold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-night-1 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  >
                    Voir la branche
                  </button>
                </div>
              </article>
            ) : (
              <article
                key={p.id}
                onClick={() => setSelectedPost(p)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') setSelectedPost(p)
                }}
                tabIndex={0}
                className={
                  panel +
                  ' mt-4 cursor-pointer p-4.5 first:mt-0 transition hover:shadow-[0_8px_24px_rgba(42,157,244,.14)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:first:mt-4 dark:hover:bg-night-2'
                }
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                    style={{ background: p.color }}
                  >
                    {p.author.charAt(0)}
                  </div>
                  <div>
                    <b className="text-[15px]">{p.author}</b>
                    <small className={'block text-[13px] ' + mutedText}>
                      @{p.handle}
                    </small>
                  </div>
                  {/* méta compacte : une seule ligne */}
                  <div
                    className={
                      'ml-auto flex items-center gap-1.5 text-[12px] whitespace-nowrap ' +
                      mutedText
                    }
                  >
                    {p.method === 'BIRD' ? <IconBird /> : <IconMail />}
                    <span>
                    {formatArrivalAge(p.arrivedAt)} · {p.distance}
                    </span>
                  </div>
                </div>
                <p className="my-3 text-[15px] leading-relaxed">{p.text}</p>
                <div className="mt-4 flex items-center gap-5 border-t border-sky-100 pt-2.5 dark:border-night-line">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      openReply(p)
                    }}
                    title="Répondre à cette note"
                    aria-label={`Répondre — ${replyTotal(p)} réponses`}
                    className={
                      'flex min-h-[36px] items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold transition hover:bg-sky-50 hover:text-[#1272b8] dark:hover:bg-night-2 ' +
                      mutedText
                    }
                  >
                    <IconReply /> {replyTotal(p)} réponses
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      openTransmit(p)
                    }}
                    title="Transmettre cette note à vos abonnés"
                    aria-label={`Transmettre — ${p.transmissions + (transmissionCounts[p.id] ?? 0)} transmissions`}
                    className={'flex min-h-[36px] items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold transition hover:bg-sky-50 hover:text-[#1272b8] dark:hover:bg-night-2 ' + mutedText}
                  >
                    <IconRepeat /> {p.transmissions + (transmissionCounts[p.id] ?? 0)} transmissions
                  </button>
                  {pendingTransmissions[p.id] && (
                    <span title="Transmission en cours vers le hub" className={'ml-auto ' + mutedText}><IconSend className="text-[13px]" /></span>
                  )}
                </div>
                {replyFor === p.id && (
                  <form
                    className="mt-3 rounded-xl border border-sky-100 bg-sky-50 p-3 dark:border-night-line dark:bg-night-2"
                    onClick={(event) => event.stopPropagation()}
                    onSubmit={(event) => {
                      event.preventDefault()
                      submitReply(p)
                    }}
                  >
                    <textarea
                      autoFocus
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder={`Répondre à ${p.author}…`}
                      maxLength={280}
                      className="min-h-[64px] w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-[#5b7a94]/70 dark:placeholder:text-zinc-600"
                    />
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-sky-100 pt-3 dark:border-night-line">
                      {actionCarrierToggle}
                      <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeActionComposer}
                        className={'px-2 py-2 text-[13px] font-bold ' + mutedText}
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={!replyText.trim() || !carrierAvailable(actionCarrier)}
                        className="rounded-lg bg-accent px-3 py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
                      >
                        Répondre
                      </button>
                      </div>
                    </div>
                  </form>
                )}
                {transmitFor === p.id && (
                  <div
                    className="mt-3 rounded-xl border border-sky-100 bg-sky-50 p-3 dark:border-night-line dark:bg-night-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div>
                      <b className="block text-[13px]">Transmettre à vos abonnés</b>
                      <small className={mutedText}>Chaque abonné recevra la note après son trajet.</small>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-sky-100 pt-3 dark:border-night-line">
                      {actionCarrierToggle}
                      <div className="flex gap-2">
                        <button onClick={closeActionComposer} className={'px-2 py-2 text-[13px] font-bold ' + mutedText}>Annuler</button>
                        <button onClick={() => submitTransmit(p)} disabled={!carrierAvailable(actionCarrier) || !!pendingTransmissions[p.id]} className="rounded-lg bg-accent px-3 py-2 text-[13px] font-extrabold text-white disabled:opacity-40">Transmettre</button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ),
          )}

          <p className={'py-8 text-center text-[13px] ' + mutedText}>
            Feed de démonstration · sera branché sur l'API
          </p>
            </>
          )}
        </main>

        {/* ================= COLONNE DROITE (fixe) ================= */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 py-8">
            {/* compteurs d'état simples */}
            <div className={panel + ' p-4.5'}>
              <h3 className="mb-3 text-[14px] font-bold">Capacité d'envoi</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2">
                  <IconBird className="mx-auto text-xl text-accent" />
                  <b className="mt-1 block text-lg">{pigeonsFree}</b>
                  <small className={'text-[11px] ' + mutedText}>pigeons</small>
                </div>
                <div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2">
                  <IconMail className="mx-auto text-xl text-accent" />
                  <b className="mt-1 block text-lg">{stamps}</b>
                  <small className={'text-[11px] ' + mutedText}>timbres</small>
                </div>
                <div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2">
                  <IconSend className="mx-auto text-xl text-amber-500" />
                  <b className="mt-1 block text-lg">{inFlight}</b>
                  <small className={'text-[11px] ' + mutedText}>en route</small>
                </div>
              </div>
            </div>

            {/* branches proches */}
            <div className={panel + ' mt-4 p-4.5'}>
              <h3 className="text-[14px] font-bold">Près de vous</h3>
              {DEMO_BRANCHES.map((b) => (
                <div
                  key={b.name}
                  className="flex cursor-pointer items-center gap-2.5 border-t border-sky-50 py-2.5 first:mt-1 first:border-t-0 dark:border-night-line"
                >
                  <IconMapPin className={'shrink-0 text-lg ' + mutedText} />
                  <div>
                    <b className="block text-sm hover:text-[#1272b8] dark:hover:text-accent-soft">
                      {b.name}
                    </b>
                    <small className={'text-xs ' + mutedText}>{b.info}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {currentRoute === '/settings' && (
        <section
          aria-labelledby="settings-title"
          className={
            'fixed inset-0 z-40 bg-[#f6fbff] px-4 pt-5 dark:bg-night-0 lg:pt-10 ' +
            (menuOpen ? 'touch-none overflow-hidden' : 'overflow-y-auto')
          }
          style={{ paddingBottom: 'calc(66px + max(12px, env(safe-area-inset-bottom)) + 28px)' }}
        >
          <div className="mx-auto max-w-[680px]">
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className={'min-h-11 rounded-full px-3 text-sm font-bold hover:bg-white dark:hover:bg-night-2 ' + mutedText}
              >
                ← Retour
              </button>
              <h1 id="settings-title" className="text-xl font-extrabold">
                Paramètres
              </h1>
            </div>

            <div className={panel + ' divide-y divide-sky-100 overflow-hidden dark:divide-night-line'}>
              <div className="flex items-center justify-between gap-4 p-4.5">
                <div>
                  <b className="block text-[15px]">Apparence</b>
                  <small className={mutedText}>{dark ? 'Mode sombre' : 'Mode clair'}</small>
                </div>
                <button
                  type="button"
                  onClick={toggleDark}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-sky-50 px-4 text-sm font-bold text-[#1272b8] dark:bg-night-2 dark:text-accent-soft"
                >
                  {dark ? <IconSun /> : <IconMoon />}
                  Changer
                </button>
              </div>

              <fieldset className="p-4.5">
                <legend className="text-[15px] font-bold">Navigation mobile</legend>
                <p className={'mt-1 text-[13px] ' + mutedText}>
                  Choisissez les deux raccourcis affichés au centre de la barre.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([0, 1] as const).map((index) => (
                    <label key={index} className="text-[13px] font-bold">
                      Raccourci {index + 1}
                      <select
                        value={shortcutRoutes[index]}
                        onChange={(event) => setMobileShortcut(index, event.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-sky-100 bg-sky-50 px-3 text-[#1c3d5a] outline-none focus:border-accent dark:border-night-line dark:bg-night-2 dark:text-zinc-100"
                      >
                        {SHORTCUT_OPTIONS.map((option) => (
                          <option key={option.route} value={option.route}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="p-4.5">
                <b className="block text-[15px]">Compte</b>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-3 flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <IconLogout /> Se déconnecter
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= FAB ÉCRIRE — mobile ================= */}
      {!composeOpen && !menuOpen && currentRoute === '/home' && (
        <button
          onClick={() => setComposeOpen(true)}
          title="Écrire"
          className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl text-white shadow-xl shadow-accent/40 transition active:scale-90 lg:hidden"
          style={{ bottom: 'calc(66px + max(12px, env(safe-area-inset-bottom)) + 14px)' }}
        >
          <IconSend />
        </button>
      )}

      {/* ================= COMPOSE PLEIN ÉCRAN — mobile ================= */}
      {composeOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white lg:hidden dark:bg-night-0">
          <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-night-line">
            <button
              onClick={() => setComposeOpen(false)}
              className={'min-h-[40px] px-2 py-1 text-[15px] font-bold ' + mutedText}
            >
              Annuler
            </button>
            <span className="mx-auto text-[15px] font-extrabold">Nouveau message</span>
            <button
              onClick={send}
              disabled={!canSend}
              className="rounded-full bg-accent px-4.5 py-2 text-[14px] font-extrabold text-white disabled:opacity-40"
            >
              Envoyer
            </button>
          </header>

          <p className={'px-4 pt-3 text-[12.5px] font-semibold ' + mutedText}>
            Partagé avec vos abonnés
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            autoFocus
            placeholder="Partager quelque chose avec vos abonnés…"
            className="flex-1 resize-none bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-[#5b7a94]/70 dark:placeholder:text-zinc-600"
          />

          <footer className="border-t border-slate-100 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] dark:border-night-line">
            <div className="flex items-center gap-2">
              {carrierToggle}
              <span className={'ml-auto text-[13px] ' + mutedText}>{text.length}/280</span>
            </div>
            {capacityWarning}
          </footer>
        </div>
      )}

      <MobileNavigation
        currentRoute={currentRoute}
        bookmarkCount={bookmarkCount}
        shortcuts={mobileShortcuts}
        menuItems={NAV}
        onNavigate={navigate}
        onOpenMenu={() => setMenuOpen((open) => !open)}
        menuOpen={menuOpen}
      />
    </div>
  )
}
