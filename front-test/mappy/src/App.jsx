import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import {
  Bird, Mail, Send, MapPin, Clock, Plane, Truck, ChevronLeft,
  Check, Inbox, FastForward, RotateCcw, Feather, Package
} from "lucide-react";

const mappyPlanisphereModule = import("./MappyPlanisphere.jsx");
const MappyPlanisphere = lazy(() => mappyPlanisphereModule);

/* ============================================================
   MOTEUR — spec "Système de livraison de messages" v1.0
   ============================================================ */

const H = 3600e3;

const HOME = { lat: 50.46028, lon: 3.56917, label: "Moi" };

const HUBS = [
  // EUROPE
  { id: "EU_PAR", city: "Paris", region: "EUROPE", lat: 48.8566, lon: 2.3522, off: 1, gateway: true },
  { id: "EU_LON", city: "Londres", region: "EUROPE", lat: 51.5074, lon: -0.1278, off: 0, gateway: true },
  { id: "EU_AMS", city: "Amsterdam", region: "EUROPE", lat: 52.3676, lon: 4.9041, off: 1, gateway: false },
  { id: "EU_MAD", city: "Madrid", region: "EUROPE", lat: 40.4168, lon: -3.7038, off: 1, gateway: false },
  { id: "EU_BER", city: "Berlin", region: "EUROPE", lat: 52.52, lon: 13.405, off: 1, gateway: false },
  { id: "EU_ROM", city: "Rome", region: "EUROPE", lat: 41.9028, lon: 12.4964, off: 1, gateway: false },
  { id: "EU_WAW", city: "Varsovie", region: "EUROPE", lat: 52.2297, lon: 21.0122, off: 1, gateway: false },
  { id: "EU_STO", city: "Stockholm", region: "EUROPE", lat: 59.3293, lon: 18.0686, off: 1, gateway: false },
  // AMERICAS
  { id: "AM_YUL", city: "Montréal", region: "AMERICAS", lat: 45.5019, lon: -73.5674, off: -5, gateway: false },
  { id: "AM_NYC", city: "New York", region: "AMERICAS", lat: 40.7128, lon: -74.006, off: -5, gateway: true },
  { id: "AM_CHI", city: "Chicago", region: "AMERICAS", lat: 41.8781, lon: -87.6298, off: -6, gateway: false },
  { id: "AM_LAX", city: "Los Angeles", region: "AMERICAS", lat: 34.0522, lon: -118.2437, off: -8, gateway: true },
  { id: "AM_MEX", city: "Mexico", region: "AMERICAS", lat: 19.4326, lon: -99.1332, off: -6, gateway: false },
  { id: "AM_BOG", city: "Bogotá", region: "AMERICAS", lat: 4.711, lon: -74.0721, off: -5, gateway: false },
  { id: "AM_LIM", city: "Lima", region: "AMERICAS", lat: -12.0464, lon: -77.0428, off: -5, gateway: false },
  { id: "AM_SAO", city: "São Paulo", region: "AMERICAS", lat: -23.5505, lon: -46.6333, off: -3, gateway: false },
  { id: "AM_BUE", city: "Buenos Aires", region: "AMERICAS", lat: -34.6037, lon: -58.3816, off: -3, gateway: false },
  // AFRICA
  { id: "AF_CAS", city: "Casablanca", region: "AFRICA", lat: 33.5731, lon: -7.5898, off: 1, gateway: false },
  { id: "AF_DKR", city: "Dakar", region: "AFRICA", lat: 14.7167, lon: -17.4677, off: 0, gateway: false },
  { id: "AF_LOS", city: "Lagos", region: "AFRICA", lat: 6.5244, lon: 3.3792, off: 1, gateway: true },
  { id: "AF_CAI", city: "Le Caire", region: "AFRICA", lat: 30.0444, lon: 31.2357, off: 2, gateway: false },
  { id: "AF_ADD", city: "Addis-Abeba", region: "AFRICA", lat: 9.03, lon: 38.74, off: 3, gateway: false },
  { id: "AF_NBO", city: "Nairobi", region: "AFRICA", lat: -1.2921, lon: 36.8219, off: 3, gateway: true },
  { id: "AF_JNB", city: "Johannesburg", region: "AFRICA", lat: -26.2041, lon: 28.0473, off: 2, gateway: false },
  // ASIA_PACIFIC
  { id: "AS_TYO", city: "Tokyo", region: "ASIA_PACIFIC", lat: 35.6762, lon: 139.6503, off: 9, gateway: true },
  { id: "AS_SEL", city: "Séoul", region: "ASIA_PACIFIC", lat: 37.5665, lon: 126.978, off: 9, gateway: false },
  { id: "AS_BJS", city: "Pékin", region: "ASIA_PACIFIC", lat: 39.9042, lon: 116.4074, off: 8, gateway: false },
  { id: "AS_SHA", city: "Shanghai", region: "ASIA_PACIFIC", lat: 31.2304, lon: 121.4737, off: 8, gateway: false },
  { id: "AS_DEL", city: "New Delhi", region: "ASIA_PACIFIC", lat: 28.6139, lon: 77.209, off: 5.5, gateway: false },
  { id: "AS_BOM", city: "Mumbai", region: "ASIA_PACIFIC", lat: 19.076, lon: 72.8777, off: 5.5, gateway: false },
  { id: "AS_BKK", city: "Bangkok", region: "ASIA_PACIFIC", lat: 13.7563, lon: 100.5018, off: 7, gateway: false },
  { id: "AS_SIN", city: "Singapour", region: "ASIA_PACIFIC", lat: 1.3521, lon: 103.8198, off: 8, gateway: true },
  { id: "AS_JKT", city: "Jakarta", region: "ASIA_PACIFIC", lat: -6.2088, lon: 106.8456, off: 7, gateway: false },
  { id: "AS_SYD", city: "Sydney", region: "ASIA_PACIFIC", lat: -33.8688, lon: 151.2093, off: 10, gateway: false },
  // MIDDLE_EAST
  { id: "ME_IST", city: "Istanbul", region: "MIDDLE_EAST", lat: 41.0082, lon: 28.9784, off: 3, gateway: true },
  { id: "ME_THR", city: "Téhéran", region: "MIDDLE_EAST", lat: 35.6892, lon: 51.389, off: 3.5, gateway: false },
  { id: "ME_BGW", city: "Bagdad", region: "MIDDLE_EAST", lat: 33.3152, lon: 44.3661, off: 3, gateway: false },
  { id: "ME_RUH", city: "Riyad", region: "MIDDLE_EAST", lat: 24.7136, lon: 46.6753, off: 3, gateway: false },
  { id: "ME_DXB", city: "Dubaï", region: "MIDDLE_EAST", lat: 25.2048, lon: 55.2708, off: 4, gateway: true },
  { id: "ME_DOH", city: "Doha", region: "MIDDLE_EAST", lat: 25.2854, lon: 51.531, off: 3, gateway: false },
];

const CITIES = [
  { label: "Londres", lat: 51.5074, lon: -0.1278 },
  { label: "Rome", lat: 41.9028, lon: 12.4964 },
  { label: "Stockholm", lat: 59.3293, lon: 18.0686 },
  { label: "Montréal", lat: 45.5019, lon: -73.5674 },
  { label: "New York", lat: 40.7128, lon: -74.006 },
  { label: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { label: "Casablanca", lat: 33.5731, lon: -7.5898 },
  { label: "Dubaï", lat: 25.2048, lon: 55.2708 },
  { label: "Sydney", lat: -33.8688, lon: 151.2093 },
  { label: "Buenos Aires", lat: -34.6037, lon: -58.3816 },
];

function hashStr(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rand01 = (seed) => hashStr(seed) / 4294967295;
const rb = (seed, min, max) => min + (max - min) * rand01(seed);

function distanceKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

function greatCirclePosition(a, b, progress) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const toDeg = (radians) => radians * 180 / Math.PI;
  const vector = (point) => {
    const latitude = toRad(point.lat);
    const longitude = toRad(point.lon);
    return [
      Math.cos(latitude) * Math.cos(longitude),
      Math.cos(latitude) * Math.sin(longitude),
      Math.sin(latitude),
    ];
  };
  const start = vector(a);
  const end = vector(b);
  const dot = Math.min(Math.max(start[0] * end[0] + start[1] * end[1] + start[2] * end[2], -1), 1);
  const angle = Math.acos(dot);
  const divisor = Math.sin(angle);
  if (angle < 1e-7 || Math.abs(divisor) < 1e-7) return progress < 0.5 ? { ...a } : { ...b };

  const firstWeight = Math.sin((1 - progress) * angle) / divisor;
  const secondWeight = Math.sin(progress * angle) / divisor;
  const x = start[0] * firstWeight + end[0] * secondWeight;
  const y = start[1] * firstWeight + end[1] * secondWeight;
  const z = start[2] * firstWeight + end[2] * secondWeight;
  return {
    lat: toDeg(Math.atan2(z, Math.hypot(x, y))),
    lon: toDeg(Math.atan2(y, x)),
  };
}

const nearestHub = (p) => HUBS.reduce((best, h) => {
  const d = distanceKm(p, h);
  return d < best.d ? { hub: h, d } : best;
}, { hub: null, d: Infinity });

const nearestGateway = (hub) => {
  const gws = HUBS.filter((h) => h.region === hub.region && h.gateway);
  return gws.reduce((best, g) => (distanceKm(hub, g) < distanceKm(hub, best) ? g : best), gws[0]);
};

/* --- horaires hubs (offset UTC fixe, approximation mockup) --- */
const localParts = (hub, t) => {
  const d = new Date(t + hub.off * H);
  return { day: d.getUTCDay(), hour: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 };
};
const windowFor = (day) => (day === 0 ? null : day === 6 ? { open: 8, close: 16 } : { open: 6, close: 22 });

function nextOpen(hub, t) {
  for (let i = 0; i < 20; i++) {
    const { day, hour } = localParts(hub, t);
    const w = windowFor(day);
    if (w && hour >= w.open && hour < w.close) return t;
    if (w && hour < w.open) return t + (w.open - hour) * H;
    t += (24 - hour) * H + 1000;
  }
  return t;
}
function consumeWork(hub, t, workHours) {
  let rem = workHours;
  for (let i = 0; i < 60 && rem > 1e-9; i++) {
    t = nextOpen(hub, t);
    const { day, hour } = localParts(hub, t);
    const w = windowFor(day);
    const rate = day === 6 ? 0.5 : 1;
    const avail = (w.close - hour) * rate;
    if (avail >= rem) return t + (rem / rate) * H;
    rem -= avail;
    t += (w.close - hour) * H;
  }
  return t;
}
function nextDeparture(hub, t, freq) {
  const { hour } = localParts(hub, t);
  const next = Math.ceil((hour + 1e-9) / freq) * freq;
  return t + (next - hour) * H;
}
function transportMode(a, b, dist) {
  if (a.region !== b.region) return { type: "PLANE", speed: 750 };
  if (dist < 500) return { type: "GROUND", speed: 75 };
  if (dist < 1500) return { type: "FAST_GROUND", speed: 120 };
  return { type: "PLANE", speed: 750 };
}

/* --- OISEAU --- */
function planBird(id, from, to, sentAt) {
  const gps = distanceKm(from, to);
  const eff = gps * 1.1;
  const speed = rb(id + "_BIRD_SPEED", 45 * 0.92, 45 * 1.08);
  const flightHours = eff / speed;
  const segs = [];
  let t = sentAt, rem = flightHours;
  while (rem > 1e-6) {
    const f = Math.min(8, rem);
    segs.push({ type: "FLY", start: t, end: t + f * H });
    t += f * H; rem -= f;
    if (rem > 1e-6) { segs.push({ type: "REST", start: t, end: t + 16 * H }); t += 16 * H; }
  }
  return { method: "BIRD", gps, eff, speed, flightHours, segs, deliveredAt: t };
}
function birdState(plan, msg, now) {
  if (now >= plan.deliveredAt) return { status: "Livré", pos: msg.to, done: true, kmLeft: 0 };
  let flown = 0, current = "FLY";
  for (const s of plan.segs) {
    if (now >= s.end) { if (s.type === "FLY") flown += (s.end - s.start) / H; }
    else if (now >= s.start) { current = s.type; if (s.type === "FLY") flown += (now - s.start) / H; break; }
    else break;
  }
  const p = Math.min(flown / plan.flightHours, 1);
  return {
    status: current === "FLY" ? "Pigeon en vol" : "Pigeon au repos",
    resting: current === "REST",
    kmLeft: Math.round(plan.eff * (1 - p)),
    pos: greatCirclePosition(msg.from, msg.to, p),
  };
}

/* --- POSTE --- */
function planPost(id, from, to, sentAt) {
  const origin = nearestHub(from).hub;
  const dest = nearestHub(to).hub;
  let route;
  if (origin.region === dest.region) route = [origin, dest];
  else {
    route = [origin, origin.gateway ? origin : nearestGateway(origin), dest.gateway ? dest : nearestGateway(dest), dest];
  }
  route = route.filter((h, i) => i === 0 || h.id !== route[i - 1].id);

  const ev = [];
  let t = sentAt;

  const coll = rb(id + "_COLLECTION", 2, 6);
  ev.push({ type: "COLLECTION", label: "Collecte", start: t, end: (t += coll * H), at: from });

  const dOrig = distanceKm(from, origin);
  const lt = Math.max(dOrig / 65, 2);
  ev.push({ type: "LOCAL_TRANSPORT", label: `Vers centre ${origin.city}`, start: t, end: (t += lt * H), from, to: origin, mode: "GROUND" });

  route.forEach((hub, i) => {
    const proc = hub.gateway ? rb(id + "_HUB_" + hub.id, 8, 16) : rb(id + "_HUB_" + hub.id, 5, 12);
    const s = t;
    t = consumeWork(hub, t, proc);
    ev.push({ type: "HUB_PROCESSING", label: `Tri · ${hub.city}`, start: s, end: t, at: hub });

    const next = route[i + 1];
    if (next) {
      const dist = distanceKm(hub, next);
      const mode = transportMode(hub, next, dist);
      const freq = mode.type === "GROUND" ? 4 : mode.type === "FAST_GROUND" ? 6 : hub.region === next.region ? 8 : 12;
      const dep = nextDeparture(hub, t, freq);
      if (dep - t > 60e3) ev.push({ type: "WAITING_DEPARTURE", label: `Attente départ · ${hub.city}`, start: t, end: dep, at: hub });
      const travel = dist / mode.speed;
      ev.push({ type: "INTER_HUB_TRANSPORT", label: `${hub.city} → ${next.city}`, start: dep, end: dep + travel * H, from: hub, to: next, mode: mode.type });
      t = dep + travel * H;
    }
  });

  const dDest = distanceKm(dest, to);
  const fin = Math.max(dDest / 65, 2) + rb(id + "_FINAL", 2, 6);
  ev.push({ type: "FINAL_DELIVERY", label: "Distribution", start: t, end: (t += fin * H), from: dest, to, mode: "GROUND" });

  return { method: "POST", events: ev, route, deliveredAt: t };
}
function postState(plan, msg, now) {
  if (now >= plan.deliveredAt) return { status: "Livré", pos: msg.to, done: true };
  const e = plan.events.find((x) => now >= x.start && now < x.end) || plan.events[0];
  let pos;
  if (e.from && e.to) {
    const p = Math.min(Math.max((now - e.start) / (e.end - e.start), 0), 1);
    pos = greatCirclePosition(e.from, e.to, p);
  } else pos = e.at || msg.from;
  return { status: e.label, pos, event: e };
}

const msgState = (msg, now) =>
  msg.method === "BIRD" ? birdState(msg.plan, msg, now) : postState(msg.plan, msg, now);

/* ============================================================
   FORMATAGE
   ============================================================ */
const fmtDur = (ms) => {
  if (ms < 0) ms = 0;
  const m = Math.floor(ms / 60e3), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mn = m % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h${mn ? ` ${mn.toString().padStart(2, "0")}` : ""}`;
  return `${mn} min`;
};
const fmtDT = (t) =>
  new Date(t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) +
  " · " + new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtTime = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/* ============================================================
   UI
   ============================================================ */

const INK = "#1F2547", BLUE = "#2B50B8", RED = "#BE3A2B", PAPER = "#F7F2E6", BG = "#EAE3D2", LINE = "#D9CEB2";

const AirmailStripe = () => (
  <div className="h-2 w-full shrink-0" style={{
    background: `repeating-linear-gradient(45deg, ${RED} 0 12px, ${PAPER} 12px 24px, ${BLUE} 24px 36px, ${PAPER} 36px 48px)`,
  }} />
);

function WorldMap({ msg, state }) {
  return (
    <Suspense fallback={<div className="mappy-globe grid place-items-center text-xs font-mono" style={{ color: "#8FA2EC" }}>Chargement de Mappy…</div>}>
      <MappyPlanisphere
        msg={msg}
        state={state}
        distance={distanceKm(msg.from, msg.to)}
      />
    </Suspense>
  );
}
const ModeIcon = ({ mode, className }) =>
  mode === "PLANE" ? <Plane className={className} /> : <Truck className={className} />;

function ProgressBar({ value, color }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: LINE }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(value * 100, 100)}%`, background: color }} />
    </div>
  );
}

/* --- écran ENVOI --- */
function ComposeView({ now, onSend }) {
  const [dest, setDest] = useState(null);
  const [custom, setCustom] = useState(false);
  const [clat, setClat] = useState("");
  const [clon, setClon] = useState("");
  const [text, setText] = useState("");
  const [method, setMethod] = useState(null);
  const [nonce] = useState(() => Date.now());

  const target = custom
    ? (isFinite(parseFloat(clat)) && isFinite(parseFloat(clon))
        && Math.abs(parseFloat(clat)) <= 90 && Math.abs(parseFloat(clon)) <= 180
        ? { label: `${parseFloat(clat).toFixed(2)}, ${parseFloat(clon).toFixed(2)}`, lat: parseFloat(clat), lon: parseFloat(clon) }
        : null)
    : dest;

  const preview = useMemo(() => {
    if (!target) return null;
    const id = "MSG_" + hashStr(target.label + nonce).toString(16).toUpperCase().slice(0, 6);
    return { id, bird: planBird(id, HOME, target, now), post: planPost(id, HOME, target, now) };
  }, [target?.lat, target?.lon, nonce, Math.floor(now / 60e3)]);

  const canSend = target && method && text.trim();

  return (
    <div className="px-4 pb-32 pt-4 space-y-5">
      {/* destination */}
      <section>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#8A7F5F" }}>Destination</p>
        <div className="grid grid-cols-2 gap-2">
          {CITIES.map((c) => (
            <button key={c.label}
              onClick={() => { setDest(c); setCustom(false); }}
              className="min-h-11 px-3 rounded-xl text-sm font-medium text-left border transition-colors"
              style={!custom && dest?.label === c.label
                ? { background: INK, color: PAPER, borderColor: INK }
                : { background: PAPER, color: INK, borderColor: LINE }}>
              {c.label}
            </button>
          ))}
          <button onClick={() => setCustom(true)}
            className="min-h-11 px-3 rounded-xl text-sm font-medium text-left border col-span-2 flex items-center gap-2"
            style={custom ? { background: INK, color: PAPER, borderColor: INK } : { background: PAPER, color: INK, borderColor: LINE }}>
            <MapPin className="w-4 h-4" /> Coordonnées
          </button>
        </div>
        {custom && (
          <div className="flex gap-2 mt-2">
            <input value={clat} onChange={(e) => setClat(e.target.value)} inputMode="decimal" placeholder="lat"
              className="min-h-11 w-1/2 px-3 rounded-xl border font-mono outline-none"
              style={{ background: PAPER, borderColor: LINE, color: INK, fontSize: 16 }} />
            <input value={clon} onChange={(e) => setClon(e.target.value)} inputMode="decimal" placeholder="lon"
              className="min-h-11 w-1/2 px-3 rounded-xl border font-mono outline-none"
              style={{ background: PAPER, borderColor: LINE, color: INK, fontSize: 16 }} />
          </div>
        )}
      </section>

      {/* message */}
      <section>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#8A7F5F" }}>Message</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder="Écrire…"
          className="w-full px-3 py-2.5 rounded-xl border outline-none resize-none"
          style={{ background: PAPER, borderColor: LINE, color: INK, fontFamily: "Georgia, serif", fontSize: 16 }} />
      </section>

      {/* méthode */}
      <section>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#8A7F5F" }}>Méthode</p>
        <div className="space-y-2">
          <MethodCard
            active={method === "BIRD"} onClick={() => setMethod("BIRD")}
            icon={<Bird className="w-5 h-5" />} color={RED} title="Pigeon"
            plan={preview?.bird} now={now}
            detail={preview ? `${Math.round(preview.bird.gps)} km · vol direct` : "Vol direct A → B"} />
          <MethodCard
            active={method === "POST"} onClick={() => setMethod("POST")}
            icon={<Mail className="w-5 h-5" />} color={BLUE} title="Poste"
            plan={preview?.post} now={now}
            detail={preview ? preview.post.route.map((h) => h.id.slice(3)).join(" → ") : "Réseau de 40 centres"} />
        </div>
      </section>

      <button disabled={!canSend}
        onClick={() => onSend({ id: preview.id, target, text: text.trim(), method })}
        className="w-full min-h-12 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-opacity"
        style={{ background: method === "BIRD" ? RED : BLUE, color: PAPER, opacity: canSend ? 1 : 0.35 }}>
        <Send className="w-4 h-4" /> Envoyer
      </button>
    </div>
  );
}

function MethodCard({ active, onClick, icon, color, title, detail, plan, now }) {
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl border p-3.5 flex items-center gap-3 transition-all"
      style={{ background: PAPER, borderColor: active ? color : LINE, borderWidth: 2, boxShadow: active ? `0 2px 10px ${color}33` : "none" }}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
        style={{ background: active ? color : BG, color: active ? PAPER : INK }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm" style={{ color: INK }}>{title}</p>
        <p className="text-xs truncate font-mono" style={{ color: "#8A7F5F" }}>{detail}</p>
      </div>
      {plan && (
        <div className="text-right shrink-0">
          <p className="font-bold text-sm" style={{ color }}>{fmtDur(plan.deliveredAt - now)}</p>
          <p className="text-[11px]" style={{ color: "#8A7F5F" }}>{fmtDT(plan.deliveredAt)}</p>
        </div>
      )}
      {active && <Check className="w-4 h-4 shrink-0" style={{ color }} />}
    </button>
  );
}

/* --- écran SUIVI --- */
function TrackList({ messages, now, onOpen, onCompose }) {
  if (!messages.length)
    return (
      <div className="px-4 pt-20 text-center space-y-4">
        <Feather className="w-10 h-10 mx-auto" style={{ color: "#B5A87F" }} />
        <p className="text-sm" style={{ color: "#8A7F5F" }}>Aucun envoi.</p>
        <button onClick={onCompose} className="min-h-11 px-5 rounded-xl font-semibold text-sm"
          style={{ background: INK, color: PAPER }}>Écrire un message</button>
      </div>
    );
  return (
    <div className="px-4 pb-32 pt-4 space-y-2.5">
      {[...messages].sort((a, b) => b.sentAt - a.sentAt).map((m) => {
        const st = msgState(m, now);
        const color = m.method === "BIRD" ? RED : BLUE;
        const prog = st.done ? 1 : (now - m.sentAt) / (m.plan.deliveredAt - m.sentAt);
        return (
          <button key={m.id} onClick={() => onOpen(m.id)}
            className="w-full text-left rounded-xl border p-3.5 space-y-2.5"
            style={{ background: PAPER, borderColor: LINE }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: st.done ? "#3D7A46" : color, color: PAPER }}>
                {st.done ? <Check className="w-5 h-5" /> : m.method === "BIRD" ? <Bird className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: INK }}>{m.to.label}</p>
                <p className="text-xs truncate" style={{ color: "#8A7F5F" }}>{st.status}</p>
              </div>
              <div className="text-right shrink-0">
                {st.done
                  ? <p className="text-xs font-semibold" style={{ color: "#3D7A46" }}>{fmtDT(m.plan.deliveredAt)}</p>
                  : <>
                      <p className="text-sm font-bold" style={{ color }}>{fmtDur(m.plan.deliveredAt - now)}</p>
                      <p className="text-[11px]" style={{ color: "#8A7F5F" }}>restant</p>
                    </>}
              </div>
            </div>
            <ProgressBar value={prog} color={st.done ? "#3D7A46" : color} />
          </button>
        );
      })}
    </div>
  );
}

function DetailView({ msg, now, onBack }) {
  const st = msgState(msg, now);
  const color = msg.method === "BIRD" ? RED : BLUE;
  const prog = st.done ? 1 : (now - msg.sentAt) / (msg.plan.deliveredAt - msg.sentAt);

  return (
    <div className="px-4 pb-32 pt-3 space-y-4">
      <button onClick={onBack} className="min-h-11 flex items-center gap-1 text-sm font-medium -ml-1 px-1" style={{ color: INK }}>
        <ChevronLeft className="w-5 h-5" /> Suivi
      </button>

      <div className="rounded-2xl border overflow-hidden" style={{ background: PAPER, borderColor: LINE }}>
        <AirmailStripe />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold" style={{ color: INK, fontFamily: "Georgia, serif" }}>{msg.to.label}</p>
              <p className="text-[11px] font-mono" style={{ color: "#8A7F5F" }}>{msg.to.lat.toFixed(4)}, {msg.to.lon.toFixed(4)}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: st.done ? "#3D7A4622" : color + "22", color: st.done ? "#3D7A46" : color }}>
              {msg.method === "BIRD" ? <Bird className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
              {st.status}
            </div>
          </div>

          <WorldMap msg={msg} state={st} />

          <ProgressBar value={prog} color={st.done ? "#3D7A46" : color} />
          <div className="flex justify-between text-xs" style={{ color: "#8A7F5F" }}>
            <span>{fmtDT(msg.sentAt)}</span>
            <span className="font-semibold" style={{ color: INK }}>
              {st.done ? "Livré " + fmtDT(msg.plan.deliveredAt) : fmtDur(msg.plan.deliveredAt - now) + " restant"}
            </span>
          </div>
          {!st.done && msg.method === "BIRD" && (
            <p className="text-xs font-mono" style={{ color: "#8A7F5F" }}>
              {st.kmLeft.toLocaleString("fr-FR")} km restants · {msg.plan.speed.toFixed(1)} km/h
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-4" style={{ background: PAPER, borderColor: LINE }}>
        <p className="text-sm italic" style={{ color: INK, fontFamily: "Georgia, serif" }}>« {msg.text} »</p>
      </div>

      {msg.method === "POST" && <Timeline events={msg.plan.events} now={now} deliveredAt={msg.plan.deliveredAt} />}
      {msg.method === "BIRD" && <BirdTimeline plan={msg.plan} now={now} />}
    </div>
  );
}

function Timeline({ events, now, deliveredAt }) {
  return (
    <div className="rounded-2xl border p-4 space-y-0.5" style={{ background: PAPER, borderColor: LINE }}>
      {events.map((e, i) => {
        const done = now >= e.end, active = now >= e.start && now < e.end;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 my-0.5"
                style={{ background: done ? "#3D7A46" : active ? BLUE : BG, color: done || active ? PAPER : "#B5A87F" }}>
                {done ? <Check className="w-3.5 h-3.5" />
                  : e.type.includes("TRANSPORT") || e.type === "FINAL_DELIVERY"
                    ? <ModeIcon mode={e.mode} className="w-3.5 h-3.5" />
                    : e.type === "WAITING_DEPARTURE" ? <Clock className="w-3.5 h-3.5" />
                    : <Package className="w-3.5 h-3.5" />}
              </div>
              {i < events.length - 1 && <div className="w-px flex-1" style={{ background: done ? "#3D7A46" : LINE }} />}
            </div>
            <div className="pb-3 flex-1 min-w-0">
              <p className="text-sm font-medium leading-6" style={{ color: active ? BLUE : done ? INK : "#A79C77" }}>
                {e.label}{active && " …"}
              </p>
              <p className="text-[11px] font-mono" style={{ color: "#8A7F5F" }}>
                {fmtDT(e.start)} → {fmtTime(e.end)}
              </p>
            </div>
          </div>
        );
      })}
      <div className="flex gap-3">
        <div className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: now >= deliveredAt ? "#3D7A46" : BG, color: now >= deliveredAt ? PAPER : "#B5A87F" }}>
          <Inbox className="w-3.5 h-3.5" />
        </div>
        <p className="text-sm font-medium leading-6" style={{ color: now >= deliveredAt ? "#3D7A46" : "#A79C77" }}>
          Livraison · {fmtDT(deliveredAt)}
        </p>
      </div>
    </div>
  );
}

function BirdTimeline({ plan, now }) {
  const days = [];
  plan.segs.forEach((s) => { if (s.type === "FLY") days.push(s); });
  return (
    <div className="rounded-2xl border p-4" style={{ background: PAPER, borderColor: LINE }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#8A7F5F" }}>
        {days.length} {days.length > 1 ? "journées" : "journée"} de vol · 8 h/j
      </p>
      <div className="flex flex-wrap gap-1.5">
        {days.map((s, i) => {
          const done = now >= s.end, active = now >= s.start && now < s.end;
          return (
            <div key={i} className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-mono font-semibold"
              style={{
                background: done ? RED : active ? RED + "33" : BG,
                color: done ? PAPER : active ? RED : "#B5A87F",
                border: active ? `1.5px solid ${RED}` : "1px solid " + LINE,
              }}>
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --- MENU TEMPS --- */
function TimeMenu({ now, offset, onJump, onReset }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="min-h-11 px-3 rounded-xl border flex items-center gap-2 text-xs font-mono font-semibold"
        style={{
          background: offset ? "#F0E2B6" : PAPER,
          borderColor: offset ? "#D9BE6A" : LINE,
          color: offset ? "#7A5E12" : INK,
        }}>
        <Clock className="w-4 h-4" />
        {fmtDT(now)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-52 rounded-2xl border p-1.5 shadow-xl"
            style={{ background: PAPER, borderColor: LINE, boxShadow: "0 8px 28px rgba(31,37,71,0.22)" }}>
            <p className="text-[11px] px-3 pt-2 pb-1 font-semibold tracking-widest uppercase" style={{ color: "#8A7F5F" }}>
              Avancer le temps
            </p>
            {[["+ 1 heure", H], ["+ 6 heures", 6 * H], ["+ 1 jour", 24 * H], ["+ 3 jours", 72 * H], ["+ 7 jours", 168 * H]].map(([l, v]) => (
              <button key={l} onClick={() => onJump(v)}
                className="w-full min-h-11 px-3 rounded-xl text-sm font-medium text-left flex items-center gap-2.5 active:opacity-60"
                style={{ color: INK }}>
                <FastForward className="w-4 h-4" style={{ color: BLUE }} /> {l}
              </button>
            ))}
            {offset > 0 && (
              <button onClick={() => { onReset(); setOpen(false); }}
                className="w-full min-h-11 px-3 rounded-xl text-sm font-semibold text-left flex items-center gap-2.5 border-t active:opacity-60"
                style={{ color: RED, borderColor: LINE }}>
                <RotateCcw className="w-4 h-4" /> Temps réel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* --- APP --- */
export default function App() {
  const [realNow, setRealNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const now = realNow + offset;
  const [view, setView] = useState("track");
  const [openId, setOpenId] = useState(null);

  const [messages, setMessages] = useState(() => {
    const t0 = Date.now();
    const d1 = { ...CITIES[0] };
    const d2 = { ...CITIES[5] };
    const m1 = { id: "MSG_A1B2C3", to: d1, from: HOME, method: "BIRD", text: "On se voit samedi ?", sentAt: t0 - 3 * H };
    m1.plan = planBird(m1.id, HOME, d1, m1.sentAt);
    const m2 = { id: "MSG_D4E5F6", to: d2, from: HOME, method: "POST", text: "Carte postale numérique depuis le Nord.", sentAt: t0 - 30 * H };
    m2.plan = planPost(m2.id, HOME, d2, m2.sentAt);
    return [m1, m2];
  });

  useEffect(() => {
    const iv = setInterval(() => setRealNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const send = ({ id, target, text, method }) => {
    const msg = { id, to: target, from: HOME, method, text, sentAt: now };
    msg.plan = method === "BIRD" ? planBird(id, HOME, target, now) : planPost(id, HOME, target, now);
    setMessages((ms) => [...ms, msg]);
    setOpenId(id);
    setView("track");
  };

  const openMsg = messages.find((m) => m.id === openId);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: BG, color: INK }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        {/* header */}
        <header className="sticky top-0 z-20" style={{ background: BG }}>
          <AirmailStripe />
          <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: LINE }}>
            <div className="flex items-center gap-2">
              <Feather className="w-5 h-5" style={{ color: RED }} />
              <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "Georgia, serif" }}>Pli</span>
            </div>
            <TimeMenu now={now} offset={offset}
              onJump={(v) => setOffset((o) => o + v)}
              onReset={() => setOffset(0)} />
          </div>
        </header>

        {/* content */}
        <main className="flex-1">
          {view === "send" && <ComposeView now={now} onSend={send} />}
          {view === "track" && !openMsg && (
            <TrackList messages={messages} now={now} onOpen={setOpenId} onCompose={() => setView("send")} />
          )}
          {view === "track" && openMsg && (
            <DetailView msg={openMsg} now={now} onBack={() => setOpenId(null)} />
          )}
        </main>

        {/* nav */}
        <nav className="fixed bottom-0 inset-x-0 z-20 border-t" style={{ background: PAPER, borderColor: LINE }}>
          <div className="max-w-md mx-auto grid grid-cols-2">
            {[
              ["send", "Envoyer", <Send key="s" className="w-5 h-5" />],
              ["track", "Suivi", <Inbox key="i" className="w-5 h-5" />],
            ].map(([v, label, icon]) => (
              <button key={v} onClick={() => { setView(v); setOpenId(null); }}
                className="min-h-14 flex flex-col items-center justify-center gap-0.5 relative"
                style={{ color: view === v ? RED : "#8A7F5F" }}>
                {icon}
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
