import { useEffect, useId, useMemo, useRef, useState } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";

const WIDTH = 800;
const HEIGHT = 450;
const countryPalette = ["#234449", "#284D4C", "#203F45", "#2B504E", "#24484A"];

const countriesPromise = fetch("/data/countries-110m.geojson").then((response) => {
  if (!response.ok) throw new Error("Natural Earth countries unavailable");
  return response.json();
});

function hashName(name) {
  let hash = 0;
  for (const character of name) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function countryColor(feature) {
  const name = feature.properties?.ADMIN || feature.properties?.NAME || "country";
  return countryPalette[hashName(name) % countryPalette.length];
}

function routeNodesFor(msg) {
  return msg.method === "POST" ? [msg.from, ...msg.plan.route, msg.to] : [msg.from, msg.to];
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export default function MappyPlanisphere({ msg, state, distance, interactive = false, expanded = false }) {
  const [countries, setCountries] = useState([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, k: 1 });
  const svgRef = useRef(null);
  const svgId = useId().replaceAll(":", "");
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const routeColor = "#F7FAFC";
  const nodes = useMemo(() => routeNodesFor(msg), [msg]);

  useEffect(() => {
    let active = true;
    countriesPromise
      .then((geojson) => active && setCountries(geojson.features))
      .catch((error) => console.warn("Mappy: planisphère indisponible", error));
    return () => { active = false; };
  }, []);

  useEffect(() => setViewport({ x: 0, y: 0, k: 1 }), [msg.id]);

  const { path, segments, projectedPoints, currentPoint } = useMemo(() => {
    const routeSegments = nodes.slice(0, -1).map((node, index) => [
      [node.lon, node.lat],
      [nodes[index + 1].lon, nodes[index + 1].lat],
    ]);
    const routeGeometry = {
      type: "Feature",
      geometry: { type: "MultiLineString", coordinates: routeSegments },
    };
    const nextProjection = geoNaturalEarth1().precision(0.25);
    nextProjection.fitExtent([[42, 38], [WIDTH - 42, HEIGHT - 38]], routeGeometry);
    nextProjection.clipExtent([[0, 0], [WIDTH, HEIGHT]]);
    const nextPath = geoPath(nextProjection);
    const segmentPaths = routeSegments.map((coordinates) => {
      return {
        coordinates,
        d: nextPath({ type: "LineString", coordinates }),
      };
    });
    return {
      path: nextPath,
      segments: segmentPaths,
      projectedPoints: nodes.map((node, index) => ({
        ...node,
        kind: index === 0 ? "origin" : index === nodes.length - 1 ? "destination" : "hub",
        xy: nextProjection([node.lon, node.lat]),
      })),
      currentPoint: nextProjection([state.pos.lon, state.pos.lat]),
    };
  }, [nodes, state.pos.lat, state.pos.lon]);

  const localPoint = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const onWheel = (event) => {
    if (!interactive) return;
    event.preventDefault();
    const point = localPoint(event);
    setViewport((current) => {
      const nextK = clamp(current.k * Math.exp(-event.deltaY * 0.0015), 1, 12);
      const ratio = nextK / current.k;
      return {
        k: nextK,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
      };
    });
  };

  const onPointerDown = (event) => {
    if (!interactive) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, localPoint(event));
    const values = [...pointersRef.current.values()];
    if (values.length === 1) gestureRef.current = { type: "pan", start: values[0], viewport };
    if (values.length === 2) {
      const [first, second] = values;
      gestureRef.current = {
        type: "pinch",
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
        viewport,
      };
    }
  };

  const onPointerMove = (event) => {
    if (!interactive || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, localPoint(event));
    const values = [...pointersRef.current.values()];
    const gesture = gestureRef.current;
    if (values.length === 1 && gesture?.type === "pan") {
      setViewport({
        ...gesture.viewport,
        x: gesture.viewport.x + values[0].x - gesture.start.x,
        y: gesture.viewport.y + values[0].y - gesture.start.y,
      });
    } else if (values.length === 2 && gesture?.type === "pinch") {
      const [first, second] = values;
      const distanceNow = Math.hypot(second.x - first.x, second.y - first.y);
      const midpointNow = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const nextK = clamp(gesture.viewport.k * distanceNow / Math.max(gesture.distance, 1), 1, 12);
      const ratio = nextK / gesture.viewport.k;
      setViewport({
        k: nextK,
        x: midpointNow.x - (gesture.midpoint.x - gesture.viewport.x) * ratio,
        y: midpointNow.y - (gesture.midpoint.y - gesture.viewport.y) * ratio,
      });
    }
  };

  const onPointerEnd = (event) => {
    pointersRef.current.delete(event.pointerId);
    const remaining = [...pointersRef.current.values()];
    gestureRef.current = remaining.length === 1
      ? { type: "pan", start: remaining[0], viewport }
      : null;
  };

  return (
    <div className={`mappy-globe mappy-planisphere${interactive ? " mappy-globe--interactive" : ""}${expanded ? " mappy-globe--expanded" : ""}`}
      role={interactive ? "application" : "img"}
      aria-label={`Planisphère du trajet de ${msg.from.label} vers ${msg.to.label}`}>
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={() => interactive && setViewport({ x: 0, y: 0, k: 1 })}>
        <defs>
          <radialGradient id={`water-${svgId}`} cx="48%" cy="42%" r="72%">
            <stop offset="0" stopColor="#0A314A" />
            <stop offset="0.58" stopColor="#072A43" />
            <stop offset="1" stopColor="#061F35" />
          </radialGradient>
          <clipPath id={`map-clip-${svgId}`}><rect width={WIDTH} height={HEIGHT} rx="14" /></clipPath>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill={`url(#water-${svgId})`} />
        <g clipPath={`url(#map-clip-${svgId})`} transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.k})`}>
          <path d={path({ type: "Sphere" })} fill="none" stroke="#456477" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={path(geoGraticule10())} fill="none" stroke="#6B84A0" strokeOpacity="0.16" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          {countries.map((country) => (
            <path key={country.properties?.ADM0_A3 || country.properties?.ADMIN}
              d={path(country)} fill={countryColor(country)} stroke="#7890A8" strokeWidth="0.75"
              vectorEffect="non-scaling-stroke" />
          ))}
          <rect width={WIDTH} height={HEIGHT} fill="#020914" fillOpacity="0.34" />
          {segments.map((segment, index) => {
            const d = segment.d;
            if (!d) return null;
            return (
              <g key={index}>
                <path d={d} fill="none" stroke={routeColor} strokeWidth="2.2" strokeDasharray="8 7"
                  strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
          {projectedPoints.map((point) => point.xy && (
            <g key={`${point.kind}-${point.id || point.label}-${point.lat}`} transform={`translate(${point.xy[0]} ${point.xy[1]})`}>
              <circle r={point.kind === "hub" ? 4 : 5.2} fill="#08283F" stroke={routeColor}
                strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {currentPoint && (
            <text x={currentPoint[0]} y={currentPoint[1]} textAnchor="middle" dominantBaseline="central"
              fontSize="21" vectorEffect="non-scaling-stroke" className="mappy-current-emoji">
              {msg.method === "BIRD" ? "🐦" : "✉️"}
            </text>
          )}
        </g>
      </svg>
      <div className="mappy-distance">
        {Math.round(distance).toLocaleString("fr-FR")} KM · {msg.method === "BIRD" ? "VOL DIRECT" : `${Math.max(nodes.length - 1, 1)} ÉTAPES`}
      </div>
    </div>
  );
}
