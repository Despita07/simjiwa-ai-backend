SIMJIWA Cloudflare Worker (Gemini)

Dashboard steps:
1. Cloudflare Dashboard > Workers & Pages > Create application > Create Worker.
2. Name it simjiwa-ai-backend and deploy the starter.
3. Open Edit code, replace starter code with worker.js content, then Deploy.
4. Open Settings > Variables and Secrets > Add.
5. Add GEMINI_API_KEY as a Secret. Add GEMINI_MODEL as Text = gemini-3.7-flash. Add ALLOWED_ORIGIN as Text = https://despita07.github.io.
6. Deploy changes.

Test:
GET https://YOUR-WORKER.workers.dev/api/health
POST /api/feedback or /api/jiwa-ai with JSON:
{"scenario":"Klien fiktif takut mendengar suara","studentResponse":"Saya memahami Anda merasa takut. Apakah suara itu menyuruh Anda melakukan sesuatu?"}

Never place the Gemini API key in frontend code or commit it to GitHub. Use fictional cases only.
