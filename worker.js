const DEFAULT_MODEL = "gemini-3.7-flash";
const ALLOWED_ORIGIN_DEFAULT = "https://despita07.github.io";

function corsHeaders(origin, allowedOrigin) {
  const allowed = (allowedOrigin || ALLOWED_ORIGIN_DEFAULT).split(",").map(v => v.trim());
  const permitted = allowed.includes("*") || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": permitted ? (allowed.includes("*") ? "*" : origin) : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}


function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      ...cors
    }
  });
}


function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      ...cors
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";





export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN || ALLOWED_ORIGIN_DEFAULT);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return json({ service: "SIMJIWA Gemini Worker", status: "running" }, 200, cors);
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        aiEnabled: Boolean(env.GEMINI_API_KEY),
        provider: "google-gemini",
        model: env.GEMINI_MODEL || DEFAULT_MODEL,
        mode: env.GEMINI_API_KEY ? "generative-ai" : "backend-only-no-api-key"
      }, 200, cors);
    }

    if ((url.pathname === "/api/feedback" || url.pathname === "/api/jiwa-ai") && request.method === "POST") {
      if (!env.GEMINI_API_KEY) {
        return json({ error: "Worker aktif, tetapi GEMINI_API_KEY belum ditambahkan pada Secrets." }, 503, cors);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Format permintaan harus JSON." }, 400, cors);
      }

      const studentResponse = body.studentResponse ?? body.response ?? body.answer ?? body.message ?? body.text;
      const scenario = body.scenario ?? body.case ?? "Klien fiktif merasa takut karena mendengar suara.";

      if (typeof studentResponse !== "string" || !studentResponse.trim() || studentResponse.length > 4000) {
        return json({ error: "Respons latihan harus berisi 1–4000 karakter." }, 400, cors);
      }

      const instructions = `Anda adalah Jiwa-AI, pendamping latihan komunikasi terapeutik untuk mahasiswa keperawatan jiwa.
Berikan umpan balik pendidikan pada respons mahasiswa terhadap skenario fiktif.
Jangan mendiagnosis, meresepkan obat, atau menggantikan dosen/perawat klinis.
Jangan membenarkan isi halusinasi sebagai fakta dan jangan meremehkan pengalaman klien.
Nilai empati dan validasi emosi, komunikasi netral, eksplorasi pengalaman, pengkajian keselamatan, privasi dan martabat.
Jika ada perintah berbahaya atau risiko segera, sarankan mahasiswa melibatkan dosen/pembimbing dan tim klinis sesuai SOP.
Jangan meminta atau memproses identitas pasien nyata. Gunakan bahasa Indonesia.
Susun jawaban menjadi: (1) Hal yang sudah baik, (2) Hal yang perlu diperbaiki, (3) Contoh kalimat alternatif, (4) Pertanyaan latihan berikutnya.
Tegaskan bahwa umpan balik bersifat edukatif dan perlu ditelaah bersama dosen.

Skenario fiktif:
${String(scenario).slice(0, 1500)}

Respons mahasiswa:
${studentResponse.trim()}`;

      const model = env.GEMINI_MODEL || DEFAULT_MODEL;
     const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      try {
      
const aiResponse = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": env.GEMINI_API_KEY
  },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: instructions }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 700
    }
  })
});


        const result = await aiResponse.json();
        if (!aiResponse.ok) {
          return json({
            error: aiResponse.status === 429
              ? "Kuota Gemini gratis sedang habis atau mencapai batas. Coba lagi nanti."
              : "Gemini gagal memproses permintaan. Periksa API key dan nama model."
          }, aiResponse.status === 429 ? 429 : 502, cors);
        }

        const feedback = result?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n").trim();
        if (!feedback) return json({ error: "Gemini tidak mengembalikan umpan balik." }, 502, cors);

        return json({ feedback, provider: "google-gemini", model }, 200, cors);
      } catch {
        return json({ error: "Tidak dapat menghubungi layanan Gemini." }, 502, cors);
      }
    }

    return json({ error: "Endpoint tidak ditemukan." }, 404, cors);
  }
};
