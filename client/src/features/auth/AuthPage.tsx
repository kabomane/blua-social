import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  checkEmail,
  checkUsername,
  login,
  register,
  storeUser,
  type User,
} from '../../api/auth'
import {
  IconBird,
  IconBlock,
  IconBranch,
  IconEye,
  IconMail,
  IconMapPin,
  IconMoon,
  IconSun,
} from '../../components/icons'

interface Props {
  onAuth: (user: User) => void
  dark: boolean
  toggleDark: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid'
type GeoState = 'idle' | 'asking' | 'granted' | 'denied'

// Position fictive, réservée aux essais locaux. Ne jamais l'utiliser pour
// contourner la géolocalisation dans une build de production.
const DEV_LOCATION = { lat: 48.8566, lon: 2.3522 }

export default function AuthPage({ onAuth, dark, toggleDark }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  // signup : 1 = email + mdp, 2 = @username, 3 = localisation (obligatoire)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [availability, setAvailability] = useState<Availability>('idle')
  const [geo, setGeo] = useState<GeoState>('idle')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const checkSeq = useRef(0)

  const signup = mode === 'signup'
  const emailOk = EMAIL_RE.test(email.trim())
  const emailBad = email.length > 0 && !emailOk
  const passShort = password.length > 0 && password.length < 4

  const step1Valid = emailOk && password.length >= 4

  // vérification live du @username (debounce 400 ms)
  useEffect(() => {
    if (!signup || step !== 2) return
    const name = username.trim()
    if (name.length === 0) {
      setAvailability('idle')
      return
    }
    if (!USERNAME_RE.test(name)) {
      setAvailability('invalid')
      return
    }
    setAvailability('checking')
    const seq = ++checkSeq.current
    const t = setTimeout(async () => {
      try {
        const free = await checkUsername(name)
        if (seq === checkSeq.current) setAvailability(free ? 'free' : 'taken')
      } catch {
        if (seq === checkSeq.current) setAvailability('invalid')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [username, signup, step])

  function switchMode(m: 'login' | 'signup') {
    setMode(m)
    setStep(1)
    setError('')
    setAvailability('idle')
    setGeo('idle')
    setCoords(null)
  }

  // étape 3 : demande de localisation au navigateur pour les calculs d'envoi.
  function askLocation() {
    if (!window.isSecureContext) {
      setGeo('denied')
      setError(
        "La géolocalisation exige HTTPS sur cette adresse. En local, ouvrez http://localhost:5173 ou utilisez la position de développement.",
      )
      return
    }
    if (!('geolocation' in navigator)) {
      setGeo('denied')
      setError("Votre navigateur ne permet pas la localisation — elle est requise pour rejoindre le réseau.")
      return
    }
    setGeo('asking')
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeo('granted')
      },
      () => {
        setGeo('denied')
        setError('La localisation est obligatoire : le réseau est géographique, les messages voyagent vers votre ville.')
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    )
  }

  function useDevLocation() {
    setCoords(DEV_LOCATION)
    setGeo('granted')
    setError('')
  }

  // étape 1 signup : on vérifie que l'email est libre avant de passer à l'étape 2
  async function nextStep() {
    if (!step1Valid || busy) return
    setBusy(true)
    setError('')
    try {
      const free = await checkEmail(email.trim())
      if (!free) {
        setError('Un compte existe déjà avec cet email.')
        return
      }
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')

    if (!signup) {
      if (!step1Valid) return
      setBusy(true)
      try {
        const user = await login(email.trim(), password)
        await storeUser(user)
        onAuth(user)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue.')
      } finally {
        setBusy(false)
      }
      return
    }

    if (step === 1) {
      void nextStep()
      return
    }

    if (step === 2) {
      if (availability !== 'free') return
      setStep(3)
      return
    }

    if (!coords) return
    setBusy(true)
    try {
      const user = await register({
        email: email.trim(),
        password,
        username: username.trim(),
        latitude: coords.lat,
        longitude: coords.lon,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      await storeUser(user)
      onAuth(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setBusy(false)
    }
  }

  const field =
    // 16px minimum : en dessous, iOS zoome automatiquement au focus
    'w-full rounded-xl border-[1.5px] border-slate-200 bg-transparent px-4 py-3 text-[16px] outline-none transition ' +
    'focus:border-accent focus:ring-[3px] focus:ring-accent/15 ' +
    'dark:border-night-line dark:focus:border-accent-soft dark:focus:ring-accent-soft/10'

  const availMsg: Record<Availability, { text: string; cls: string }> = {
    idle: { text: '3 à 20 caractères : lettres, chiffres, underscore.', cls: 'text-[#5b7a94] dark:text-zinc-500' },
    checking: { text: 'Vérification…', cls: 'text-[#5b7a94] dark:text-zinc-500' },
    free: { text: '✓ Disponible !', cls: 'font-semibold text-emerald-600 dark:text-emerald-400' },
    taken: { text: "✗ Ce nom d'utilisateur est déjà pris.", cls: 'font-semibold text-red-500' },
    invalid: { text: '3 à 20 caractères : lettres, chiffres, underscore.', cls: 'font-semibold text-red-500' },
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-gradient-to-b from-sky-strong to-sky-soft text-[#1c3d5a] transition-colors md:grid-cols-[1fr_480px] dark:from-night-0 dark:to-night-0 dark:text-zinc-100">
      {/* ---------- gauche : promesse ---------- */}
      <section className="relative hidden flex-col justify-center overflow-hidden p-16 md:flex">
        <h1 className="max-w-[520px] text-[42px] leading-[1.15] font-extrabold">
          Un réseau social où les messages{' '}
          <span className="text-accent dark:text-accent-soft">voyagent vraiment</span>.
        </h1>
        <p className="mt-4 max-w-[440px] text-[17px] leading-relaxed text-[#5b7a94] dark:text-zinc-400">
          Vos pigeons et vos lettres portent vos mots à travers le monde. La
          distance compte, l'attente a du sens, chaque arrivée est une surprise.
        </p>
        <ul className="mt-8 flex flex-col gap-3.5 text-[15px] font-semibold text-[#5b7a94] dark:text-zinc-400">
          <li className="flex items-center gap-3">
            <IconBird className="shrink-0 text-lg text-accent" /> Des pigeons rapides
            sur les courtes distances
          </li>
          <li className="flex items-center gap-3">
            <IconMail className="shrink-0 text-lg text-accent" /> Des lettres efficaces
            au bout du monde
          </li>
          <li className="flex items-center gap-3">
            <IconBranch className="shrink-0 text-lg text-accent" /> Des branches — lieux
            persistants où se retrouver
          </li>
          <li className="flex items-center gap-3">
            <IconBlock className="shrink-0 text-lg text-accent" /> Pas de likes, pas de
            followers, pas d'algorithme opaque
          </li>
        </ul>
      </section>

      {/* ---------- droite : formulaire ---------- */}
      <section className="relative flex flex-col justify-center border-l border-white/40 bg-white/90 px-10 py-12 backdrop-blur md:px-14 dark:border-night-line dark:bg-night-1">
        <button
          type="button"
          onClick={toggleDark}
          title="Basculer clair/sombre"
          className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 transition hover:rotate-[30deg] dark:border-night-line"
        >
          {dark ? <IconSun /> : <IconMoon />}
        </button>

        <div className="mb-8 flex items-center gap-2.5 text-xl font-extrabold">
          <IconBird className="text-accent" /> Blue Atmosphere
        </div>

        <div className="mb-6 flex rounded-xl bg-slate-400/10 p-1 dark:bg-night-2">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={
                'flex-1 rounded-[9px] py-2.5 text-sm font-extrabold transition ' +
                (mode === m
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'text-[#5b7a94] dark:text-zinc-500')
              }
            >
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        {/* indicateur d'étapes (inscription) */}
        {signup && (
          <div className="mb-5 flex items-center gap-2 text-xs font-bold text-[#5b7a94] dark:text-zinc-500">
            {(
              [
                [1, 'Identifiants'],
                [2, 'Nom'],
                [3, 'Localisation'],
              ] as [1 | 2 | 3, string][]
            ).map(([n, label], i) => (
              <span key={n} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-5 bg-slate-300 dark:bg-night-line" />}
                <span
                  className={
                    'flex h-6 w-6 items-center justify-center rounded-full ' +
                    (step === n
                      ? 'bg-accent text-white'
                      : step > n
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-300 text-white dark:bg-night-2')
                  }
                >
                  {step > n ? '✓' : n}
                </span>
                {label}
              </span>
            ))}
          </div>
        )}

        <h2 className="text-2xl font-bold">
          {!signup
            ? 'Content de vous revoir'
            : step === 1
              ? 'Rejoindre le réseau'
              : step === 2
                ? 'Choisissez votre nom'
                : 'Où êtes-vous ?'}
        </h2>
        <p className="mt-1 mb-6 text-sm text-[#5b7a94] dark:text-zinc-500">
          {!signup
            ? 'Vos pigeons vous attendent au perchoir.'
            : step === 1
              ? "3 pigeons et quelques timbres offerts à l'arrivée."
              : step === 2
                ? "C'est le nom que verront vos amis et les branches."
                : 'Le réseau est géographique : les messages voyagent vers votre ville.'}
        </p>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {(!signup || step === 1) && (
            <>
              <div>
                <label className="mb-1.5 block text-[13px] font-bold">Adresse email</label>
                <input
                  className={field + (emailBad ? ' !border-red-400' : '')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  autoComplete="email"
                />
                <p className="mt-1 min-h-4 text-xs font-semibold text-red-500">
                  {emailBad ? 'Adresse email invalide.' : ''}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-bold">Mot de passe</label>
                <div className="relative">
                  <input
                    className={field + (passShort ? ' !border-red-400' : '')}
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    autoComplete={signup ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 opacity-60"
                  >
                    <IconEye />
                  </button>
                </div>
                <p
                  className={
                    'mt-1 min-h-4 text-xs ' +
                    (passShort
                      ? 'font-semibold text-red-500'
                      : password.length >= 4
                        ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                        : 'text-[#5b7a94] dark:text-zinc-500')
                  }
                >
                  {passShort
                    ? `Trop court : ${password.length}/4 caractères.`
                    : password.length >= 4
                      ? '✓ Mot de passe valide.'
                      : '4 caractères minimum.'}
                </p>
              </div>

            </>
          )}

          {signup && step === 2 && (
            <div>
              <label className="mb-1.5 block text-[13px] font-bold">Nom d'utilisateur</label>
              <div className="relative">
                <span className="absolute top-1/2 left-4 -translate-y-1/2 font-bold text-[#5b7a94] dark:text-zinc-500">
                  @
                </span>
                <input
                  className={
                    field +
                    ' pl-9' +
                    (availability === 'taken' || availability === 'invalid'
                      ? ' !border-red-400'
                      : availability === 'free'
                        ? ' !border-emerald-500'
                        : '')
                  }
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="pigeon_voyageur"
                  autoComplete="off"
                  autoFocus
                  spellCheck={false}
                />
              </div>
              <p className={'mt-1 min-h-4 text-xs ' + availMsg[availability].cls}>
                {availMsg[availability].text}
              </p>
            </div>
          )}

          {signup && step === 3 && (
            <div className="flex flex-col items-center gap-4 rounded-xl border-[1.5px] border-dashed border-slate-200 px-6 py-8 text-center dark:border-night-line">
              <div
                className={
                  'flex h-14 w-14 items-center justify-center rounded-full text-2xl ' +
                  (geo === 'granted'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-accent/10 text-accent dark:text-accent-soft')
                }
              >
                <IconMapPin />
              </div>

              {geo === 'granted' ? (
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Position enregistrée — elle servira à calculer vos envois.
                </p>
              ) : (
                <>
                  <p className="text-sm text-[#5b7a94] dark:text-zinc-500">
                    Votre latitude et longitude serviront à calculer la distance et le
                    temps d'arrivée de vos envois.
                  </p>
                  <button
                    type="button"
                    onClick={askLocation}
                    disabled={geo === 'asking'}
                    className="rounded-full border-2 border-accent px-5 py-2.5 text-sm font-extrabold text-accent transition hover:bg-accent hover:text-white disabled:opacity-50 dark:text-accent-soft"
                  >
                    {geo === 'asking' ? 'Localisation…' : 'Autoriser la localisation'}
                  </button>
                  {import.meta.env.DEV && !window.isSecureContext && (
                    <button
                      type="button"
                      onClick={useDevLocation}
                      className="text-sm font-bold text-[#5b7a94] underline hover:text-accent dark:text-zinc-500"
                    >
                      Utiliser Paris pour le développement
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              busy ||
              (!signup
                ? !step1Valid
                : step === 1
                  ? !step1Valid
                  : step === 2
                    ? availability !== 'free'
                    : geo !== 'granted')
            }
            className="mt-1 rounded-xl bg-accent py-3.5 text-base font-extrabold text-white transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-xl enabled:hover:shadow-accent/40 disabled:opacity-45"
          >
            {busy
              ? 'Envoi…'
              : !signup
                ? 'Se connecter'
                : step === 1
                  ? 'Continuer →'
                  : step === 2
                    ? 'Continuer →'
                    : 'Créer mon compte'}
          </button>

          {signup && (step === 2 || step === 3) && (
            <button
              type="button"
              onClick={() => {
                setStep((s) => (s === 3 ? 2 : 1))
                setError('')
              }}
              className="text-sm font-bold text-[#5b7a94] hover:underline dark:text-zinc-500"
            >
              ← Revenir en arrière
            </button>
          )}
        </form>
      </section>
    </div>
  )
}
