import { useCallback, useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { clearUser, type User } from '../../api/auth'
import MobileNavigation, {
  type MobileNavDestination,
  type MobileMenuStyle,
} from '../../components/MobileNavigation'
import MobileTopBar from '../../components/MobileTopBar'
import FloatingActionButton from '../../components/FloatingActionButton'
import NoteCard from './NoteCard'
import SecondaryPages, { type LocalBookmark } from './SecondaryPages'
import { formatArrivalAge } from './note-utils'
import { getCapacity, sendBranch, sendHome, sendReply, sendTransmission } from '../../api/deliveries'
import { getBranchFeed, getHomeFeed, type FeedMessage } from '../../api/messages'
import type { BranchSummary } from '../../api/branches'
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

interface Reply {
  id: string
  author: string
  handle: string
  text: string
  age: string
  method: 'BIRD' | 'POST'
  pending: boolean
}

interface Note extends Omit<LocalBookmark, 'replies'> {
  arrivedAt: number
  transmissions: number
  replies: Reply[]
}

interface BranchEcho {
  id: string
  echo: true
  branch: string
  distance: string
  activity: string
  text: string
}

const NEARBY_BRANCHES: { name: string; info: string }[] = []

function avatarColor(value: string): string {
  let hash = 0
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return `hsl(${Math.abs(hash) % 360} 62% 48%)`
}

function formatDistance(distanceKm: number | null): string {
  if (distanceKm === null) return 'distance inconnue'
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: distanceKm < 10 ? 1 : 0 }).format(distanceKm)} km`
}

function toNote(message: FeedMessage): Note {
  return {
    id: message.id,
    author: message.author,
    handle: message.handle,
    color: avatarColor(message.authorId),
    avatarUrl: message.avatarUrl,
    method: message.method,
    distance: formatDistance(message.distanceKm),
    arrivedAt: message.arrivedAt,
    pending: message.pending,
    text: message.text,
    transmissions: message.transmissions,
    replies: message.replies.map((reply) => ({
      id: reply.id,
      author: reply.author,
      handle: reply.handle,
      text: reply.text,
      age: formatArrivalAge(reply.arrivedAt),
      method: reply.method,
      pending: reply.pending,
    })),
  }
}

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>

interface NavDestination extends MobileNavDestination {
  icon: IconCmp
}

// Explorer et Mes branches sont réunis dans une seule destination Branches.
const NAV: NavDestination[] = [
  { route: '/home', icon: IconHome, label: 'Home' },
  { route: '/branches', icon: IconBranch, label: 'Branches' },
  { route: '/messages', icon: IconMail, label: 'Cui-to-cui' },
  { route: '/arrivals', icon: IconBell, label: 'Notifications' },
  { route: '/bookmarks', icon: IconBookmark, label: 'Signets', kind: 'bookmarks' },
  { route: '/profile', icon: IconUser, label: 'Profil' },
  { route: '/settings', icon: IconSettings, label: 'Paramètres' },
]

const SHORTCUT_OPTIONS = NAV.filter(
  ({ route }) => route !== '/home' && route !== '/settings',
)

const mobileShortcutsKey = (userId: string) => `pref:mobile-shortcuts:${userId}`
const mobileMenuStyleKey = (userId: string) => `pref:mobile-menu-style:${userId}`
const bookmarksKey = (userId: string) => `local:bookmarked-notes:${userId}`

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
  const [bookmarkedNotes, setBookmarkedNotes] = useState<Note[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<MobileMenuStyle>('bubbles')
  const [text, setText] = useState('')
  const [carrier, setCarrier] = useState<Carrier>('BIRD')
  const [pigeonsFree, setPigeonsFree] = useState(0)
  const [stamps, setStamps] = useState(0)
  const [inFlight, setInFlight] = useState(0)
  const [sendError, setSendError] = useState('')
  const [feed, setFeed] = useState<(Note | BranchEcho)[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState('')
  const [selectedBranch, setSelectedBranch] = useState<BranchSummary | null>(null)
  const [branchFeed, setBranchFeed] = useState<Note[]>([])
  const [branchFeedLoading, setBranchFeedLoading] = useState(false)
  const [branchFeedError, setBranchFeedError] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Note | null>(null)
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [transmitFor, setTransmitFor] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState('')
  const [actionCarrier, setActionCarrier] = useState<Carrier>('BIRD')
  const [pendingReplies, setPendingReplies] = useState<Record<string, Reply[]>>({})
  const [pendingTransmissions, setPendingTransmissions] = useState<Record<string, Carrier>>({})
  const [transmissionCounts, setTransmissionCounts] = useState<Record<string, number>>({})

  const loadFeed = useCallback(async () => {
    setFeedError('')
    try {
      const messages = await getHomeFeed(user.id)
      const nextFeed = messages.map(toNote)
      setFeed(nextFeed)
      setSelectedPost((selected) => {
        if (!selected) return null
        const refreshed = nextFeed.find((message) => !('echo' in message) && message.id === selected.id)
        return refreshed && !('echo' in refreshed) ? refreshed : selected
      })
    } catch (cause) {
      setFeedError(cause instanceof Error ? cause.message : 'Impossible de charger les messages.')
    } finally {
      setFeedLoading(false)
    }
  }, [user.id])

  const loadBranchFeed = useCallback(async () => {
    if (!selectedBranch) return
    setBranchFeedError('')
    setBranchFeedLoading(true)
    try {
      const nextFeed = (await getBranchFeed(user.id, selectedBranch.id)).map(toNote)
      setBranchFeed(nextFeed)
      setSelectedPost((selected) => selected
        ? nextFeed.find((message) => message.id === selected.id) ?? selected
        : null)
    } catch (cause) {
      setBranchFeedError(cause instanceof Error ? cause.message : 'Impossible de charger la branche.')
    } finally {
      setBranchFeedLoading(false)
    }
  }, [selectedBranch, user.id])

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
    void kvGet<MobileMenuStyle>(mobileMenuStyleKey(user.id)).then((saved) => {
      if (saved === 'bubbles' || saved === 'sheet') setMenuStyle(saved)
    })
    void kvGet<Note[]>(bookmarksKey(user.id)).then((saved) => {
      setBookmarkedNotes(Array.isArray(saved) ? saved : [])
    })

    const handleHistoryNavigation = () => {
      const route = window.location.pathname
      setCurrentRoute(NAV.some((item) => item.route === route) ? route : '/home')
    }
    window.addEventListener('popstate', handleHistoryNavigation)
    return () => window.removeEventListener('popstate', handleHistoryNavigation)
  }, [user.id])

  useEffect(() => {
    void loadFeed()
    const refresh = window.setInterval(() => void loadFeed(), 30_000)
    return () => window.clearInterval(refresh)
  }, [loadFeed])

  useEffect(() => {
    if (!selectedBranch) return
    void loadBranchFeed()
    const refresh = window.setInterval(() => void loadBranchFeed(), 30_000)
    return () => window.clearInterval(refresh)
  }, [loadBranchFeed, selectedBranch])

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
    setSelectedBranch(null)
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

  function updateMobileMenuStyle(style: MobileMenuStyle) {
    setMenuStyle(style)
    setMenuOpen(false)
    void kvSet(mobileMenuStyleKey(user.id), style)
  }

  function toggleBookmark(note: Note) {
    setBookmarkedNotes((current) => {
      const next = current.some((bookmark) => bookmark.id === note.id)
        ? current.filter((bookmark) => bookmark.id !== note.id)
        : [note, ...current]
      void kvSet(bookmarksKey(user.id), next)
      return next
    })
  }

  function openBookmark(id: string) {
    const note = bookmarkedNotes.find((bookmark) => bookmark.id === id)
    if (note) setSelectedPost(note)
  }

  const mobileShortcuts = shortcutRoutes.map(
    (route) => SHORTCUT_OPTIONS.find((item) => item.route === route)!,
  ) as [NavDestination, NavDestination]
  const currentPageTitle = NAV.find((item) => item.route === currentRoute)?.label ?? 'Home'
  const bookmarkCount = bookmarkedNotes.length
  const mobileMenuOverlay = menuOpen && (
    <button
      type="button"
      aria-label="Fermer le menu"
      onClick={() => setMenuOpen(false)}
      className="fixed inset-0 z-45 bg-overlay/55 lg:hidden dark:bg-black/70"
    />
  )

  const canSend =
    text.trim().length > 0 && (carrier === 'BIRD' ? pigeonsFree > 0 : stamps > 0)

  const activeFeed = selectedBranch ? branchFeed : feed
  const activeFeedLoading = selectedBranch ? branchFeedLoading : feedLoading
  const activeFeedError = selectedBranch ? branchFeedError : feedError

  async function send() {
    if (!canSend) return
    setSendError('')
    try {
      const { capacity } = selectedBranch
        ? await sendBranch(user.id, selectedBranch.id, text.trim(), carrier)
        : await sendHome(user.id, text.trim(), carrier)
      setPigeonsFree(capacity.bird.available)
      setStamps(capacity.post.available)
      setInFlight(capacity.bird.busy + capacity.post.busy)
      setText('')
      setComposeOpen(false)
      await (selectedBranch ? loadBranchFeed() : loadFeed())
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

  function replyTotal(note: Note) {
    return new Set([
      ...note.replies.map((reply) => reply.id),
      ...(pendingReplies[note.id] ?? []).map((reply) => reply.id),
    ]).size
  }

  function closeActionComposer() {
    setReplyFor(null)
    setTransmitFor(null)
    setReplyText('')
    setReplyError('')
  }

  function openReply(note: Note) {
    setSelectedPost(note)
    setReplyFor(note.id)
    setTransmitFor(null)
    setReplyText('')
    setReplyError('')
  }

  async function submitReply(note: Note) {
    if (!replyText.trim() || !carrierAvailable(actionCarrier)) return
    setReplyError('')
    try {
      const content = replyText.trim()
      const result = await sendReply(user.id, note.id, content, actionCarrier)
      setPigeonsFree(result.capacity.bird.available)
      setStamps(result.capacity.post.available)
      setInFlight(result.capacity.bird.busy + result.capacity.post.busy)
      setPendingReplies((replies) => ({
        ...replies,
        [note.id]: [
          ...(replies[note.id] ?? []),
          {
            id: result.message.id,
            author: user.username,
            handle: user.username,
            text: content,
            age: '',
            method: actionCarrier,
            pending: true,
          },
        ],
      }))
      setReplyText('')
      closeActionComposer()
    } catch (cause) {
      setReplyError(cause instanceof Error ? cause.message : 'Réponse impossible.')
    }
  }

  function openTransmit(note: Note) {
    if (pendingTransmissions[note.id]) return
    setSelectedPost(note)
    setTransmitFor(note.id)
    setReplyFor(null)
  }

  async function submitTransmit(note: Note) {
    if (!carrierAvailable(actionCarrier) || pendingTransmissions[note.id]) return
    setReplyError('')
    try {
      const selectedCarrier = actionCarrier
      const result = await sendTransmission(user.id, note.id, selectedCarrier)
      setPigeonsFree(result.capacity.bird.available)
      setStamps(result.capacity.post.available)
      setInFlight(result.capacity.bird.busy + result.capacity.post.busy)
      setPendingTransmissions((transmissions) => ({ ...transmissions, [note.id]: selectedCarrier }))
      setTransmissionCounts((counts) => ({ ...counts, [note.id]: (counts[note.id] ?? 0) + 1 }))
      closeActionComposer()
      void loadFeed()
    } catch (cause) {
      setReplyError(cause instanceof Error ? cause.message : 'Transmission impossible.')
    }
  }

  const panel =
    'rounded-2xl bg-white shadow-card dark:bg-night-1 dark:shadow-none dark:border dark:border-night-line'
  const mutedText = 'text-ink-muted dark:text-zinc-500'
  const actionCarrierToggle = (
    <div className="flex w-fit items-center gap-0.5 rounded-lg bg-slate-100 p-1 dark:bg-night-2">
      <button
        type="button"
        onClick={() => setActionCarrier('BIRD')}
        title={`Pigeon (${pigeonsFree} disponibles)`}
        aria-label={`Pigeon, ${pigeonsFree} disponibles`}
        className={'flex h-8 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-caption font-bold ' + (actionCarrier === 'BIRD' ? 'bg-white text-accent-strong shadow-sm dark:bg-night-1 dark:text-accent-soft' : mutedText)}
      >
        <IconBird /> {pigeonsFree}
      </button>
      <button
        type="button"
        onClick={() => setActionCarrier('POST')}
        title={`Lettre (${stamps} disponibles)`}
        aria-label={`Lettre, ${stamps} disponibles`}
        className={'flex h-8 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-caption font-bold ' + (actionCarrier === 'POST' ? 'bg-white text-accent-strong shadow-sm dark:bg-night-1 dark:text-accent-soft' : mutedText)}
      >
        <IconMail /> {stamps}
      </button>
    </div>
  )

  if (selectedPost) {
    const replyCount = replyTotal(selectedPost)
    const visibleReplies = [...selectedPost.replies, ...(pendingReplies[selectedPost.id] ?? [])]
      .filter((reply, index, replies) => replies.findIndex((candidate) => candidate.id === reply.id) === index)

    return (
      <div className={'min-h-dvh bg-gradient-to-b from-sky-strong via-sky-soft to-page text-ink dark:from-night-0 dark:via-night-0 dark:to-night-0 dark:text-zinc-100' + (selectedBranch ? ' branch-theme' : '')}>
        {mobileMenuOverlay}
        <MobileTopBar
          backLabel={selectedBranch ? 'Branche' : currentPageTitle}
          onBack={() => {
            setSelectedPost(null)
            closeActionComposer()
          }}
          pigeonsFree={pigeonsFree}
          stamps={stamps}
        />

        <main className="mx-auto max-w-[720px] px-4 py-5 pb-32 lg:pb-12">
          <NoteCard
            note={selectedPost}
            age={formatArrivalAge(selectedPost.arrivedAt)}
            replyCount={replyCount}
            transmissionCount={selectedPost.transmissions + (transmissionCounts[selectedPost.id] ?? 0)}
            transmissionPending={!!pendingTransmissions[selectedPost.id]}
            bookmarked={bookmarkedNotes.some((bookmark) => bookmark.id === selectedPost.id)}
            onReply={() => openReply(selectedPost)}
            onTransmit={() => openTransmit(selectedPost)}
            onToggleBookmark={() => toggleBookmark(selectedPost)}
          />

          <section className="mt-6">
            <div className="flex items-center gap-3">
              <b className="text-control">Conversation · {replyCount} réponses</b>
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
                  className="min-h-composer-open w-full resize-none bg-transparent text-body outline-none placeholder:text-ink-muted/70 dark:placeholder:text-zinc-600"
                />
                {replyError && <p role="alert" className="mt-2 text-caption font-semibold text-red-600 dark:text-red-400">{replyError}</p>}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-sky-100 pt-3 dark:border-night-line">
                  {actionCarrierToggle}
                  <div className="flex gap-2">
                    <button type="button" onClick={closeActionComposer} className={'px-2 py-2 text-meta font-bold ' + mutedText}>Annuler</button>
                    <button type="submit" disabled={!replyText.trim() || !carrierAvailable(actionCarrier)} className="rounded-lg bg-accent px-3 py-2 text-meta font-extrabold text-white disabled:opacity-40">Répondre</button>
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
                {replyError && <p role="alert" className="mt-2 text-caption font-semibold text-red-600 dark:text-red-400">{replyError}</p>}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-sky-100 pt-3 dark:border-night-line">
                  {actionCarrierToggle}
                  <div className="flex gap-2">
                    <button onClick={closeActionComposer} className={'px-2 py-2 text-meta font-bold ' + mutedText}>Annuler</button>
                    <button onClick={() => submitTransmit(selectedPost)} disabled={!carrierAvailable(actionCarrier) || !!pendingTransmissions[selectedPost.id]} className="rounded-lg bg-accent px-3 py-2 text-meta font-extrabold text-white disabled:opacity-40">Transmettre</button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {visibleReplies.map((reply) => (
                <article key={reply.id} className={'border-l-2 pl-3 ' + (reply.pending ? 'border-dashed border-accent opacity-70' : 'border-sky-200 dark:border-night-line')}>
                  <div className="flex flex-wrap items-baseline gap-1.5 text-sm">
                    <b>{reply.author}</b>
                    {reply.pending ? (
                      <span className={'flex items-center gap-1 ' + mutedText} title="Livraison en cours">
                        @{reply.handle} · {reply.method === 'BIRD' ? <IconBird /> : <IconMail />} En cours d’envoi
                      </span>
                    ) : (
                      <span className={mutedText}>@{reply.handle} · {reply.age}</span>
                    )}
                  </div>
                  <p className="mt-1 text-label leading-relaxed">{reply.text}</p>
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
          menuStyle={menuStyle}
        />
      </div>
    )
  }

  // ------- morceaux partagés du composer (desktop inline / mobile plein écran)
  const carrierToggle = (
    <div className="flex items-center gap-1 rounded-full bg-slate-400/10 p-1 dark:bg-night-2">
      <button
        type="button"
        onClick={() => setCarrier('BIRD')}
        aria-pressed={carrier === 'BIRD'}
        title={`Pigeon — rapide sur courte distance (${pigeonsFree} disponibles)`}
        className={
          'flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-meta font-extrabold transition ' +
          (carrier === 'BIRD' ? 'bg-accent text-white' : mutedText)
        }
      >
        <IconBird className="text-sm" /> Oiseau · {pigeonsFree}
      </button>
      <button
        type="button"
        onClick={() => setCarrier('POST')}
        aria-pressed={carrier === 'POST'}
        title={`Lettre — efficace sur longue distance (${stamps} timbres)`}
        className={
          'flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-meta font-extrabold transition ' +
          (carrier === 'POST' ? 'bg-accent text-white' : mutedText)
        }
      >
        <IconMail className="text-sm" /> Lettre · {stamps}
      </button>
    </div>
  )

  const capacityWarning = !canSend && text.trim().length > 0 && (
    <p className="mt-2 text-meta font-semibold text-amber-600 dark:text-amber-400">
      {carrier === 'BIRD'
        ? 'Aucun pigeon disponible — attendez un retour ou envoyez une lettre.'
        : 'Aucun timbre disponible — attendez le réassort ou envoyez un pigeon.'}
    </p>
  )

  return (
    <div className={'min-h-dvh bg-gradient-to-b from-sky-strong via-sky-soft to-page text-ink transition-colors dark:from-night-0 dark:via-night-0 dark:to-night-0 dark:text-zinc-100' + (selectedBranch ? ' branch-theme' : '')}>
      {mobileMenuOverlay}
      {/* ================= HEADER MOBILE ================= */}
      {currentRoute !== '/settings' && (selectedBranch ? (
        <MobileTopBar
          title={selectedBranch.name}
          backLabel="Branches"
          onBack={() => {
            setSelectedBranch(null)
            setSelectedPost(null)
            setComposeOpen(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          pigeonsFree={pigeonsFree}
          stamps={stamps}
          mobileOnly
        />
      ) : (
        <MobileTopBar
          title={currentPageTitle}
          pigeonsFree={pigeonsFree}
          stamps={stamps}
          mobileOnly
        />
      ))}

      <div
        className="mobile-nav-safe-padding mx-auto grid max-w-[1240px] grid-cols-1 gap-6 p-4 lg:grid-cols-[250px_1fr_310px] lg:gap-10 lg:px-8"
      >
        {/* ================= NAV GAUCHE (fixe) ================= */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 flex h-screen flex-col pt-8 pb-10">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-brand font-extrabold">
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
                    'my-1 flex items-center gap-3.5 rounded-full px-4 py-3 text-body font-semibold transition ' +
                    (currentRoute === n.route
                      ? 'bg-white shadow-card-active dark:bg-night-2 dark:shadow-none'
                      : 'hover:bg-white/70 dark:hover:bg-night-2/60')
                  }
                >
                  <n.icon className={'text-xl ' + (currentRoute === n.route ? 'text-accent' : '')} />
                  {n.label}
                  {n.kind === 'bookmarks' && bookmarkCount > 0 && (
                    <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                      {bookmarkCount}
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-control font-extrabold text-white">
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
          {currentRoute !== '/home' && currentRoute !== '/settings' && !selectedBranch ? (
            <SecondaryPages
              route={currentRoute}
              user={user}
              onUserUpdate={onUserUpdate}
              bookmarks={bookmarkedNotes}
              onOpenBookmark={openBookmark}
              onReplyBookmark={(id) => {
                const note = bookmarkedNotes.find((bookmark) => bookmark.id === id)
                if (note) openReply(note)
              }}
              onTransmitBookmark={(id) => {
                const note = bookmarkedNotes.find((bookmark) => bookmark.id === id)
                if (note) openTransmit(note)
              }}
              onToggleBookmark={(id) => {
                const note = bookmarkedNotes.find((bookmark) => bookmark.id === id)
                if (note) toggleBookmark(note)
              }}
              onOpenBranch={(branch) => {
                setSelectedBranch(branch)
                setSelectedPost(null)
                setComposeOpen(false)
                setBranchFeed([])
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          ) : (
            <>
          {selectedBranch && (
            <header className="mb-4 hidden items-center gap-3 lg:flex">
              <button
                type="button"
                onClick={() => setSelectedBranch(null)}
                className={'min-h-11 rounded-full px-3 text-meta font-bold hover:bg-white dark:hover:bg-night-2 ' + mutedText}
              >
                ← Branches
              </button>
              <IconBranch className="text-xl text-accent" />
              <h1 className="truncate text-title font-extrabold">{selectedBranch.name}</h1>
            </header>
          )}
          {/* compose inline — desktop uniquement.
              La Home publie vers les abonnés : pas de choix de destination ici. */}
          <div className={panel + ' hidden p-4.5 lg:block'}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={280}
              placeholder={selectedBranch ? `Partager dans ${selectedBranch.name}…` : 'Partager quelque chose avec vos abonnés…'}
              className="min-h-composer w-full resize-none bg-transparent text-body outline-none placeholder:text-ink-muted/70 dark:placeholder:text-zinc-600"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {carrierToggle}
              <span className={'ml-auto text-meta ' + mutedText}>{text.length}/280</span>
              <button
                onClick={send}
                disabled={!canSend}
                className="rounded-full bg-accent px-5 py-2.5 text-control font-extrabold text-white transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg enabled:hover:shadow-accent/40 disabled:opacity-40"
              >
                Envoyer
              </button>
            </div>
            {capacityWarning}
            {sendError && <p role="alert" className="mt-2 text-meta font-semibold text-red-600 dark:text-red-400">{sendError}</p>}
          </div>

          {/* posts */}
          {activeFeed.map((p) =>
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
                    <span className="text-nav font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400">
                      ÉCHO D'UNE BRANCHE · {p.distance?.toUpperCase()}
                    </span>
                    <b className="block text-body">{p.branch}</b>
                  </div>
                </div>
                <p className="my-3 text-control leading-relaxed">{p.text}</p>
                <div className="flex items-center gap-3">
                  <small className={'min-w-0 flex-1 truncate ' + mutedText}>
                    <b>{p.activity}</b>
                  </small>
                  <button
                    type="button"
                    onClick={() => navigate('/branches')}
                    className="shrink-0 whitespace-nowrap rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-caption font-extrabold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-night-1 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  >
                    Voir la branche
                  </button>
                </div>
              </article>
            ) : (
              <div key={p.id} className="mt-4 first:mt-0 lg:first:mt-4">
                <NoteCard
                  note={p}
                  age={formatArrivalAge(p.arrivedAt)}
                  replyCount={replyTotal(p)}
                  transmissionCount={p.transmissions + (transmissionCounts[p.id] ?? 0)}
                  transmissionPending={!!pendingTransmissions[p.id]}
                  bookmarked={bookmarkedNotes.some((bookmark) => bookmark.id === p.id)}
                  onOpen={p.pending ? undefined : () => setSelectedPost(p)}
                  onReply={() => openReply(p)}
                  onTransmit={() => openTransmit(p)}
                  onToggleBookmark={() => toggleBookmark(p)}
                />
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
                      className="min-h-composer w-full resize-none bg-transparent text-body outline-none placeholder:text-ink-muted/70 dark:placeholder:text-zinc-600"
                    />
                    {replyError && <p role="alert" className="mt-2 text-caption font-semibold text-red-600 dark:text-red-400">{replyError}</p>}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-sky-100 pt-3 dark:border-night-line">
                      {actionCarrierToggle}
                      <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeActionComposer}
                        className={'px-2 py-2 text-meta font-bold ' + mutedText}
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={!replyText.trim() || !carrierAvailable(actionCarrier)}
                        className="rounded-lg bg-accent px-3 py-2 text-meta font-extrabold text-white disabled:opacity-40"
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
                      <b className="block text-meta">Transmettre à vos abonnés</b>
                      <small className={mutedText}>Chaque abonné recevra la note après son trajet.</small>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-sky-100 pt-3 dark:border-night-line">
                      {actionCarrierToggle}
                      <div className="flex gap-2">
                        <button onClick={closeActionComposer} className={'px-2 py-2 text-meta font-bold ' + mutedText}>Annuler</button>
                        <button onClick={() => submitTransmit(p)} disabled={!carrierAvailable(actionCarrier) || !!pendingTransmissions[p.id]} className="rounded-lg bg-accent px-3 py-2 text-meta font-extrabold text-white disabled:opacity-40">Transmettre</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ),
          )}

          {activeFeedLoading && (
            <p className={panel + ' mt-4 p-6 text-center text-meta ' + mutedText}>
              Chargement des messages…
            </p>
          )}
          {activeFeedError && !activeFeedLoading && (
            <div className={panel + ' mt-4 p-6 text-center'}>
              <p role="alert" className="text-meta font-semibold text-red-600 dark:text-red-400">{activeFeedError}</p>
              <button type="button" onClick={() => void (selectedBranch ? loadBranchFeed() : loadFeed())} className="mt-3 text-meta font-bold text-accent">Réessayer</button>
            </div>
          )}
          {activeFeed.length === 0 && !activeFeedLoading && !activeFeedError && (
            <p className={panel + ' mt-4 p-6 text-center text-meta ' + mutedText}>
              {selectedBranch ? 'Aucune note dans cette branche.' : 'Aucun message arrivé pour le moment.'}
            </p>
          )}
            </>
          )}
        </main>

        {/* ================= COLONNE DROITE (fixe) ================= */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 py-8">
            {/* compteurs d'état simples */}
            <div className={panel + ' p-4.5'}>
              <h3 className="mb-3 text-label font-bold">Capacité d'envoi</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2">
                  <IconBird className="mx-auto text-xl text-accent" />
                  <b className="mt-1 block text-lg">{pigeonsFree}</b>
                  <small className={'text-nav ' + mutedText}>pigeons</small>
                </div>
                <div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2">
                  <IconMail className="mx-auto text-xl text-accent" />
                  <b className="mt-1 block text-lg">{stamps}</b>
                  <small className={'text-nav ' + mutedText}>timbres</small>
                </div>
                <div className="rounded-xl bg-sky-50 py-3 dark:bg-night-2">
                  <IconSend className="mx-auto text-xl text-amber-500" />
                  <b className="mt-1 block text-lg">{inFlight}</b>
                  <small className={'text-nav ' + mutedText}>en route</small>
                </div>
              </div>
            </div>

            {/* branches proches */}
            <div className={panel + ' mt-4 p-4.5'}>
              <h3 className="text-label font-bold">Près de vous</h3>
              {NEARBY_BRANCHES.map((b) => (
                <div
                  key={b.name}
                  className="flex cursor-pointer items-center gap-2.5 border-t border-sky-50 py-2.5 first:mt-1 first:border-t-0 dark:border-night-line"
                >
                  <IconMapPin className={'shrink-0 text-lg ' + mutedText} />
                  <div>
                    <b className="block text-sm hover:text-accent-strong dark:hover:text-accent-soft">
                      {b.name}
                    </b>
                    <small className={'text-xs ' + mutedText}>{b.info}</small>
                  </div>
                </div>
              ))}
              {NEARBY_BRANCHES.length === 0 && (
                <p className={'mt-3 text-caption ' + mutedText}>Aucune branche proche.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {currentRoute === '/settings' && (
        <section
          aria-labelledby="settings-title"
          className={
            'fixed inset-0 z-40 bg-page px-4 pt-5 dark:bg-night-0 lg:pt-10 ' +
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
                  <b className="block text-control">Apparence</b>
                  <small className={mutedText}>{dark ? 'Mode sombre' : 'Mode clair'}</small>
                </div>
                <button
                  type="button"
                  onClick={toggleDark}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-sky-50 px-4 text-sm font-bold text-accent-strong dark:bg-night-2 dark:text-accent-soft"
                >
                  {dark ? <IconSun /> : <IconMoon />}
                  Changer
                </button>
              </div>

              <fieldset className="p-4.5">
                <legend className="text-control font-bold">Navigation mobile</legend>
                <p className={'mt-1 text-meta ' + mutedText}>
                  Choisissez les deux raccourcis affichés au centre de la barre.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([0, 1] as const).map((index) => (
                    <label key={index} className="text-meta font-bold">
                      Raccourci {index + 1}
                      <select
                        value={shortcutRoutes[index]}
                        onChange={(event) => setMobileShortcut(index, event.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-sky-100 bg-sky-50 px-3 text-ink outline-none focus:border-accent dark:border-night-line dark:bg-night-2 dark:text-zinc-100"
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
                <div className="mt-5 border-t border-sky-100 pt-4 dark:border-night-line">
                  <b className="text-meta">Style du menu</b>
                  <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Style du menu mobile">
                    <button
                      type="button"
                      aria-pressed={menuStyle === 'bubbles'}
                      onClick={() => updateMobileMenuStyle('bubbles')}
                      className={'min-h-20 rounded-xl border p-3 text-left transition ' + (menuStyle === 'bubbles' ? 'border-accent bg-accent/10 text-accent dark:bg-accent/15 dark:text-accent-soft' : 'border-sky-100 bg-sky-50 text-ink dark:border-night-line dark:bg-night-2 dark:text-zinc-200')}
                    >
                      <span className="mb-2 flex items-end gap-1" aria-hidden="true">
                        <i className="h-2 w-7 rounded-full bg-current opacity-50" />
                        <i className="h-2 w-10 rounded-full bg-current opacity-75" />
                        <i className="h-2 w-12 rounded-full bg-current" />
                      </span>
                      <b className="block text-meta">Bulles</b>
                      <small>Par défaut</small>
                    </button>
                    <button
                      type="button"
                      aria-pressed={menuStyle === 'sheet'}
                      onClick={() => updateMobileMenuStyle('sheet')}
                      className={'min-h-20 rounded-xl border p-3 text-left transition ' + (menuStyle === 'sheet' ? 'border-accent bg-accent/10 text-accent dark:bg-accent/15 dark:text-accent-soft' : 'border-sky-100 bg-sky-50 text-ink dark:border-night-line dark:bg-night-2 dark:text-zinc-200')}
                    >
                      <span className="mb-2 grid w-12 grid-cols-3 gap-1" aria-hidden="true">
                        {Array.from({ length: 6 }).map((_, index) => <i key={index} className="h-2 rounded-sm bg-current" />)}
                      </span>
                      <b className="block text-meta">Feuille 3×2</b>
                      <small>Grille d’icônes</small>
                    </button>
                  </div>
                </div>
              </fieldset>

              <div className="p-4.5">
                <b className="block text-control">Compte</b>
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
      {!composeOpen && !menuOpen && (currentRoute === '/home' || !!selectedBranch) && (
        <FloatingActionButton label={selectedBranch ? `Écrire dans ${selectedBranch.name}` : 'Écrire une note'} onClick={() => setComposeOpen(true)}>
          <IconSend />
        </FloatingActionButton>
      )}

      {/* ================= COMPOSE PLEIN ÉCRAN — mobile ================= */}
      {composeOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-white lg:hidden dark:bg-night-0">
          <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-night-line">
            <button
              onClick={() => setComposeOpen(false)}
              className={'min-h-10 px-2 py-1 text-control font-bold ' + mutedText}
            >
              Annuler
            </button>
            <span className="mx-auto text-control font-extrabold">Nouvelle note</span>
            <button
              onClick={send}
              disabled={!canSend}
              className="rounded-full bg-accent px-4.5 py-2 text-label font-extrabold text-white disabled:opacity-40"
            >
              Envoyer
            </button>
          </header>

          <div className="px-4 pt-3">
            <p className={'text-meta font-semibold ' + mutedText}>
              {selectedBranch ? `Partagé dans ${selectedBranch.name}` : 'Partagé avec vos abonnés'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Mode d’envoi">
              <button
                type="button"
                onClick={() => setCarrier('BIRD')}
                aria-pressed={carrier === 'BIRD'}
                className={'flex min-h-14 items-center gap-2.5 rounded-xl border px-3 text-left transition ' + (carrier === 'BIRD' ? 'border-accent bg-accent/12 text-accent dark:bg-accent/15 dark:text-accent-soft' : 'border-slate-200 dark:border-night-line ' + mutedText)}
              >
                <IconBird className="shrink-0 text-lg" />
                <span><b className="block text-meta">Oiseau</b><small>{pigeonsFree} disponible{pigeonsFree > 1 ? 's' : ''}</small></span>
              </button>
              <button
                type="button"
                onClick={() => setCarrier('POST')}
                aria-pressed={carrier === 'POST'}
                className={'flex min-h-14 items-center gap-2.5 rounded-xl border px-3 text-left transition ' + (carrier === 'POST' ? 'border-accent bg-accent/12 text-accent dark:bg-accent/15 dark:text-accent-soft' : 'border-slate-200 dark:border-night-line ' + mutedText)}
              >
                <IconMail className="shrink-0 text-lg" />
                <span><b className="block text-meta">Lettre</b><small>{stamps} disponible{stamps > 1 ? 's' : ''}</small></span>
              </button>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            autoFocus
            placeholder={selectedBranch ? `Partager dans ${selectedBranch.name}…` : 'Partager quelque chose avec vos abonnés…'}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-title outline-none placeholder:text-ink-muted/70 dark:placeholder:text-zinc-600"
          />

          <footer className="border-t border-slate-100 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] dark:border-night-line">
            <div className="flex justify-end"><span className={'text-meta ' + mutedText}>{text.length}/280</span></div>
            {capacityWarning}
          </footer>
        </div>
      )}

      {!composeOpen && (
        <MobileNavigation
          currentRoute={currentRoute}
          bookmarkCount={bookmarkCount}
          shortcuts={mobileShortcuts}
          menuItems={NAV}
          onNavigate={navigate}
          onOpenMenu={() => setMenuOpen((open) => !open)}
          menuOpen={menuOpen}
          menuStyle={menuStyle}
        />
      )}
    </div>
  )
}
