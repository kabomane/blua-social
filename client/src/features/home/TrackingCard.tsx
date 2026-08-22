import { useState } from 'react'
import MappyPlanisphere from '../../components/MappyPlanisphere'
import type { OutgoingDelivery } from '../../api/deliveries'
import { IconChevronDown } from '../../components/icons'

interface Props {
  delivery: OutgoingDelivery
}

function remaining(deliveredAt: number) {
  const minutes = Math.max(0, Math.ceil((deliveredAt * 1000 - Date.now()) / 60_000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`
}

function dateTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TrackingCard({ delivery }: Props) {
  const [open, setOpen] = useState(false)
  const method = delivery.method
  const now = Date.now()
  const durationMs = (delivery.delivered_at - delivery.sent_at) * 1000
  const progress = durationMs <= 0 ? 1 : Math.min(1, Math.max(0, (now - delivery.sent_at * 1000) / durationMs))
  const timeline = JSON.parse(delivery.timeline_json) as {
    effectiveSpeedKmH?: number
    timeline?: { type: string; from?: string; to?: string; hub?: string; start?: number; end?: number }[]
  }
  const destination = delivery.destination_label
  const originPoint = { label: 'Vous', lat: delivery.origin_lat, lon: delivery.origin_lon }
  const destinationPoint = { label: destination, lat: delivery.destination_lat, lon: delivery.destination_lon }
  const routePoints = delivery.route_points
    .filter((point) => !(
      (point.lat === delivery.destination_lat && point.lon === delivery.destination_lon)
      || (point.lat === delivery.origin_lat && point.lon === delivery.origin_lon)
    ))
    .map((point) => ({ id: point.id, label: `Hub ${point.city}`, lat: point.lat, lon: point.lon }))
  const pointFor = (id?: string) => {
    if (!id || id === 'sender') return originPoint
    if (id === 'receiver') return destinationPoint
    return routePoints.find((point) => point.id === id)
      ?? delivery.route_points.find((point) => point.id === id)
      ?? destinationPoint
  }
  const activeStep = timeline.timeline?.find((step) => step.start !== undefined && step.end !== undefined && now / 1000 >= step.start && now / 1000 <= step.end)
  const stepFrom = pointFor(activeStep?.from ?? activeStep?.hub)
  const stepTo = pointFor(activeStep?.to ?? activeStep?.hub)
  const stepProgress = activeStep?.start !== undefined && activeStep.end !== undefined && activeStep.end > activeStep.start
    ? Math.min(1, Math.max(0, (now / 1000 - activeStep.start) / (activeStep.end - activeStep.start)))
    : progress
  const current = delivery.method === 'POST' && activeStep
    ? { lat: stepFrom.lat + (stepTo.lat - stepFrom.lat) * stepProgress, lon: stepFrom.lon + (stepTo.lon - stepFrom.lon) * stepProgress }
    : { lat: delivery.origin_lat + (delivery.destination_lat - delivery.origin_lat) * progress, lon: delivery.origin_lon + (delivery.destination_lon - delivery.origin_lon) * progress }
  const msg = {
    id: delivery.id,
    method,
    from: originPoint,
    to: destinationPoint,
    plan: { route: routePoints },
  }
  const state = { pos: current }
  return <article className="rounded-2xl border border-sky-100 bg-white shadow-[0_4px_14px_rgba(42,157,244,.08)] dark:border-night-line dark:bg-night-1 dark:shadow-none"><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 p-4 text-left"><div className="min-w-0 flex-1"><b className="block text-[15px]">{destination}</b><small className="mt-0.5 block text-[12px] text-[#5b7a94] dark:text-zinc-500">{method === 'BIRD' ? 'Pigeon en route' : 'Lettre en route'} · arrivée dans {remaining(delivery.delivered_at)}</small></div><IconChevronDown className={'shrink-0 text-lg text-[#5b7a94] transition-transform dark:text-zinc-500 ' + (open ? 'rotate-180' : '')} /></button>{open && <div className="px-4 pb-4"><div className="h-40 overflow-hidden rounded-xl"><MappyPlanisphere msg={msg} state={state} distance={delivery.distance_km} showDistance={false} /></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sky-100 dark:bg-night-2"><div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${progress * 100}%` }} /></div><div className="mt-2 flex justify-between text-[11px] text-[#5b7a94] dark:text-zinc-500"><span>Parti {dateTime(delivery.sent_at)}</span><span>{Math.round(progress * 100)} %</span></div><div className="mt-3 rounded-xl bg-sky-50 px-3 py-2.5 text-[12px] dark:bg-night-2"><b className="block text-[#1c3d5a] dark:text-zinc-100">Itinéraire</b><p className="mt-0.5 text-[#5b7a94] dark:text-zinc-500">{method === 'BIRD' ? `Vous → ${destination} · ${Math.round(delivery.distance_km).toLocaleString('fr-FR')} km${timeline.effectiveSpeedKmH ? ` · ${timeline.effectiveSpeedKmH} km/h` : ''}` : `Vous → collecte → acheminement local → ${destination}`}</p></div></div>}</article>
}
