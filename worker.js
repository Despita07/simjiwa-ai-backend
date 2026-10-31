// SIMJIWA Virtual Mental Health Lab
// Cloudflare Worker - Gemini API backend
// Required secret: GEMINI_API_KEY
// Optional variables: GEMINI_MODEL, ALLOWED_ORIGIN

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_ALLOWED_ORIGIN = "https://despita07.github.io";

function getCorsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin") || "";
  const allowedOrigins = (env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const originAllowed =
    allowedOrigins.includes("*") || allowedOrigins.includes(requestOrigin);

  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes("*")
      ? "*"
      : originAllowed
        ? requestOrigin
        : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function sendJson(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

function getTextFromGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return sendJson({
        service: "SIMJIWA Gemini Worker",
        status: "running",
        health: "/api/health"
      }, 200, cors);
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return sendJson({
        ok: true,
        service: "SIMJIWA Gemini Worker",
        aiEnabled: Boolean(env.GEMINI_API_KEY),
        provider: "google-gemini",
        model: env.GEMINI_MODEL || DEFAULT_MODEL,
        mode: env.GEMINI_API_KEY ? "generative-ai" : "backend-only-no-api-key"
      }, 200, cors);
    }

    const isAiEndpoint =
      url.pathname === "/api/jiwa-ai" ||
      url.pathname === "/api/feedback";

    if (isAiEndpoint && request.method === "POST") {
      if (!env.GEMINI_API_KEY) {
        return sendJson({
          ok: false,
          error: "Backend aktif, tetapi secret GEMINI_API_KEY belum dipasang di Cloudflare Workers."
        }, 503, cors);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return sendJson({
          ok: false,
          error: "Format permintaan harus berupa JSON."
        }, 400, cors);
      }

      const studentResponse =
        body.studentResponse ??
        body.response ??
        body.answer ??
        body.message ??
        body.text;

      const scenario =
        body.scenario ??
        body.case ??
        "Klien fiktif merasa takut karena mendengar suara.";

      if (
        typeof studentResponse !== "string" ||
        !studentResponse.trim() ||
        studentResponse.length > 4000
      ) {
        return sendJson({
          ok: false,
          error: "Jawaban latihan harus berupa teks dengan panjang 1–4000 karakter."
        }, 400, cors);
      }

      if (typeof scenario !== "string" || scenario.length > 1500) {
        return sendJson({
          ok: false,
          error: "Skenario harus berupa teks maksimal 1500 karakter."
        }, 400, cors);
      }

      const instructions = `
Anda adalah SIMJIWA AI, pendamping latihan komunikasi terapeutik untuk mahasiswa keperawatan jiwa.

TUGAS:
Berikan umpan balik pendidikan terhadap respons mahasiswa berdasarkan skenario fiktif di bawah ini.

PRINSIP KEAMANAN:
- Jangan mendiagnosis pasien, meresepkan obat, atau menggantikan dosen, perawat klinis, maupun tenaga kesehatan.
- Jangan membenarkan isi halusinasi atau waham sebagai fakta.
- Jangan meremehkan, menghakimi, atau menyalahkan pengalaman dan emosi klien.
- Gunakan empati, validasi emosi, komunikasi netral, eksplorasi pengalaman, pengkajian keselamatan, privasi, dan martabat.
- Jika ada indikasi bahaya atau risiko segera, sarankan mahasiswa melibatkan dosen/pembimbing dan tim klinis sesuai SOP.
- Jangan meminta atau memproses identitas pasien nyata.
- Gunakan bahasa Indonesia yang jelas, sopan, dan mudah dipahami.

FORMAT JAWABAN:
1. Hal yang sudah baik.
2. Hal yang perlu diperbaiki.
3. Contoh kalimat terapeutik alternatif.
4. Pertanyaan latihan berikutnya untuk mahasiswa.
5. Catatan keselamatan bila relevan.

Tegaskan bahwa umpan balik ini bersifat edukatif dan perlu ditelaah bersama dosen/pembimbing.

SKENARIO FIKTIF:
${scenario.slice(0, 1500)}

RESPONS MAHASISWA:
${studentResponse.trim()}
`;

      const model = env.GEMINI_MODEL || DEFAULT_MODEL;
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      let aiResponse;
      try {
        aiResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: instructions }]
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 900
            }
          })
        });
      } catch {
        return sendJson({
          ok: false,
          error: "Tidak dapat menghubungi layanan Gemini. Periksa koneksi dan coba lagi."
        }, 502, cors);
      }

      let result;
      try {
        result = await aiResponse.json();
      } catch {
        return sendJson({
          ok: false,
          error: "Gemini mengirim respons yang tidak dapat dibaca."
        }, 502, cors);
      }

      if (!aiResponse.ok) {
        const googleMessage =
          result?.error?.message || "Gemini gagal memproses permintaan.";

        const message =
          aiResponse.status === 429
            ? "Kuota atau batas penggunaan Gemini sedang tercapai. Coba lagi nanti atau periksa kuota Google AI Studio."
            : aiResponse.status === 400 || aiResponse.status === 404
              ? `Permintaan Gemini tidak valid. Periksa nama model (${model}) dan konfigurasi API. Detail: ${googleMessage}`
              : `Gemini gagal memproses permintaan. Detail: ${googleMessage}`;

        return sendJson({
          ok: false,
          error: message,
          providerStatus: aiResponse.status
        }, aiResponse.status === 429 ? 429 : 502, cors);
      }

      const feedback = getTextFromGemini(result);

      if (!feedback) {
        return sendJson({
          ok: false,
          error: "Gemini tidak menghasilkan teks. Coba ubah jawaban atau skenario latihan."
        }, 502, cors);
      }

      return sendJson({
        ok: true,
        provider: "google-gemini",
        model,
        feedback,
        result: feedback,
        reply: feedback,
        text: feedback
      }, 200, cors);
    }

    if (isAiEndpoint && request.method !== "POST") {
      return sendJson({
        ok: false,
        error: "Gunakan metode POST untuk endpoint AI."
      }, 405, cors);
    }

    return sendJson({
      ok: false,
      error: "Endpoint tidak ditemukan."
    }, 404, cors);
  }
};
