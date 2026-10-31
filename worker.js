// SIMJIWA Worker - Cloudflare Workers + Google Gemini
// Secret wajib: GEMINI_API_KEY
// Variables opsional: GEMINI_MODEL, ALLOWED_ORIGIN

const MODEL_DEFAULT = "gemini-2.5-flash";
const ORIGIN_DEFAULT = "https://despita07.github.io";

function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const list = (env.ALLOWED_ORIGIN || ORIGIN_DEFAULT).split(",").map(x => x.trim());
  const ok = list.includes("*") || list.includes(origin);
  return {
    "Access-Control-Allow-Origin": list.includes("*") ? "*" : (ok ? origin : "null"),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function reply(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function geminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || "").join("\n").trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (request.method === "GET" && url.pathname === "/") {
      return reply({ service: "SIMJIWA Gemini Worker", status: "running", health: "/api/health" }, 200, headers);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return reply({
        ok: true,
        service: "SIMJIWA Gemini Worker",
        aiEnabled: Boolean(env.GEMINI_API_KEY),
        provider: "google-gemini",
        model: env.GEMINI_MODEL || MODEL_DEFAULT
      }, 200, headers);
    }

    if (url.pathname !== "/api/jiwa-ai" && url.pathname !== "/api/feedback") {
      return reply({ ok: false, error: "Endpoint tidak ditemukan." }, 404, headers);
    }
    if (request.method !== "POST") {
      return reply({ ok: false, error: "Gunakan metode POST." }, 405, headers);
    }
    if (!env.GEMINI_API_KEY) {
      return reply({ ok: false, error: "Secret GEMINI_API_KEY belum dipasang di Cloudflare." }, 503, headers);
    }

    let body;
    try { body = await request.json(); }
    catch { return reply({ ok: false, error: "Permintaan harus berformat JSON." }, 400, headers); }

    const answer = body.studentResponse || body.response || body.answer || body.message || body.text;
    const scenario = body.scenario || body.case || "Klien fiktif merasa takut karena mendengar suara.";
    if (typeof answer !== "string" || !answer.trim() || answer.length > 4000) {
      return reply({ ok: false, error: "Jawaban harus berupa teks 1–4000 karakter." }, 400, headers);
    }
    if (typeof scenario !== "string" || scenario.length > 1500) {
      return reply({ ok: false, error: "Skenario maksimal 1500 karakter." }, 400, headers);
    }

    const prompt = `Anda adalah SIMJIWA AI, pendamping latihan komunikasi terapeutik untuk mahasiswa keperawatan jiwa.\n\nBerikan umpan balik pendidikan berdasarkan skenario dan respons mahasiswa. Jangan mendiagnosis, meresepkan obat, atau menggantikan dosen/perawat klinis. Jangan membenarkan halusinasi/waham sebagai fakta. Gunakan empati, validasi emosi, komunikasi netral, eksplorasi pengalaman, dan pengkajian keselamatan. Jika ada risiko bahaya segera, sarankan melibatkan dosen/pembimbing dan tim klinis sesuai SOP. Jangan meminta identitas pasien nyata. Gunakan bahasa Indonesia.\n\nSusun jawaban: (1) Hal yang sudah baik, (2) Hal yang perlu diperbaiki, (3) Contoh kalimat alternatif, (4) Pertanyaan latihan berikutnya, (5) Catatan keselamatan bila relevan. Tegaskan bahwa umpan balik bersifat edukatif dan perlu ditelaah bersama dosen.\n\nSKENARIO FIKTIF:\n${scenario}\n\nRESPONS MAHASISWA:\n${answer.trim()}`;

    const model = env.GEMINI_MODEL || MODEL_DEFAULT;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 900 }
        })
      });
    } catch {
      return reply({ ok: false, error: "Tidak dapat menghubungi layanan Gemini." }, 502, headers);
    }

    let data;
    try { data = await response.json(); }
    catch { return reply({ ok: false, error: "Respons Gemini tidak dapat dibaca." }, 502, headers); }

    if (!response.ok) {
      const detail = data?.error?.message || "Tidak ada detail dari Google.";
      const message = response.status === 429
        ? "Kuota atau batas penggunaan Gemini tercapai. Coba lagi nanti."
        : `Gemini gagal memproses permintaan: ${detail}`;
      return reply({ ok: false, error: message, providerStatus: response.status }, response.status === 429 ? 429 : 502, headers);
    }

    const feedback = geminiText(data);
    if (!feedback) return reply({ ok: false, error: "Gemini tidak menghasilkan teks." }, 502, headers);
    return reply({ ok: true, provider: "google-gemini", model, feedback, result: feedback, reply: feedback, text: feedback }, 200, headers);
  }
};
