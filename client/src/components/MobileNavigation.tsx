import { useEffect, useRef, type ComponentType, type CSSProperties, type SVGProps } from 'react'
import { IconHome, IconSettings } from './icons'

export interface MobileNavDestination {
  route: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  kind?: 'bookmarks'
}

interface MobileNavigationProps {
  currentRoute: string
  bookmarkCount: number
  shortcuts: readonly [MobileNavDestination, MobileNavDestination]
  menuItems: readonly MobileNavDestination[]
  onNavigate: (route: string) => void
  onOpenMenu: () => void
  menuOpen?: boolean
}

const HOME: MobileNavDestination = {
  route: '/home',
  label: 'Home',
  icon: IconHome,
}

export default function MobileNavigation({
  currentRoute,
  bookmarkCount,
  shortcuts,
  menuItems,
  onNavigate,
  onOpenMenu,
  menuOpen = false,
}: MobileNavigationProps) {
  const actions = [HOME, ...shortcuts]
  const navigationRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!navigationRef.current?.contains(event.target as Node)) onOpenMenu()
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenMenu()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen, onOpenMenu])

  return (
    <nav
      ref={navigationRef}
      aria-label="Navigation principale"
      className="fixed right-3 left-3 z-50 mx-auto grid min-h-[66px] max-w-[420px] grid-cols-4 overflow-visible rounded-2xl border border-white/70 bg-white/92 shadow-[0_10px_35px_rgba(28,61,90,.22)] backdrop-blur-xl lg:hidden dark:border-night-line dark:bg-night-1/94 dark:shadow-[0_12px_36px_rgba(0,0,0,.55)]"
      style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      {menuOpen && (
        <div
          aria-label="Menu principal"
          className="pointer-events-none absolute right-0 bottom-[calc(100%+12px)] flex w-[min(260px,calc(100vw-24px))] flex-col-reverse gap-2"
        >
          {menuItems
            .filter(
              (item) =>
                item.route !== currentRoute && !actions.some((action) => action.route === item.route),
            )
            .map((item, index) => {
            const active = currentRoute === item.route
            const Icon = item.icon
            const badge = item.kind === 'bookmarks' ? bookmarkCount : 0

            return (
              <button
                key={item.route}
                type="button"
                onClick={() => onNavigate(item.route)}
                className={
                  'mobile-menu-bubble pointer-events-auto ml-auto flex h-[58px] w-full origin-right items-center gap-3 rounded-full border px-4 text-left text-[14px] font-bold shadow-[0_10px_24px_rgba(28,61,90,.2)] backdrop-blur-xl transition active:scale-95 dark:border-night-line ' +
                  (active
                    ? 'border-white/80 bg-sky-50/95 text-accent dark:bg-accent/15 dark:text-accent-soft'
                    : 'border-white/70 bg-white/94 text-[#1c3d5a] dark:bg-night-1/95 dark:text-zinc-100')
                }
                style={{ '--bubble-delay': `${index * 90}ms` } as CSSProperties}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[19px] text-accent dark:bg-accent/15 dark:text-accent-soft">
                  <Icon />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {!!badge && badge > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            )
            })}
        </div>
      )}
      {actions.map((action, index) => {
        const active = !menuOpen && currentRoute === action.route
        const Icon = action.icon
        const showBookmarkBadge = action.kind === 'bookmarks' && bookmarkCount > 0

        return (
          <button
            key={`${index}-${action.route}`}
            type="button"
            aria-current={active ? 'page' : undefined}
            aria-label={
              showBookmarkBadge
                ? `${action.label}, ${bookmarkCount} signet${bookmarkCount > 1 ? 's' : ''}`
                : action.label
            }
            onClick={() => onNavigate(action.route)}
            className={
              'relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold transition active:scale-95 ' +
              (active
                ? 'text-accent dark:text-accent-soft'
                : 'text-[#5b7a94] hover:bg-sky-50/60 dark:text-zinc-500 dark:hover:bg-night-2')
            }
          >
            <span className="relative">
              <Icon className="text-[22px]" />
              {showBookmarkBadge && (
                <span className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] leading-none font-extrabold text-white">
                  {bookmarkCount > 99 ? '99+' : bookmarkCount}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{action.label}</span>
          </button>
        )
      })}
      <button
        type="button"
        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={menuOpen}
        onClick={onOpenMenu}
        className={
          'relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold transition active:scale-95 ' +
          (menuOpen
            ? 'text-accent dark:text-accent-soft'
            : 'text-[#5b7a94] hover:bg-sky-50/60 dark:text-zinc-500 dark:hover:bg-night-2')
        }
      >
        <IconSettings className="text-[22px]" />
        <span>Menu</span>
      </button>
    </nav>
  )
}
