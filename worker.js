const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_ORIGIN = "https://despita07.github.io";

function makeCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const permitted = allowed.includes("*") || allowed.includes(origin);

  return {
    "Access-Control-Allow-Origin": allowed.includes("*")
      ? "*"
      : (permitted ? origin : "null"),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function sendJson(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

function getGeminiText(data) {
  const candidates = data && data.candidates ? data.candidates : [];
  const content = candidates[0] && candidates[0].content
    ? candidates[0].content
    : {};
  const parts = content.parts || [];

  return parts
    .map((part) => part.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = makeCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return sendJson({
        ok: true,
        service: "SIMJIWA Gemini Worker",
        status: "running",
        endpoints: ["/api/health", "/api/jiwa-ai", "/api/feedback"]
      }, 200, corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson({
        ok: true,
        service: "SIMJIWA Gemini Worker",
        aiEnabled: Boolean(env.GEMINI_API_KEY),
        provider: "google-gemini",
        model: env.GEMINI_MODEL || DEFAULT_MODEL
      }, 200, corsHeaders);
    }

    const isAiEndpoint =
      url.pathname === "/api/jiwa-ai" ||
      url.pathname === "/api/feedback";

    if (!isAiEndpoint) {
      return sendJson({
        ok: false,
        error: "Endpoint tidak ditemukan."
      }, 404, corsHeaders);
    }

    if (request.method !== "POST") {
      return sendJson({
        ok: false,
        error: "Gunakan metode POST untuk endpoint AI."
      }, 405, corsHeaders);
    }

    if (!env.GEMINI_API_KEY) {
      return sendJson({
        ok: false,
        error: "Secret GEMINI_API_KEY belum dipasang pada Cloudflare Worker."
      }, 503, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return sendJson({
        ok: false,
        error: "Isi permintaan harus berupa JSON yang valid."
      }, 400, corsHeaders);
    }

    const studentResponse =
      body.studentResponse ||
      body.response ||
      body.answer ||
      body.message ||
      body.text;

    const scenario =
      body.scenario ||
      body.case ||
      "Klien fiktif merasa takut karena mendengar suara.";

    if (
      typeof studentResponse !== "string" ||
      studentResponse.trim().length === 0 ||
      studentResponse.length > 4000
    ) {
      return sendJson({
        ok: false,
        error: "Respons mahasiswa wajib berupa teks dengan panjang 1 sampai 4000 karakter."
      }, 400, corsHeaders);
    }

    if (typeof scenario !== "string" || scenario.length > 1500) {
      return sendJson({
        ok: false,
        error: "Skenario harus berupa teks maksimal 1500 karakter."
      }, 400, corsHeaders);
    }

    const prompt = [
      "Anda adalah SIMJIWA AI, pendamping latihan komunikasi terapeutik untuk mahasiswa keperawatan jiwa.",
      "Berikan umpan balik pendidikan berdasarkan skenario dan respons mahasiswa.",
      "Jangan mendiagnosis, meresepkan obat, atau menggantikan dosen maupun perawat klinis.",
      "Jangan membenarkan halusinasi atau waham sebagai fakta.",
      "Gunakan empati, validasi emosi, komunikasi netral, eksplorasi pengalaman, dan pengkajian keselamatan.",
      "Jika terdapat risiko bahaya segera, sarankan mahasiswa melibatkan dosen/pembimbing dan tim klinis sesuai SOP.",
      "Jangan meminta atau memproses identitas pasien nyata. Gunakan bahasa Indonesia.",
      "Susun jawaban dalam bagian: (1) Hal yang sudah baik, (2) Hal yang perlu diperbaiki, (3) Contoh kalimat alternatif, (4) Pertanyaan latihan berikutnya, (5) Catatan keselamatan bila relevan.",
      "Tegaskan bahwa umpan balik bersifat edukatif dan perlu ditelaah bersama dosen.",
      "",
      "SKENARIO FIKTIF:",
      scenario,
      "",
      "RESPONS MAHASISWA:",
      studentResponse.trim()
    ].join("\n");

    const model = env.GEMINI_MODEL || DEFAULT_MODEL;
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent";

    let geminiResponse;
    try {
      geminiResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 900
          }
        })
      });
    } catch (error) {
      return sendJson({
        ok: false,
        error: "Worker tidak dapat terhubung ke layanan Google Gemini."
      }, 502, corsHeaders);
    }

    let geminiData;
    try {
      geminiData = await geminiResponse.json();
    } catch (error) {
      return sendJson({
        ok: false,
        error: "Respons dari Google Gemini bukan JSON yang dapat dibaca."
      }, 502, corsHeaders);
    }

    if (!geminiResponse.ok) {
      const detail =
        geminiData &&
        geminiData.error &&
        geminiData.error.message
          ? geminiData.error.message
          : "Google Gemini menolak permintaan.";

      return sendJson({
        ok: false,
        error: geminiResponse.status === 429
          ? "Batas penggunaan atau kuota Gemini tercapai. Silakan coba lagi nanti."
          : "Gemini gagal memproses permintaan: " + detail,
        providerStatus: geminiResponse.status
      }, geminiResponse.status === 429 ? 429 : 502, corsHeaders);
    }

    const feedback = getGeminiText(geminiData);

    if (!feedback) {
      return sendJson({
        ok: false,
        error: "Gemini tidak menghasilkan teks. Silakan coba kembali."
      }, 502, corsHeaders);
    }

    return sendJson({
      ok: true,
      provider: "google-gemini",
      model: model,
      feedback: feedback,
      result: feedback,
      reply: feedback,
      text: feedback
    }, 200, corsHeaders);
  }
};
