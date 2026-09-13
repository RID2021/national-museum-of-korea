const fs = require("node:fs");
const path = require("node:path");
const archiver = require("archiver");

const root = path.resolve(__dirname, "..");
const resources = path.join(root, "res");
for (const filename of ["main.js", "html/museum-npc-widget-v1.html"]) {
  if (!fs.existsSync(path.join(resources, filename))) throw new Error(`Build first: missing ${filename}`);
}
const output = fs.createWriteStream(path.join(root, "national-museum-of-korea.zepapp.zip"));
const archive = archiver("zip", { zlib: { level: 9 } });
archive.on("error", error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
output.on("error", error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
output.on("close", () => process.stdout.write(`Museum archive: ${archive.pointer()} bytes.\n`));
archive.pipe(output);

function appendDirectory(relative = "") {
  for (const entry of fs.readdirSync(path.join(resources, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      appendDirectory(name);
    } else if (entry.isFile()) {
      if (name === "html/museum-npc-widget.template.html") continue;
      // These source PNGs are already embedded, byte-for-byte, in the generated
      // widget. Do not package a second copy and exceed ZEP's upload limit.
      if (/^images\/npc\/national-museum\/night-guard\/[^/]+-portrait-v1\.png$/.test(name)) continue;
      archive.file(path.join(resources, name), { name });
    }
  }
}
appendDirectory();
archive.finalize();
