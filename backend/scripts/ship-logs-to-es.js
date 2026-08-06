const fs = require("fs");
const path = require("path");
const http = require("http");

const LOG_FILE = path.join(__dirname, "..", "logs", "app.log");
const OFFSET_FILE = path.join(__dirname, "..", "logs", ".ship-offset");
const ES_URL = process.env.ES_URL || "http://localhost:9200";
const INDEX = process.env.ES_INDEX || "habit-tracker-logs";
const POLL_MS = 2000;

function readOffset() {
  try {
    return parseInt(fs.readFileSync(OFFSET_FILE, "utf8"), 10) || 0;
  } catch {
    return 0;
  }
}

function writeOffset(n) {
  fs.writeFileSync(OFFSET_FILE, String(n));
}

function bulkIndex(lines) {
  return new Promise((resolve, reject) => {
    const body =
      lines
        .flatMap((line) => {
          let doc;
          try {
            doc = JSON.parse(line);
          } catch {
            return [];
          }
          doc["@timestamp"] = doc.time || new Date().toISOString();
          return [JSON.stringify({ index: { _index: INDEX } }), JSON.stringify(doc)];
        })
        .join("\n") + "\n";

    if (!body.trim()) return resolve(null);

    const req = http.request(
      `${ES_URL}/_bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-ndjson", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function tick() {
  if (!fs.existsSync(LOG_FILE)) return;
  const stat = fs.statSync(LOG_FILE);
  let offset = readOffset();
  if (stat.size < offset) offset = 0; // файл перезаписаний/обрізаний — читаємо з початку

  if (stat.size === offset) return;

  const stream = fs.createReadStream(LOG_FILE, { start: offset, end: stat.size - 1, encoding: "utf8" });
  let chunk = "";
  for await (const c of stream) chunk += c;

  const lines = chunk.split("\n").filter(Boolean);
  if (lines.length) {
    const result = await bulkIndex(lines);
    if (result?.errors) {
      console.error("bulk index had errors:", JSON.stringify(result.items?.slice(0, 2)));
    } else {
      console.log(`shipped ${lines.length} lines (offset ${offset} -> ${stat.size})`);
    }
  }
  writeOffset(stat.size);
}

console.log(`shipping ${LOG_FILE} -> ${ES_URL}/${INDEX} every ${POLL_MS}ms`);
tick();
setInterval(tick, POLL_MS);
