// Suite 7 - PDF & SSE
import { suite, test, assert, http, summary, BASE_URL } from "./helpers.mjs"

suite("Suite 7 — PDF & SSE")

test("7.1 GET /briefings/export returns content-type application/pdf", async () => {
  const res = await fetch(`${BASE_URL}/api/intel/automation/briefings/export`)
  assert(res.status === 200, `status ${res.status}`)
  const ct = res.headers.get("content-type") || ""
  assert(ct.includes("application/pdf"), `wrong content-type: ${ct}`)
})

test("7.2 PDF starts with %PDF magic header", async () => {
  const res = await fetch(`${BASE_URL}/api/intel/automation/briefings/export`)
  const buf = Buffer.from(await res.arrayBuffer())
  const head = buf.slice(0, 4).toString("ascii")
  assert(head === "%PDF", `wrong magic header: ${head}`)
})

test("7.3 PDF size > 1500 bytes (real content rendered)", async () => {
  const res = await fetch(`${BASE_URL}/api/intel/automation/briefings/export`)
  const buf = Buffer.from(await res.arrayBuffer())
  assert(buf.length > 1500, `PDF too small: ${buf.length} bytes`)
})

test("7.4 SSE stream emits at least one 'score' event in 12s", async () => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  let received = false
  let buffer = ""
  try {
    const res = await fetch(`${BASE_URL}/api/intel/automation/stream`, {
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    })
    assert(res.status === 200, `status ${res.status}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (!received) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      if (/event:\s*score/.test(buffer)) {
        received = true
        break
      }
    }
    try {
      reader.cancel()
    } catch {
      // ignore
    }
  } catch (err) {
    if (err.name !== "AbortError") throw err
  } finally {
    clearTimeout(timeout)
  }
  assert(received, "did not receive 'score' event in 12s")
})

const ok = await summary()
process.exit(ok ? 0 : 1)
