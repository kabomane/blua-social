import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry, MultiLineString, MultiPoint } from 'geojson'

const INITIAL_WIDTH = 800
const HEIGHT = 450
const FIT_PADDING_X = 54
const FIT_PADDING_Y = 46
const MIN_LOCAL_SPAN_DEGREES = 0.35
const countryPalette = [
  'var(--color-map-country-1)',
  'var(--color-map-country-2)',
  'var(--color-map-country-3)',
  'var(--color-map-country-4)',
  'var(--color-map-country-5)',
]

interface CountryProperties {
  ADMIN?: string
  NAME?: string
  ADM0_A3?: string
}

interface MapPoint {
  id?: string
  label: string
  lat: number
  lon: number
}

interface MappyMessage {
  id: string
  method: 'BIRD' | 'POST'
  from: MapPoint
  to: MapPoint
  plan: { route: MapPoint[] }
}

interface Props {
  msg: MappyMessage
  state: { pos: { lat: number; lon: number } }
  distance: number
  showDistance?: boolean
}

const countriesPromise = fetch('/data/countries-110m.geojson')
  .then(async (response) => {
    if (!response.ok) throw new Error('Natural Earth countries unavailable')
    const geojson = await response.json() as FeatureCollection<Geometry, CountryProperties>
    return geojson.features
  })

function hashName(name: string) {
  let hash = 0
  for (const character of name) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return Math.abs(hash)
}

function countryColor(feature: Feature<Geometry, CountryProperties>) {
  const name = feature.properties?.ADMIN || feature.properties?.NAME || 'country'
  return countryPalette[hashName(name) % countryPalette.length]
}

function routeNodesFor(message: MappyMessage) {
  return message.method === 'POST'
    ? [message.from, ...message.plan.route, message.to]
    : [message.from, message.to]
}

function fittingGeometry(nodes: MapPoint[], routeGeometry: Feature<MultiLineString>) {
  const longitudes = nodes.map((node) => node.lon)
  const latitudes = nodes.map((node) => node.lat)
  const minLon = Math.min(...longitudes)
  const maxLon = Math.max(...longitudes)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const averageLatitude = (minLat + maxLat) / 2
  const adjustedLongitudeSpan = (maxLon - minLon) * Math.max(Math.cos(averageLatitude * Math.PI / 180), 0.2)
  const localSpan = Math.max(adjustedLongitudeSpan, maxLat - minLat)

  if (localSpan >= MIN_LOCAL_SPAN_DEGREES) return routeGeometry

  const latitudePadding = (MIN_LOCAL_SPAN_DEGREES - (maxLat - minLat)) / 2
  const longitudePadding = (MIN_LOCAL_SPAN_DEGREES - adjustedLongitudeSpan) /
    (2 * Math.max(Math.cos(averageLatitude * Math.PI / 180), 0.2))

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPoint',
      coordinates: [
        [minLon - longitudePadding, minLat - latitudePadding],
        [maxLon + longitudePadding, maxLat + latitudePadding],
      ],
    },
  } satisfies Feature<MultiPoint>
}

export default function MappyPlanisphere({ msg, state, distance, showDistance = true }: Props) {
  const [countries, setCountries] = useState<Feature<Geometry, CountryProperties>[]>([])
  const [canvasWidth, setCanvasWidth] = useState(INITIAL_WIDTH)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgId = useId().replaceAll(':', '')
  const nodes = useMemo(() => routeNodesFor(msg), [msg])

  useEffect(() => {
    let active = true
    void countriesPromise
      .then((features) => {
        if (active) setCountries(features)
      })
      .catch((error) => console.warn('Mappy: planisphère indisponible', error))
    return () => { active = false }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const updateWidth = () => {
      const bounds = container.getBoundingClientRect()
      if (bounds.width > 0 && bounds.height > 0) {
        setCanvasWidth(Math.max(HEIGHT, Math.round(HEIGHT * bounds.width / bounds.height)))
      }
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const { path, segments, projectedPoints, currentPoint } = useMemo(() => {
    const routeSegments = nodes.slice(0, -1).map((node, index) => [
      [node.lon, node.lat],
      [nodes[index + 1].lon, nodes[index + 1].lat],
    ])
    const routeGeometry: Feature<MultiLineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: routeSegments },
    }
    const projection = geoNaturalEarth1().precision(0.25)
    projection.fitExtent(
      [[FIT_PADDING_X, FIT_PADDING_Y], [canvasWidth - FIT_PADDING_X, HEIGHT - FIT_PADDING_Y]],
      fittingGeometry(nodes, routeGeometry),
    )
    projection.clipExtent([[0, 0], [canvasWidth, HEIGHT]])
    const nextPath = geoPath(projection)

    return {
      path: nextPath,
      segments: routeSegments.map((coordinates) => ({
        d: nextPath({ type: 'LineString', coordinates }),
      })),
      projectedPoints: nodes.map((node, index) => ({
        ...node,
        kind: index === 0 ? 'origin' : index === nodes.length - 1 ? 'destination' : 'hub',
        xy: projection([node.lon, node.lat]),
      })),
      currentPoint: projection([state.pos.lon, state.pos.lat]),
    }
  }, [canvasWidth, nodes, state.pos.lat, state.pos.lon])

  return (
    <div ref={containerRef} className="mappy-globe mappy-planisphere" role="img" aria-label={`Planisphère du trajet de ${msg.from.label} vers ${msg.to.label}`}>
      <svg viewBox={`0 0 ${canvasWidth} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <radialGradient id={`water-${svgId}`} cx="48%" cy="42%" r="72%">
            <stop offset="0" stopColor="var(--color-map-ocean-light)" />
            <stop offset="0.58" stopColor="var(--color-map-ocean-mid)" />
            <stop offset="1" stopColor="var(--color-map-ocean)" />
          </radialGradient>
          <clipPath id={`map-clip-${svgId}`}><rect width={canvasWidth} height={HEIGHT} rx="14" /></clipPath>
        </defs>
        <rect width={canvasWidth} height={HEIGHT} fill={`url(#water-${svgId})`} />
        <g clipPath={`url(#map-clip-${svgId})`}>
          <path d={path({ type: 'Sphere' }) ?? undefined} fill="none" stroke="var(--color-map-sphere)" strokeWidth="1" />
          <path d={path(geoGraticule10()) ?? undefined} fill="none" stroke="var(--color-map-grid)" strokeOpacity="0.16" strokeWidth="0.7" />
          {countries.map((country) => (
            <path
              key={country.properties?.ADM0_A3 || country.properties?.ADMIN}
              d={path(country) ?? undefined}
              fill={countryColor(country)}
              stroke="var(--color-map-border)"
              strokeWidth="0.75"
            />
          ))}
          <rect width={canvasWidth} height={HEIGHT} fill="var(--color-map-shade)" fillOpacity="var(--map-shade-opacity)" />
          {segments.map((segment, index) => segment.d && (
            <path
              key={index}
              d={segment.d}
              fill="none"
              stroke="var(--color-map-route)"
              strokeWidth="2.2"
              strokeDasharray="8 7"
              strokeLinecap="round"
            />
          ))}
          {projectedPoints.map((point) => point.xy && (
            <g key={`${point.kind}-${point.id || point.label}-${point.lat}`} transform={`translate(${point.xy[0]} ${point.xy[1]})`}>
              <circle r={point.kind === 'hub' ? 4 : 5.2} fill="var(--color-map-point)" stroke="var(--color-map-route)" strokeWidth="2" />
            </g>
          ))}
          {currentPoint && (
            <text
              x={currentPoint[0]}
              y={currentPoint[1]}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="var(--text-map-carrier)"
              className="mappy-current-emoji"
            >
              {msg.method === 'BIRD' ? '🐦' : '✉️'}
            </text>
          )}
        </g>
      </svg>
      {showDistance && (
        <div className="mappy-distance">
          {Math.round(distance).toLocaleString('fr-FR')} KM · {msg.method === 'BIRD' ? 'VOL DIRECT' : `${Math.max(nodes.length - 1, 1)} ÉTAPES`}
        </div>
      )}
    </div>
  )
}
