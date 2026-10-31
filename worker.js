
const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_RESPONSE_LENGTH = 4000;
const MAX_SCENARIO_LENGTH = 1500;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        ok: true,
        service: "SIMJIWA Gemini Worker",
        status: "running",
        health: "/api/health",
        endpoint: "/api/feedback"
      });
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/health"
    ) {
      return json({
        ok: true,
        service: "SIMJIWA Gemini Worker",
        aiEnabled: Boolean(env.GEMINI_API_KEY),
        provider: "google-gemini",
        model: env.GEMINI_MODEL || DEFAULT_MODEL
      });
    }

    const isFeedbackRoute =
      url.pathname === "/api/feedback" ||
      url.pathname === "/api/jiwa-ai";

    if (request.method === "POST" && isFeedbackRoute) {

      if (!env.GEMINI_API_KEY) {
        return json({
          ok: false,
          error: "Secret GEMINI_API_KEY belum dipasang."
        }, 503);
      }

      let body;

      try {
        body = await request.json();
      } catch {
        return json({
          ok: false,
          error: "Body permintaan harus berupa JSON yang valid."
        }, 400);
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
        !studentResponse.trim()
      ) {
        return json({
          ok: false,
          error: "Respons mahasiswa wajib diisi."
        }, 400);
      }

      if (studentResponse.length > MAX_RESPONSE_LENGTH) {
        return json({
          ok: false,
          error: "Respons mahasiswa maksimal 4000 karakter."
        }, 400);
      }

      const prompt = `
Anda adalah pendamping latihan komunikasi terapeutik
untuk mahasiswa keperawatan jiwa.

Berikan umpan balik pendidikan terhadap respons mahasiswa
pada skenario fiktif berikut.

Jangan mendiagnosis, meresepkan obat, atau menggantikan
dosen maupun perawat klinis.

Jangan membenarkan halusinasi sebagai fakta.
Jangan meremehkan pengalaman klien.

Nilai:
1. Empati dan validasi emosi.
2. Komunikasi terapeutik yang netral.
3. Eksplorasi pengalaman.
4. Pengkajian keselamatan.
5. Privasi dan martabat klien.

Jika ada indikasi bahaya segera, sarankan mahasiswa
melibatkan dosen/pembimbing dan tim klinis sesuai SOP.

Jangan meminta identitas pasien nyata.
Gunakan bahasa Indonesia.

Susun jawaban menjadi:
1. Hal yang sudah baik.
2. Hal yang perlu diperbaiki.
3. Contoh kalimat alternatif.
4. Pertanyaan latihan berikutnya.

Tegaskan bahwa umpan balik bersifat edukatif
dan perlu ditelaah bersama dosen.

SKENARIO:
${String(scenario).slice(0, MAX_SCENARIO_LENGTH)}

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
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 900
            }
          })
        });
      } catch {
        return json({
          ok: false,
          error: "Tidak dapat terhubung ke layanan Gemini."
        }, 502);
      }

      let result;

      try {
        result = await aiResponse.json();
      } catch {
        return json({
          ok: false,
          error: "Respons Gemini tidak dapat dibaca."
        }, 502);
      }

      if (!aiResponse.ok) {
        return json({
          ok: false,
          error: aiResponse.status === 429
            ? "Kuota Gemini tercapai. Coba lagi nanti."
            : (result?.error?.message || "Permintaan Gemini gagal."),
          providerStatus: aiResponse.status
        }, aiResponse.status === 429 ? 429 : 502);
      }

      const feedback = (
        result?.candidates?.[0]?.content?.parts || []
      )
        .map(part => part.text || "")
        .join("\n")
        .trim();

      if (!feedback) {
        return json({
          ok: false,
          error: "Gemini tidak menghasilkan umpan balik."
        }, 502);
      }

      return json({
        ok: true,
        feedback: feedback,
        model: model
      });
    }

    return json({
      ok: false,
      error: "Endpoint tidak ditemukan."
    }, 404);
  }
};
