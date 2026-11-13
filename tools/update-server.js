// Serves app updates to your phone over home Wi-Fi.
// Only two files are reachable: /version.json and the APK it names. Nothing else on this computer is exposed.
// Run with: node tools/update-server.js   (stop with Ctrl+C)
"use strict";
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.PORT) || 8642;
const DIST = path.join(__dirname, "..", "dist");

// Real Wi-Fi/Ethernet addresses only: skip virtual adapters (WSL, Hyper-V, VirtualBox, VPNs).
function lanAddresses() {
  const virtual = /vethernet|wsl|hyper-v|virtualbox|vmware|vpn|tap|tun|loopback/i;
  return Object.entries(os.networkInterfaces())
    .filter(([name]) => !virtual.test(name))
    .flatMap(([, addrs]) => addrs || [])
    .filter((a) => a.family === "IPv4" && !a.internal)
    .map((a) => a.address)
    .filter((ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))
    .sort((a, b) => (b.startsWith("192.168.") ? 1 : 0) - (a.startsWith("192.168.") ? 1 : 0));
}

function isPrivate(remote) {
  const ip = String(remote || "").replace(/^::ffff:/, "");
  return ip === "127.0.0.1" || ip === "::1" || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

function readManifest() {
  try { return JSON.parse(fs.readFileSync(path.join(DIST, "version.json"), "utf8")); } catch { return null; }
}

const server = http.createServer((req, res) => {
  // Refuse anything that isn't from the local network.
  if (!isPrivate(req.socket.remoteAddress) || req.method !== "GET") {
    res.writeHead(403).end();
    return;
  }
  const manifest = readManifest();
  const url = decodeURI(req.url.split("?")[0]);
  const stamp = new Date().toLocaleTimeString();

  if (url === "/version.json" && manifest) {
    console.log(`${stamp}  phone checked for updates`);
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(manifest));
    return;
  }
  if (manifest && url === "/" + manifest.apk && /^[\w.-]+\.apk$/.test(manifest.apk)) {
    const file = path.join(DIST, manifest.apk);
    fs.stat(file, (err, st) => {
      if (err) { res.writeHead(404).end(); return; }
      console.log(`${stamp}  sending ${manifest.apk} (${(st.size / 1048576).toFixed(1)} MB)`);
      res.writeHead(200, { "Content-Type": "application/vnd.android.package-archive", "Content-Length": st.size });
      fs.createReadStream(file).pipe(res);
    });
    return;
  }
  res.writeHead(404).end();
});

server.listen(PORT, "0.0.0.0", () => {
  const m = readManifest();
  const ips = lanAddresses();
  console.log("\nR&M update server is running.");
  console.log(m ? `Serving version ${m.version}.` : "No build found yet. Run: bash build-apk.sh");
  if (ips.length) {
    console.log("\nOn your phone (same Wi-Fi), the update server address is:");
    console.log(`   http://${ips[0]}:${PORT}`);
  } else {
    console.log("\nCouldn't find a Wi-Fi address. Is this computer connected to Wi-Fi?");
  }
  console.log("\nLeave this window open while updating. Press Ctrl+C to stop.\n");
});
server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `Port ${PORT} is already in use. Is the server already running?` : e.message);
  process.exit(1);
});
