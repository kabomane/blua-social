import { IconBird, IconBookmark, IconMail, IconRepeat, IconReply, IconSend } from '../../components/icons'

export interface NoteCardData {
  id: string
  author: string
  handle: string
  color: string
  avatarUrl: string | null
  method: 'BIRD' | 'POST'
  distance: string
  pending: boolean
  text: string
}

interface NoteCardProps {
  note: NoteCardData
  age: string
  replyCount: number
  transmissionCount: number
  transmissionPending?: boolean
  onOpen?: () => void
  onReply?: () => void
  onTransmit?: () => void
  bookmarked?: boolean
  onToggleBookmark?: () => void
  className?: string
}

const panel =
  'rounded-2xl bg-white shadow-card dark:border dark:border-night-line dark:bg-night-1 dark:shadow-none'
const muted = 'text-ink-muted dark:text-zinc-500'

export default function NoteCard({
  note,
  age,
  replyCount,
  transmissionCount,
  transmissionPending = false,
  onOpen,
  onReply,
  onTransmit,
  bookmarked = false,
  onToggleBookmark,
  className = '',
}: NoteCardProps) {
  return (
    <article
      onClick={onOpen}
      onKeyDown={(event) => {
        if (onOpen && (event.key === 'Enter' || event.key === ' ')) onOpen()
      }}
      tabIndex={onOpen ? 0 : undefined}
      className={
        (note.pending
          ? 'rounded-2xl border-2 border-dashed border-accent/45 bg-white/70 shadow-none dark:border-accent/35 dark:bg-night-1/70'
          : panel + (onOpen ? ' cursor-pointer transition hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-night-2' : '')) +
        ' p-4.5 ' +
        (!note.pending ? 'pb-0.5 ' : '') +
        className
      }
    >
      {note.pending && (
        <div className="mb-3 flex items-center gap-2 text-caption font-extrabold text-accent dark:text-accent-soft">
          <IconSend className="animate-pulse" />
          Pris en compte · en cours d’envoi
        </div>
      )}

      <div className="flex items-center gap-2.5">
        {note.avatarUrl ? (
          <img src={note.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-control font-extrabold text-white"
            style={{ background: note.color }}
          >
            {note.author.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <b className="text-control">{note.author}</b>
          <small className={'block text-meta ' + muted}>@{note.handle}</small>
        </div>
        <div className={'ml-auto flex items-center gap-1.5 text-caption whitespace-nowrap ' + muted}>
          {note.method === 'BIRD' ? <IconBird /> : <IconMail />}
          <span>{age} · {note.distance}</span>
        </div>
      </div>

      <p className="my-3 text-control leading-relaxed">{note.text}</p>

      {!note.pending && (
        <div className="mt-6 flex items-center gap-2 border-t border-sky-100 pt-1.5 dark:border-night-line">
          {onReply && <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onReply()
            }}
            title="Répondre à cette note"
            aria-label={`Répondre — ${replyCount}`}
            className={'flex min-h-tap-compact items-center gap-1.5 rounded-full px-2 py-1 text-meta font-bold transition hover:bg-sky-50 hover:text-accent-strong dark:hover:bg-night-2 ' + muted}
          >
            <IconReply /> {replyCount}
          </button>}
          {onTransmit && <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onTransmit()
            }}
            title="Transmettre cette note à vos abonnés"
            aria-label={`Retransmettre — ${transmissionCount}`}
            className={'flex min-h-tap-compact items-center gap-1.5 rounded-full px-2 py-1 text-meta font-bold transition hover:bg-sky-50 hover:text-accent-strong dark:hover:bg-night-2 ' + muted}
          >
            <IconRepeat /> {transmissionCount}
          </button>}
          {transmissionPending && (
            <span title="Transmission en cours vers le hub" className={'ml-auto ' + muted}>
              <IconSend className="text-meta" />
            </span>
          )}
          {onToggleBookmark && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleBookmark()
              }}
              aria-label={bookmarked ? 'Retirer des signets' : 'Ajouter aux signets'}
              aria-pressed={bookmarked}
              title={bookmarked ? 'Retirer des signets' : 'Ajouter aux signets'}
              className={'ml-auto flex min-h-tap-compact min-w-tap-compact items-center justify-center rounded-full transition hover:bg-sky-50 hover:text-accent-strong dark:hover:bg-night-2 ' + muted}
            >
              <IconBookmark className={bookmarked ? 'fill-current' : ''} />
            </button>
          )}
        </div>
      )}
    </article>
  )
}
