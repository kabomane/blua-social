import {
  THREE,
  OrbitControls,
  ThreeGlobe
} from "./mapbox-assets/mapbox-vendor.js";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const EARTH_RADIUS = 5;

// Globe légèrement plus grand pour les marqueurs / frontières
const SURFACE_OFFSET = 0.04;


/* =========================================================
   SCÈNE
   ========================================================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02050a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 4, 12);


/* =========================================================
   RENDERER
   ========================================================= */

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

document
  .getElementById("app")
  .appendChild(renderer.domElement);


/* =========================================================
   CONTRÔLES
   ========================================================= */

const controls = new OrbitControls(
  camera,
  renderer.domElement
);

controls.enableDamping = true;

controls.enablePan = false;

controls.minDistance = 6;
controls.maxDistance = 25;


/* =========================================================
   LUMIÈRES
   ========================================================= */

const ambientLight = new THREE.AmbientLight(
  0xc7dded,
  0.9
);

scene.add(ambientLight);


const directionalLight = new THREE.DirectionalLight(
  0xffffff,
  0.55
);

directionalLight.position.set(5, 3, 5);

scene.add(directionalLight);


/* =========================================================
   TERRE
   ========================================================= */

const earthGeometry = new THREE.SphereGeometry(
  EARTH_RADIUS,
  144,
  96
);

const earthMaterial = new THREE.ShaderMaterial({

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
          mix(hash(cell + vec3(0.0, 0.0, 0.0)), hash(cell + vec3(1.0, 0.0, 0.0)), local.x),
          mix(hash(cell + vec3(0.0, 1.0, 0.0)), hash(cell + vec3(1.0, 1.0, 0.0)), local.x),
          local.y
        ),
        mix(
          mix(hash(cell + vec3(0.0, 0.0, 1.0)), hash(cell + vec3(1.0, 0.0, 1.0)), local.x),
          mix(hash(cell + vec3(0.0, 1.0, 1.0)), hash(cell + vec3(1.0, 1.0, 1.0)), local.x),
          local.y
        ),
        local.z
      );
    }

    void main() {
      float broadVariation = noise(vSpherePosition * 3.4);
      float fineVariation = noise(vSpherePosition * 8.0 + 4.7);
      float variation = smoothstep(
        0.18,
        0.82,
        broadVariation * 0.72 + fineVariation * 0.28
      );

      vec3 deepBlue = vec3(0.030, 0.165, 0.250);
      vec3 mediumBlue = vec3(0.035, 0.185, 0.275);
      vec3 lightBlue = vec3(0.045, 0.205, 0.295);
      vec3 waterColor = mix(
        deepBlue,
        mediumBlue,
        0.25 + variation * 0.35
      );
      waterColor = mix(
        waterColor,
        lightBlue,
        variation * variation * 0.08
      );

      gl_FragColor = vec4(waterColor, 1.0);
    }
  `,

  toneMapped: false

});

const earth = new THREE.Mesh(
  earthGeometry,
  earthMaterial
);

scene.add(earth);


/* =========================================================
   PAYS VECTORIELS

   Les pays ne sont plus peints dans une texture bitmap :
   ce sont de vrais polygones 3D qui restent nets au zoom.
   ========================================================= */

const statusElement = document.getElementById("status");
let mapState = "carte en cours";
let gpsState = "GPS en attente";

function refreshStatus() {
  statusElement.textContent = `${mapState} · ${gpsState}`;
}

refreshStatus();

const landPalette = [
  "#24484a",
  "#284d4c",
  "#203f45",
  "#2b504e",
  "#234449"
];

function countryColor(feature) {

  const name =
    feature.properties?.ADMIN ||
    feature.properties?.NAME ||
    "country";

  let hash = 0;

  for (const character of name) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }

  return landPalette[Math.abs(hash) % landPalette.length];

}

const vectorGlobe = new ThreeGlobe({
  waitForGlobeReady: false,
  animateIn: false
})
  .showGlobe(false)
  .showAtmosphere(false)
  .polygonAltitude(0.0015)
  .polygonCapColor(countryColor)
  .polygonSideColor(countryColor)
  .polygonStrokeColor(() => "#6f8f96")
  .polygonCapCurvatureResolution(0.35)
  .polygonsTransitionDuration(0);

vectorGlobe.scale.setScalar(EARTH_RADIUS / 100);
vectorGlobe.rotation.y = Math.PI / 2;
scene.add(vectorGlobe);



/* =========================================================
   CONVERSION GPS -> POSITION 3D

   C'est la partie importante.

   Entrée :
       latitude
       longitude

   Sortie :
       THREE.Vector3(x, y, z)

   La précision du GPS ne dépend pas
   du niveau de détail graphique de la Terre.
   ========================================================= */

function gpsToVector3(
  latitude,
  longitude,
  radius = EARTH_RADIUS
) {

  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);

  const x =
    radius *
    Math.cos(lat) *
    Math.cos(lon);

  const y =
    radius *
    Math.sin(lat);

  const z =
    -radius *
    Math.cos(lat) *
    Math.sin(lon);

  return new THREE.Vector3(x, y, z);
}


/* =========================================================
   AJOUTER UN POINT GPS
   ========================================================= */

function addGpsMarker({

  latitude,
  longitude,

  color = 0xff3b30,

  size = 0.08,

  name = ""

}) {

  const position = gpsToVector3(
    latitude,
    longitude,
    EARTH_RADIUS + 0.06
  );


  const geometry = new THREE.SphereGeometry(
    size,
    16,
    16
  );


  const material = new THREE.MeshBasicMaterial({
    color
  });


  const marker = new THREE.Mesh(
    geometry,
    material
  );


  marker.position.copy(position);


  marker.userData = {

    name,

    latitude,

    longitude

  };


  scene.add(marker);


  return marker;
}


/* =========================================================
   EXEMPLES GPS
   ========================================================= */

// Paris
addGpsMarker({

  name: "Paris",

  latitude: 48.8566,

  longitude: 2.3522,

  color: 0xff3b30

});


// Marseille
addGpsMarker({

  name: "Marseille",

  latitude: 43.2965,

  longitude: 5.3698,

  color: 0x00ff88

});


// New York
addGpsMarker({

  name: "New York",

  latitude: 40.7128,

  longitude: -74.006,

  color: 0x00aaff

});


// Tokyo
addGpsMarker({

  name: "Tokyo",

  latitude: 35.6762,

  longitude: 139.6503,

  color: 0xffcc00

});


/* =========================================================
   CENTRAGE AUTOMATIQUE SUR LA POSITION DE L'UTILISATEUR
   ========================================================= */

let userMarker = null;

function centerOnCoordinates(latitude, longitude) {

  const cameraDistance = camera.position.length();

  camera.position.copy(
    gpsToVector3(latitude, longitude, cameraDistance)
  );

  controls.target.set(0, 0, 0);
  controls.update();

}

function locateUser() {

  if (window.location.protocol === "file:") {
    gpsState = "GPS : ouvrir via localhost";
    refreshStatus();
    return;
  }

  if (!window.isSecureContext) {
    gpsState = "GPS : connexion sécurisée requise";
    refreshStatus();
    return;
  }

  if (!("geolocation" in navigator)) {
    gpsState = "GPS non disponible";
    refreshStatus();
    return;
  }

  navigator.geolocation.getCurrentPosition(

    (position) => {

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      centerOnCoordinates(latitude, longitude);

      if (!userMarker) {

        userMarker = addGpsMarker({
          name: "Votre position",
          latitude,
          longitude,
          color: 0xff4fd8,
          size: 0.1
        });

      }

      else {
        userMarker.position.copy(
          gpsToVector3(latitude, longitude, EARTH_RADIUS + 0.06)
        );
      }

      gpsState = `centré sur votre position (±${Math.round(position.coords.accuracy)} m)`;
      refreshStatus();

    },

    (error) => {

      gpsState = error.code === error.PERMISSION_DENIED
        ? "autorisation GPS refusée"
        : "position GPS indisponible";

      refreshStatus();

    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }

  );

}

locateUser();


/* =========================================================
   AJOUTER UN POINT GPS DYNAMIQUEMENT

   Exemple :

   addGpsMarker({
       latitude: position.latitude,
       longitude: position.longitude
   });

   ========================================================= */


/* =========================================================
   GRILLE LATITUDE / LONGITUDE
   FACULTATIVE
   ========================================================= */

function createLatitudeLine(latitude) {

  const points = [];

  for (
    let longitude = -180;
    longitude <= 180;
    longitude += 2
  ) {

    points.push(
      gpsToVector3(
        latitude,
        longitude,
        EARTH_RADIUS + 0.005
      )
    );

  }


  const geometry =
    new THREE.BufferGeometry()
      .setFromPoints(points);


  const material =
    new THREE.LineBasicMaterial({

      color: 0x30455a,

      transparent: true,

      opacity: 0.3

    });


  return new THREE.Line(
    geometry,
    material
  );

}


function createLongitudeLine(longitude) {

  const points = [];

  for (
    let latitude = -90;
    latitude <= 90;
    latitude += 2
  ) {

    points.push(
      gpsToVector3(
        latitude,
        longitude,
        EARTH_RADIUS + 0.005
      )
    );

  }


  const geometry =
    new THREE.BufferGeometry()
      .setFromPoints(points);


  const material =
    new THREE.LineBasicMaterial({

      color: 0x30455a,

      transparent: true,

      opacity: 0.3

    });


  return new THREE.Line(
    geometry,
    material
  );

}


// Latitudes tous les 30°
for (
  let lat = -60;
  lat <= 60;
  lat += 30
) {

  scene.add(
    createLatitudeLine(lat)
  );

}


// Longitudes tous les 30°
for (
  let lon = -180;
  lon < 180;
  lon += 30
) {

  scene.add(
    createLongitudeLine(lon)
  );

}


/* =========================================================
   GEOJSON
   ---------------------------------------------------------

   Facultatif.

   Mets par exemple :

       /data/countries.geojson

   Le fichier doit contenir des Polygon / MultiPolygon
   standards GeoJSON.

   Les coordonnées GeoJSON sont :

       [longitude, latitude]

   ========================================================= */


const countryMaterial =
  new THREE.LineBasicMaterial({

    color: 0xe8f4ff,

    transparent: true,

    opacity: 0.72,

    depthWrite: false

  });



/* =========================================================
   CRÉATION D'UNE LIGNE SUR LE GLOBE
   ========================================================= */

function createGeoLine(coordinates) {

  const groups = [];

  let currentGroup = [];

  let previousLongitude = null;


  for (const coordinate of coordinates) {

    const longitude = coordinate[0];

    const latitude = coordinate[1];


    /*
      On évite qu'une frontière traversant
      l'antiméridien (+180 / -180)
      fasse une grande ligne à travers le globe.
    */

    if (

      previousLongitude !== null &&

      Math.abs(
        longitude - previousLongitude
      ) > 180

    ) {

      if (currentGroup.length > 1) {

        groups.push(currentGroup);

      }

      currentGroup = [];

    }


    currentGroup.push(

      gpsToVector3(

        latitude,

        longitude,

        EARTH_RADIUS + SURFACE_OFFSET

      )

    );


    previousLongitude = longitude;

  }


  if (currentGroup.length > 1) {

    groups.push(currentGroup);

  }


  for (const points of groups) {

    const geometry =
      new THREE.BufferGeometry()
        .setFromPoints(points);


    const line = new THREE.Line(
      geometry,
      countryMaterial
    );


    scene.add(line);

  }

}


/* =========================================================
   POLYGON GEOJSON
   ========================================================= */

function drawPolygon(polygon) {

  /*
    polygon est :

    [
        outerRing,
        hole1,
        hole2...
    ]

    Pour une carte simplifiée,
    on affiche simplement chaque anneau.
  */

  for (const ring of polygon) {

    createGeoLine(ring);

  }

}


/* =========================================================
   FEATURE GEOJSON
   ========================================================= */

function drawFeature(feature) {

  if (!feature.geometry) {
    return;
  }


  const geometry = feature.geometry;


  if (geometry.type === "Polygon") {

    drawPolygon(
      geometry.coordinates
    );

  }


  else if (
    geometry.type === "MultiPolygon"
  ) {

    for (
      const polygon
      of geometry.coordinates
    ) {

      drawPolygon(polygon);

    }

  }

}


/* =========================================================
   CHARGEMENT GEOJSON
   ========================================================= */

async function loadCountries() {

  try {

    const response = await fetch(
      "./mapbox-data/countries.geojson"
    );


    if (!response.ok) {

      console.warn(
        "Le jeu de frontières Natural Earth est indisponible."
      );

      mapState = "carte indisponible";
      refreshStatus();

      return;

    }


    const geojson =
      await response.json();


    vectorGlobe.polygonsData(geojson.features);


    console.log(
      "Pays chargés :",
      geojson.features.length
    );

    mapState = "pays vectoriels 1:50m";
    refreshStatus();

  }

  catch (error) {

    console.warn(
      "Impossible de charger les frontières Natural Earth.",
      error
    );

    mapState = "carte indisponible";
    refreshStatus();

  }

}



loadCountries();


/* =========================================================
   EXEMPLE : POSITION GPS DU NAVIGATEUR
   ========================================================= */

/*

if ("geolocation" in navigator) {

  navigator.geolocation.watchPosition(

    (position) => {

      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;


      console.log(
        "GPS :",
        latitude,
        longitude
      );


      addGpsMarker({

        name: "Utilisateur",

        latitude,

        longitude,

        color: 0xff00ff

      });

    },

    (error) => {

      console.error(
        "Erreur GPS :",
        error
      );

    },

    {

      enableHighAccuracy: true

    }

  );

}

*/


/* =========================================================
   REDIMENSIONNEMENT
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    camera.aspect =
      window.innerWidth /
      window.innerHeight;


    camera.updateProjectionMatrix();


    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

  }
);


/* =========================================================
   BOUCLE D'ANIMATION
   ========================================================= */

function animate() {

  requestAnimationFrame(animate);

  controls.update();

  renderer.render(
    scene,
    camera
  );

}


animate();
