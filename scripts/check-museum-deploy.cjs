const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "zep-script.json"), "utf8"));
const target = JSON.parse(fs.readFileSync(path.join(root, "zep-space.json"), "utf8"));
if (config.appId !== "53Xe2L" || target.appId !== config.appId ||
    target.spaceHashId !== "nLP9zE" || target.entryMapHashId !== "R57laZ") {
  throw new Error("Museum deployment target does not match the confirmed app and space.");
}
// The bundled CLI publishes the first archive in the directory. Never allow
// a stale/second archive to be selected silently.
const archives = fs.readdirSync(root).filter(name => name.endsWith(".zepapp.zip"));
if (archives.length !== 1 || archives[0] !== "national-museum-of-korea.zepapp.zip") {
  throw new Error("Expected exactly one national-museum-of-korea.zepapp.zip archive.");
}
const bytes = fs.statSync(path.join(root, archives[0])).size;
if (bytes <= 0 || bytes > 16 * 1024 * 1024) {
  throw new Error("Museum archive is empty or exceeds the ZEP 16 MiB upload limit.");
}
process.stdout.write(`Verified museum app ${config.appId}: ${(bytes / 1024 / 1024).toFixed(2)} MiB archive.\n`);
