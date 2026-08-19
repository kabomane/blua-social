import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '../../api/auth'
import { uploadAvatar } from '../../api/auth'
import { getCapacity, type Capacity, type OutgoingDelivery } from '../../api/deliveries'
import TrackingCard from './TrackingCard'
import {
  IconBell,
  IconBird,
  IconBookmark,
  IconBranch,
  IconMail,
  IconMapPin,
  IconReply,
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

function Branches() {
  const [tab, setTab] = useState<'joined' | 'discover'>('joined')
  const branches = tab === 'joined'
    ? [
        ['Photo de rue Paris', 'Montmartre · 4,1 km', 'Une nouvelle note est arrivée.', '3 amis y passent'],
        ['Cinéma indépendant', 'Paris · 6,7 km', 'Projection en discussion cette semaine.', '41 arrivées aujourd’hui'],
      ]
    : [
        ['Étudiants Paris', 'Paris · 2,3 km', 'Un endroit pour échanger entre deux cours.', 'Proche de vous'],
        ['Insomniaques de Soho', 'Londres', 'Quand la ville ne dort pas.', 'Branche active'],
        ['Français à Tokyo', 'Tokyo', 'Adresses, décalage horaire et nouvelles du quartier.', 'Découverte'],
      ]
  return (
    <>
      <PageHeader icon={IconBranch} title="Branches">Communautés ancrées dans un lieu. Position exacte jamais affichée.</PageHeader>
      <div className="mb-4 flex gap-2 rounded-xl bg-sky-50 p-1 dark:bg-night-2">
        {([['joined', 'Mes branches'], ['discover', 'Découvrir']] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={'min-h-10 flex-1 rounded-lg px-3 text-[13px] font-bold ' + (tab === id ? 'bg-white text-accent shadow-sm dark:bg-night-1 dark:text-accent-soft' : muted)}>{label}</button>)}
      </div>
      <div className="space-y-3">
        {branches.map(([name, place, text, detail]) => (
          <article key={name} className={card}>
            <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><IconBranch /></span><div className="min-w-0"><b className="block text-[15px]">{name}</b><span className={'mt-0.5 flex items-center gap-1 text-[12px] ' + muted}><IconMapPin /> {place}</span></div></div>
            <p className="mt-3 text-[14px] leading-relaxed">{text}</p><small className={'mt-3 block text-[12px] font-semibold ' + muted}>{detail}</small>
          </article>
        ))}
      </div>
    </>
  )
}

function Messages() {
  const conversations = [
    ['Emma', 'Londres · 343 km', 'Le café près de la gare est toujours ouvert ?', 'arrivé il y a 18 min', '#d64c7d'],
    ['Noah', 'Bruxelles · 264 km', 'Un pigeon est en route vers vous.', 'arrivée estimée 18:40', '#3c8dd9'],
    ['Maya', 'Tokyo', 'Merci pour tes adresses, je les garde.', 'hier', '#7d4cd6'],
  ]
  return <><PageHeader icon={IconMail} title="Cui-to-cui">Messages privés, seulement entre amis réciproques.</PageHeader><div className="space-y-3">{conversations.map(([name, place, text, state, color]) => <article key={name} className={card}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: color }}>{name[0]}</span><div className="min-w-0 flex-1"><b className="block text-[15px]">{name}</b><small className={muted}>{place}</small></div><small className={'text-right text-[11px] ' + muted}>{state}</small></div><p className="mt-3 text-[14px]">{text}</p></article>)}</div></>
}

function Notifications() {
  const [unread, setUnread] = useState(true)
  const items = [
    [IconBird, 'Un cui-to-cui d’Emma est arrivé.', 'Il y a 18 min'],
    [IconReply, 'Une réponse est arrivée dans Photo de rue Paris.', 'Aujourd’hui · 10:24'],
    [IconBranch, 'Une activité nouvelle dans Cinéma indépendant.', 'Hier'],
  ] as const
  return <><div className="mb-5 flex items-start justify-between gap-3"><PageHeader icon={IconBell} title="Notifications">Arrivées et activités utiles. Pas de métriques de popularité.</PageHeader>{unread && <button onClick={() => setUnread(false)} className="mt-1 shrink-0 text-[12px] font-bold text-accent">Tout lire</button>}</div><div className="space-y-2">{items.map(([Icon, text, date], index) => <article key={text} className={card + ' flex gap-3'}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent dark:bg-accent/15"><Icon /></span><div className="min-w-0 flex-1"><p className="text-[14px] font-semibold">{text}</p><small className={muted}>{date}</small></div>{unread && index === 0 && <span className="mt-2 h-2 w-2 rounded-full bg-accent" />}</article>)}</div></>
}

function Bookmarks() {
  return <><PageHeader icon={IconBookmark} title="Signets">Notes conservées pour y revenir plus tard.</PageHeader><div className="space-y-3"><article className={card}><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f47f2a] text-xs font-extrabold text-white">A</span><b className="text-[14px]">Alice</b><small className={'ml-auto ' + muted}>il y a 2 j</small></div><p className="mt-3 text-[14px] leading-relaxed">Je cherche encore où revoir ce film. Vous me direz si vous trouvez.</p></article><article className={card}><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7d4cd6] text-xs font-extrabold text-white">M</span><b className="text-[14px]">Marc</b><small className={'ml-auto ' + muted}>il y a 6 j</small></div><p className="mt-3 text-[14px] leading-relaxed">Une branche près du Fuji est restée dans ma tête.</p></article></div></>
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
  if (route === '/branches') return <Branches />
  if (route === '/messages') return <Messages />
  if (route === '/arrivals') return <Notifications />
  if (route === '/bookmarks') return <Bookmarks />
  return <Profile user={user} onUserUpdate={onUserUpdate} />
}
