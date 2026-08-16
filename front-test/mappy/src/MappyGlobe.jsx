import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const POST_BLUE = "#38A7FF";
const BIRD_RED = "#FF493D";

const countryPalette = ["#234449", "#284D4C", "#203F45", "#2B504E", "#24484A"];

const countriesPromise = fetch("/data/countries-110m.geojson").then((response) => {
    if (!response.ok) throw new Error("Natural Earth countries unavailable");
    return response.json();
  });

function loadCountries() {
  return countriesPromise;
}

function hashName(name) {
  let hash = 0;
  for (const character of name) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function countryColor(feature) {
  const name = feature.properties?.ADMIN || feature.properties?.NAME || "country";
  return countryPalette[hashName(name) % countryPalette.length];
}

function latLonVector({ lat, lon }) {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
    Math.cos(latitude) * Math.cos(longitude),
  );
}

function cameraForRoute(camera, nodes) {
  const vectors = [];
  const seen = new Set();

  for (const node of nodes) {
    const key = `${node.lat.toFixed(5)}:${node.lon.toFixed(5)}`;
    if (!seen.has(key)) {
      seen.add(key);
      vectors.push(latLonVector(node));
    }
  }

  const candidates = [...vectors];
  const average = vectors.reduce((sum, point) => sum.add(point), new THREE.Vector3());
  if (average.lengthSq() > 0.001) candidates.push(average.normalize());

  for (let first = 0; first < vectors.length; first += 1) {
    for (let second = first + 1; second < vectors.length; second += 1) {
      const midpoint = vectors[first].clone().add(vectors[second]);
      if (midpoint.lengthSq() > 0.001) candidates.push(midpoint.normalize());
    }
  }

  let focus = candidates[0].clone();
  let smallestCap = Infinity;

  for (const candidate of candidates) {
    const cap = vectors.reduce(
      (largest, point) => Math.max(largest, Math.acos(THREE.MathUtils.clamp(candidate.dot(point), -1, 1))),
      0,
    );
    if (cap < smallestCap) {
      smallestCap = cap;
      focus = candidate.clone();
    }
  }

  const maxAngle = vectors.reduce(
    (largest, point) => Math.max(largest, Math.acos(THREE.MathUtils.clamp(focus.dot(point), -1, 1))),
    0,
  );

  const paddedAngle = Math.min(maxAngle * 1.3 + THREE.MathUtils.degToRad(1.15), Math.PI * 0.92);
  const usableHalfFov = THREE.MathUtils.degToRad(camera.fov * 0.5 * 0.72);
  const globeRadius = 100;
  const distance = THREE.MathUtils.clamp(
    globeRadius * Math.cos(paddedAngle)
      + (globeRadius * Math.sin(paddedAngle)) / Math.tan(usableHalfFov),
    114,
    465,
  );
  const north = new THREE.Vector3(0, 1, 0);
  const up = north.clone().sub(focus.clone().multiplyScalar(north.dot(focus)));
  if (up.lengthSq() < 0.01) up.set(0, 0, 1);

  camera.position.copy(focus.multiplyScalar(distance));
  camera.up.copy(up.normalize());
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  return {
    distance,
    visualScale: THREE.MathUtils.clamp(
      Math.sqrt(Math.max(distance - globeRadius, 1) / 340),
      0.28,
      1,
    ),
  };
}

function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vSpherePosition;
      void main() {
        vSpherePosition = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vSpherePosition;

      float hash(vec3 point) {
        point = fract(point * 0.3183099 + 0.1);
        point *= 17.0;
        return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
      }

      float noise(vec3 point) {
        vec3 cell = floor(point);
        vec3 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(
          mix(
            mix(hash(cell + vec3(0.0)), hash(cell + vec3(1.0, 0.0, 0.0)), local.x),
            mix(hash(cell + vec3(0.0, 1.0, 0.0)), hash(cell + vec3(1.0, 1.0, 0.0)), local.x),
            local.y
          ),
          mix(
            mix(hash(cell + vec3(0.0, 0.0, 1.0)), hash(cell + vec3(1.0, 0.0, 1.0)), local.x),
            mix(hash(cell + vec3(0.0, 1.0, 1.0)), hash(cell + vec3(1.0)), local.x),
            local.y
          ),
          local.z
        );
      }

      void main() {
        float broad = noise(vSpherePosition * 3.4);
        float fine = noise(vSpherePosition * 8.0 + 4.7);
        float variation = smoothstep(0.18, 0.82, broad * 0.72 + fine * 0.28);
        vec3 deepBlue = vec3(0.030, 0.165, 0.250);
        vec3 mediumBlue = vec3(0.035, 0.185, 0.275);
        vec3 lightBlue = vec3(0.045, 0.205, 0.295);
        vec3 water = mix(deepBlue, mediumBlue, 0.25 + variation * 0.35);
        water = mix(water, lightBlue, variation * variation * 0.08);
        gl_FragColor = vec4(water, 1.0);
      }
    `,
    toneMapped: false,
  });
}

function routeNodesFor(msg) {
  return msg.method === "POST"
    ? [msg.from, ...msg.plan.route, msg.to]
    : [msg.from, msg.to];
}

function pointOnGreatCircle(start, end, angle, progress) {
  if (angle < 0.00001) return start.clone();
  const divisor = Math.sin(angle);
  return start.clone()
    .multiplyScalar(Math.sin((1 - progress) * angle) / divisor)
    .add(end.clone().multiplyScalar(Math.sin(progress * angle) / divisor))
    .normalize();
}

function createRouteLayer(nodes, color, visualScale) {
  const group = new THREE.Group();
  const coreMaterial = new THREE.MeshBasicMaterial({
    color,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });

  nodes.slice(0, -1).forEach((node, index) => {
    const start = latLonVector(node);
    const end = latLonVector(nodes[index + 1]);
    const angle = start.angleTo(end);
    if (angle < 0.00001) return;

    const arcHeight = THREE.MathUtils.clamp(0.025 + angle * 0.095, 0.028, 0.22);
    const dashCount = THREE.MathUtils.clamp(
      Math.ceil(angle / THREE.MathUtils.degToRad(7)),
      4,
      20,
    );

    for (let dash = 0; dash < dashCount; dash += 1) {
      const from = dash / dashCount;
      const to = Math.min(from + 0.66 / dashCount, 1);
      const points = [];

      for (let sample = 0; sample <= 6; sample += 1) {
        const progress = THREE.MathUtils.lerp(from, to, sample / 6);
        const radius = 100.38 + 100 * arcHeight * Math.sin(Math.PI * progress);
        points.push(pointOnGreatCircle(start, end, angle, progress).multiplyScalar(radius));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const glowGeometry = new THREE.TubeGeometry(curve, 8, 0.72 * visualScale, 6, false);
      const coreGeometry = new THREE.TubeGeometry(curve, 8, 0.3 * visualScale, 6, false);
      group.add(new THREE.Mesh(glowGeometry, glowMaterial));
      group.add(new THREE.Mesh(coreGeometry, coreMaterial));
    }
  });

  group.userData.materials = [coreMaterial, glowMaterial];
  return group;
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(48, 48, 2, 48, 48, 48);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,.85)");
  gradient.addColorStop(0.42, "rgba(255,255,255,.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEmojiTexture(emoji) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 128, 128);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '76px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  context.fillText(emoji, 64, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMarkerLayer(points, current, method, color, visualScale) {
  const group = new THREE.Group();
  const glowTexture = createGlowTexture();
  const emojiTexture = createEmojiTexture(method === "BIRD" ? "🐦" : "✉️");
  const materials = [];

  points.forEach((point, index) => {
    const direction = latLonVector(point);
    const altitude = 100.75 + 1.15 * visualScale;
    const position = direction.clone().multiplyScalar(altitude);
    const radius = (point.kind === "hub" ? 0.31 : 0.43) * visualScale;

    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.copy(position);
    const glowSize = (point.kind === "hub" ? 2.2 : 2.75) * visualScale;
    glow.scale.setScalar(glowSize);
    group.add(glow);
    materials.push(glowMaterial);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: point.kind === "hub" ? 0.82 : 1,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.72, radius, 32),
      ringMaterial,
    );
    ring.position.copy(position);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    group.add(ring);
    materials.push(ringMaterial);
  });

  const currentDirection = latLonVector(current);
  const currentPosition = currentDirection.clone().multiplyScalar(102 + 1.3 * visualScale);
  const emojiMaterial = new THREE.SpriteMaterial({
    map: emojiTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const emoji = new THREE.Sprite(emojiMaterial);
  const emojiSize = 4.15 * visualScale;
  emoji.position.copy(currentPosition);
  emoji.scale.setScalar(emojiSize);
  emoji.userData.pulse = { base: emojiSize, offset: 0, strength: 0.035 };
  group.add(emoji);
  materials.push(emojiMaterial);

  const currentRingMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const currentRing = new THREE.Mesh(
    new THREE.RingGeometry(0.62 * visualScale, 0.75 * visualScale, 32),
    currentRingMaterial,
  );
  currentRing.position.copy(currentDirection.clone().multiplyScalar(101.8 + visualScale));
  currentRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), currentDirection);
  currentRing.userData.pulseRing = { offset: 0, material: currentRingMaterial };
  group.add(currentRing);
  materials.push(currentRingMaterial);

  group.userData.materials = materials;
  group.userData.glowTexture = glowTexture;
  group.userData.emojiTexture = emojiTexture;
  return group;
}

function disposeLayer(group) {
  if (!group) return;
  group.traverse((object) => object.geometry?.dispose?.());
  group.userData.materials?.forEach((material) => material.dispose());
  group.userData.glowTexture?.dispose();
  group.userData.emojiTexture?.dispose();
}

export default function MappyGlobe({ msg, state, distance, interactive = false, expanded = false }) {
  const hostRef = useRef(null);
  const globeRef = useRef(null);
  const sceneRef = useRef(null);
  const markerLayerRef = useRef(null);
  const visualScaleRef = useRef(1);
  const routeColor = msg.method === "BIRD" ? BIRD_RED : POST_BLUE;
  const staticRoute = useMemo(() => routeNodesFor(msg), [msg]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let disposed = false;
    let animationFrame;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color("#101734");

    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 1400);
    const { visualScale } = cameraForRoute(camera, staticRoute);
    visualScaleRef.current = visualScale;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.pointerEvents = interactive ? "auto" : "none";
    host.prepend(renderer.domElement);

    const controls = interactive ? new OrbitControls(camera, renderer.domElement) : null;
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.enablePan = false;
      controls.minDistance = 108;
      controls.maxDistance = 620;
      controls.rotateSpeed = 0.55;
      controls.zoomSpeed = 0.75;
      const lockedPolarAngle = controls.getPolarAngle();
      controls.minPolarAngle = lockedPolarAngle;
      controls.maxPolarAngle = lockedPolarAngle;
    }

    const ambient = new THREE.AmbientLight(0xc9d7e8, 0.9);
    const directional = new THREE.DirectionalLight(0xffffff, 0.55);
    directional.position.set(170, 120, 220);
    scene.add(ambient, directional);

    const waterMaterial = createWaterMaterial();
    const globe = new ThreeGlobe({ waitForGlobeReady: false, animateIn: false })
      .globeMaterial(waterMaterial)
      .showAtmosphere(false)
      .showGraticules(true)
      .globeCurvatureResolution(4)
      .polygonsTransitionDuration(0)
      .polygonAltitude(0.0015)
      .polygonCapColor(countryColor)
      .polygonSideColor(countryColor)
      .polygonStrokeColor(() => "#7087A5")
      .polygonCapCurvatureResolution(1.15)
      .pointsTransitionDuration(0);

    globeRef.current = globe;
    const routeLayer = createRouteLayer(staticRoute, routeColor, visualScale);
    scene.add(globe);
    scene.add(routeLayer);

    loadCountries()
      .then((geojson) => {
        if (!disposed) globe.polygonsData(geojson.features);
      })
      .catch((error) => console.warn("Mappy: données pays indisponibles", error));

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const render = () => {
      const time = performance.now() * 0.0022;
      markerLayerRef.current?.traverse((object) => {
        if (object.userData.pulse) {
          const { base, offset, strength } = object.userData.pulse;
          object.scale.setScalar(base * (1 + Math.sin(time + offset) * strength));
        }
        if (object.userData.pulseRing) {
          const { offset, material } = object.userData.pulseRing;
          const phase = (time * 0.42 + offset) % 1;
          object.scale.setScalar(0.82 + phase * 0.78);
          material.opacity = (1 - phase) * 0.62;
        }
      });
      controls?.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      globeRef.current = null;
      sceneRef.current = null;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      controls?.dispose();
      scene.remove(globe);
      scene.remove(routeLayer);
      if (markerLayerRef.current) scene.remove(markerLayerRef.current);
      globe.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
      disposeLayer(routeLayer);
      disposeLayer(markerLayerRef.current);
      markerLayerRef.current = null;
      waterMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [interactive, msg.id, routeColor, staticRoute]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const visualScale = visualScaleRef.current;

    const hubs = msg.method === "POST" ? msg.plan.route : [];
    const points = [
      { ...msg.from, kind: "origin" },
      ...hubs.map((hub) => ({ ...hub, kind: "hub" })),
      { ...msg.to, kind: "destination" },
    ];

    if (markerLayerRef.current) {
      scene.remove(markerLayerRef.current);
      disposeLayer(markerLayerRef.current);
    }
    markerLayerRef.current = createMarkerLayer(
      points,
      state.done ? msg.to : state.pos,
      msg.method,
      routeColor,
      visualScale,
    );
    scene.add(markerLayerRef.current);
  }, [msg, routeColor, state]);

  return (
    <div
      ref={hostRef}
      className={`mappy-globe${interactive ? " mappy-globe--interactive" : ""}${expanded ? " mappy-globe--expanded" : ""}`}
      role={interactive ? "application" : "img"}
      aria-label={`Trajet de ${msg.from.label} vers ${msg.to.label}, ${Math.round(distance).toLocaleString("fr-FR")} kilomètres`}
    >
      <div className="mappy-distance">
        {Math.round(distance).toLocaleString("fr-FR")} KM · {msg.method === "BIRD" ? "VOL DIRECT" : `${Math.max(staticRoute.length - 1, 1)} ÉTAPES`}
      </div>
    </div>
  );
}
