const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = 8765;
const mapPath = path.join(__dirname, "mapbox.html");
const files = new Map([
  ["/", {
    filePath: mapPath,
    contentType: "text/html; charset=utf-8"
  }],
  ["/mapbox.html", {
    filePath: mapPath,
    contentType: "text/html; charset=utf-8"
  }],
  ["/mapbox-assets/mapbox-vendor.js", {
    filePath: path.join(__dirname, "mapbox-assets", "mapbox-vendor.js"),
    contentType: "text/javascript; charset=utf-8"
  }],
  ["/mapbox-app.js", {
    filePath: path.join(__dirname, "mapbox-app.js"),
    contentType: "text/javascript; charset=utf-8"
  }],
  ["/mapbox-data/countries.geojson", {
    filePath: path.join(__dirname, "mapbox-data", "countries.geojson"),
    contentType: "application/geo+json; charset=utf-8"
  }]
]);

let idleTimer;

function resetIdleTimer(server) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => server.close(), 15 * 60 * 1000);
}

const server = http.createServer((request, response) => {
  resetIdleTimer(server);

  const requestedPath = new URL(request.url, `http://${host}`).pathname;
  const file = files.get(requestedPath);

  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  fs.readFile(file.filePath, (error, content) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Impossible de lire la ressource locale");
      return;
    }

    response.writeHead(200, {
      "Content-Type": file.contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(content);
  });
});

server.on("error", (error) => {
  if (error.code !== "EADDRINUSE") {
    console.error(error);
  }
});

server.listen(port, host, () => resetIdleTimer(server));
