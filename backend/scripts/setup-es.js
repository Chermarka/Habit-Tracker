const http = require("http");

const ES_URL = process.env.ES_URL || "http://localhost:9200";
const KIBANA_URL = process.env.KIBANA_URL || "http://localhost:5601";
const INDEX = process.env.ES_INDEX || "habit-tracker-logs";
const WAIT_RETRIES = 30;
const WAIT_DELAY_MS = 2000;

function request(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(name, url) {
  for (let i = 0; i < WAIT_RETRIES; i++) {
    try {
      const { status } = await request(url);
      if (status && status < 500) return;
    } catch {
      // ще не піднялось — пробуємо ще раз
    }
    console.log(`waiting for ${name}... (${i + 1}/${WAIT_RETRIES})`);
    await sleep(WAIT_DELAY_MS);
  }
  throw new Error(`${name} не відповів за ${(WAIT_RETRIES * WAIT_DELAY_MS) / 1000}s — перевір docker compose ps`);
}

async function createIndexTemplate() {
  const { status, body } = await request(`${ES_URL}/_index_template/${INDEX}`, {
    method: "PUT",
    body: {
      index_patterns: [`${INDEX}*`],
      template: {
        mappings: {
          dynamic_templates: [
            {
              strings_as_keyword: {
                match_mapping_type: "string",
                mapping: { type: "keyword" },
              },
            },
          ],
        },
      },
    },
  });
  if (status >= 300) throw new Error(`index template: ${JSON.stringify(body)}`);
  console.log(`index template "${INDEX}" готовий (усі рядкові поля -> keyword, без .keyword-дублів)`);
}

async function createKibanaIndexPattern() {
  const { status, body } = await request(`${KIBANA_URL}/api/saved_objects/index-pattern/${INDEX}`, {
    method: "POST",
    headers: { "kbn-xsrf": "true" },
    body: { attributes: { title: `${INDEX}*`, timeFieldName: "@timestamp" } },
  });
  if (status >= 300 && body?.statusCode !== 409) {
    throw new Error(`kibana index pattern: ${JSON.stringify(body)}`);
  }
  console.log(
    status === 409 || body?.statusCode === 409
      ? `index pattern "${INDEX}" вже існує в Kibana`
      : `index pattern "${INDEX}" створено в Kibana (Discover -> ${INDEX})`
  );
}

async function main() {
  await waitFor("Elasticsearch", `${ES_URL}/_cluster/health`);
  await waitFor("Kibana", `${KIBANA_URL}/api/status`);
  await createIndexTemplate();
  await createKibanaIndexPattern();
  console.log("готово — можна запускати `npm run ship-logs`");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
