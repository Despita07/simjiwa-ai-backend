import express from "express";
import cors from "cors";
import OpenAI from "openai";
const app=express(), port=process.env.PORT||3000;
const client=process.env.OPENAI_API_KEY?new OpenAI({apiKey:process.env.OPENAI_API_KEY}):null;
const allowed=(process.env.ALLOWED_ORIGIN||"*").split(",").map(x=>x.trim());
app.use(cors({origin(origin,cb){if(!origin||allowed.includes("*")||allowed.includes(origin))return cb(null,true);return cb(new Error("Origin tidak diizinkan."));},methods:["GET","POST"],allowedHeaders:["Content-Type"]}));
app.use(express.json({limit:"20kb"}));
app.get("/api/health",(_req,res)=>res.json({ok:true,aiEnabled:!!client,mode:client?"generative-ai":"demo-local"}));
const system=`Anda adalah Jiwa-AI, pendamping latihan komunikasi terapeutik untuk mahasiswa keperawatan jiwa. Beri umpan balik pendidikan hanya pada skenario fiktif. Jangan mendiagnosis, meresepkan obat, atau menggantikan dosen/perawat/SOP. Nilai empati dan validasi emosi, komunikasi netral (jangan membenarkan isi halusinasi sebagai fakta dan jangan meremehkan pengalaman klien), eksplorasi pengalaman, pengkajian keselamatan, privasi dan martabat. Jika ada indikasi perintah berbahaya atau risiko segera, sarankan mahasiswa segera melibatkan dosen/pembimbing dan tim klinis sesuai SOP. Keluarkan bagian: Hal yang sudah baik; Hal yang perlu diperbaiki; Contoh kalimat alternatif; Pertanyaan latihan berikutnya. Akhiri bahwa umpan balik edukatif harus divalidasi dosen. Jangan meminta data identitas pasien nyata.`;
app.post("/api/feedback",async(req,res)=>{
 if(!client)return res.status(503).json({error:"OPENAI_API_KEY belum dikonfigurasi pada backend."});
 const {scenario,studentResponse,conversationHistory=[]}=req.body||{};
 if(typeof studentResponse!=="string"||!studentResponse.trim()||studentResponse.length>4000)return res.status(400).json({error:"Respons mahasiswa harus berisi 1–4000 karakter."});
 const safeScenario=typeof scenario==="string"?scenario.slice(0,1500):"Kasus latihan fiktif komunikasi terapeutik.";
 const history=Array.isArray(conversationHistory)?conversationHistory.slice(-6).map(m=>({role:m?.role==="assistant"?"assistant":"user",content:String(m?.text||"").slice(0,1000)})).filter(m=>m.content):[];
 try{
  const result=await client.chat.completions.create({model:process.env.OPENAI_MODEL||"gpt-4.1-mini",temperature:.3,messages:[{role:"system",content:system},{role:"user",content:`Skenario fiktif:\n${safeScenario}\n\nRespons mahasiswa:\n${studentResponse.trim()}`},...history]});
  const feedback=result.choices?.[0]?.message?.content?.trim();
  if(!feedback)return res.status(502).json({error:"Model tidak mengembalikan umpan balik."});
  res.json({mode:"generative-ai",feedback});
 }catch(e){console.error("Jiwa-AI:",e?.message||e);res.status(500).json({error:"Jiwa-AI sedang mengalami kendala. Silakan coba kembali."});}
});
app.listen(port,()=>console.log("SIMJIWA API aktif pada port "+port));
