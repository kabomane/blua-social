import { useState } from 'react'
import { updateLocation, type User } from '../../api/auth'
import { IconBird, IconMapPin } from '../../components/icons'

interface Props {
  user: User
  onUpdated: (user: User) => void
  onLogout: () => Promise<void>
}

export default function LocationGate({ user, onUpdated, onLogout }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function savePosition(latitude: number, longitude: number) {
    try {
      const nextUser = await updateLocation(user.id, latitude, longitude)
      onUpdated(nextUser)
    } catch (cause) {
      setState('error')
      setError(cause instanceof Error ? cause.message : 'Mise à jour impossible.')
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setState('error')
      setError('La géolocalisation n’est pas disponible dans ce navigateur.')
      return
    }
    setState('loading')
    setError('')
    navigator.geolocation.getCurrentPosition(
      (position) => void savePosition(position.coords.latitude, position.coords.longitude),
      () => {
        setState('error')
        setError('Autorisez la localisation pour continuer à utiliser Blue Atmosphere.')
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 },
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-sky-strong via-sky-soft to-page p-5 text-ink dark:from-night-0 dark:via-night-0 dark:to-night-0 dark:text-zinc-100">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-dialog dark:border dark:border-night-line dark:bg-night-1 dark:shadow-none">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-2xl text-accent dark:bg-accent/15"><IconMapPin /></span>
        <h1 className="mt-5 text-2xl font-extrabold">Actualiser votre position</h1>
        <p className="mt-2 text-control leading-relaxed text-ink-muted dark:text-zinc-400">Blue Atmosphere a besoin de votre position actuelle pour calculer les trajets et vous montrer les branches proches. Cette vérification est demandée au premier plan, au plus une fois toutes les 24 heures.</p>
        <button type="button" onClick={requestLocation} disabled={state === 'loading'} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-extrabold text-white disabled:opacity-50"><IconBird />{state === 'loading' ? 'Mise à jour…' : 'Mettre à jour ma position'}</button>
        {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
        <button type="button" onClick={() => void onLogout()} className="mt-6 w-full text-sm font-bold text-ink-muted hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-100">Se déconnecter</button>
      </section>
    </main>
  )
}
