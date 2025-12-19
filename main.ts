import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const kv = await Deno.openKv();

async function getAdminPassword() {
  const entry = await kv.get(["config", "admin_password"]);
  return entry.value as string | null;
}

// --- Background 2D Live Tracker Logic ---
setInterval(async () => {
  const now = new Date();
  const mmTime = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Yangon", hour12: false });
  const currentTime = mmTime.substring(0, 5); // HH:MM

  // ညီကိုသတ်မှတ်ထားသော အချိန်အပိုင်းအခြားများ
  const isMorning = (currentTime >= "09:35" && currentTime <= "11:20");
  const isEvening = (currentTime >= "14:05" && currentTime <= "15:20");

  if (isMorning || isEvening) {
    try {
      const res = await fetch("https://api.thaistock2d.com/live");
      const data = await res.json();
      const live2d = data.live.twod; // Official API 2D

      if (live2d && live2d.length === 2) {
        const head = live2d[0];
        const tail = live2d[1];
        const sessionKey = isMorning ? "morning_stats" : "evening_stats";
        
        const stats = (await kv.get([sessionKey])).value as any || { heads: {}, tails: {}, last: "", updateTime: "" };

        // အကျများဆုံးစာရင်းအတွက် ထိပ်စီးနှင့် နောက်ပိတ်ကို တွက်ချက်ခြင်း
        stats.heads[head] = (stats.heads[head] || 0) + 1;
        stats.tails[tail] = (stats.tails[tail] || 0) + 1;
        stats.last = live2d;
        stats.updateTime = mmTime;

        await kv.set([sessionKey], stats);
      }
    } catch (e) { /* API connection silent handle */ }
  }
}, 3000); // ၃ စက္ကန့်တစ်ခါ Live ဒေတာဆွဲယူခြင်း

// --- UI Components (Error-Free Structure) ---
const UI_CSS = `
  body { background-color: #0c0c0c; color: #fff; font-family: sans-serif; }
  .card-bg { background-color: #111; border: 1px solid #222; border-radius: 16px; }
  .hot-badge { background-color: #1a1a1a; border: 1px solid #333; padding: 6px 12px; border-radius: 8px; font-weight: 900; }
  .btn-gold { background: linear-gradient(180deg, #f3ca52 0%, #a87f00 100%); color: #000; font-weight: 900; border-radius: 8px; }
`;

serve(async (req) => {
  const url = new URL(req.url);
  const storedPass = await getAdminPassword();

  // 1. PUBLIC VIEW
  if (url.pathname === "/" && req.method === "GET") {
    const html = `
    <!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=1024">
      <title>Winner-Corner 2D Live</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>${UI_CSS}</style>
    </head><body class="p-6">
      <div class="max-w-4xl mx-auto text-center">
        <header class="py-10"><h1 class="text-7xl font-black italic text-yellow-500 uppercase tracking-tighter">Winner-Corner</h1></header>
        
        <section class="mb-12 px-10">
          <h2 class="text-2xl font-bold text-white mb-4 uppercase tracking-[0.2em]">Thai 2D Real-time Analytics</h2>
          <p class="text-zinc-500 text-lg leading-relaxed italic max-w-2xl mx-auto">
            Powered by high-precision SET Index data. Professional frequency monitoring for statistical intelligence.
          </p>
          <div class="mt-8 flex justify-center gap-6">
              <span class="text-xs font-black text-yellow-500 uppercase tracking-widest border-b-2 border-yellow-500 pb-1">✓ 90% Accuracy</span>
              <span class="text-xs font-black text-yellow-500 uppercase tracking-widest border-b-2 border-yellow-500 pb-1">✓ Live Tracking</span>
          </div>
        </section>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          <div class="card-bg p-8 border-t-4 border-yellow-500 shadow-2xl">
            <h3 class="text-yellow-500 font-black uppercase text-sm mb-6">Morning (09:35 - 11:20)</h3>
            <div id="m-live" class="text-7xl font-mono font-black mb-8 text-zinc-800">--</div>
            <div id="m-stats" class="text-left space-y-6"></div>
          </div>
          <div class="card-bg p-8 border-t-4 border-sky-500 shadow-2xl">
            <h3 class="text-sky-500 font-black uppercase text-sm mb-6">Evening (14:05 - 15:20)</h3>
            <div id="e-live" class="text-7xl font-mono font-black mb-8 text-zinc-800">--</div>
            <div id="e-stats" class="text-left space-y-6"></div>
          </div>
        </div>

        <footer class="py-16 border-t border-zinc-900"><p class="text-zinc-600 text-[10px] font-black uppercase tracking-[0.4em]">&copy; 2025 WINNER-CORNER.DENO.DEV | ALL RIGHTS RESERVED</p></footer>
      </div>

      <script>
        async function refreshStats() {
          const res = await fetch('/api/stats'); const data = await res.json();
          ['morning', 'evening'].forEach(ses => {
            const s = data[ses + '_stats'];
            if(s && s.last) {
              const el = document.getElementById(ses[0] + '-live'); el.innerText = s.last; el.classList.replace('text-zinc-800', 'text-white');
              const hTop = Object.entries(s.heads).sort((a,b)=>b[1]-a[1]).slice(0,4);
              const tTop = Object.entries(s.tails).sort((a,b)=>b[1]-a[1]).slice(0,4);
              document.getElementById(ses[0] + '-stats').innerHTML = \`
                <div><p class="text-[10px] text-zinc-500 uppercase font-black mb-2 tracking-widest">Hot Heads (Top 4)</p>
                <div class="flex gap-2 flex-wrap">\${hTop.map(x => '<span class="hot-badge text-yellow-500">' + x[0] + ' (' + x[1] + ')</span>').join('')}</div></div>
                <div><p class="text-[10px] text-zinc-500 uppercase font-black mb-2 tracking-widest">Hot Tails (Top 4)</p>
                <div class="flex gap-2 flex-wrap">\${tTop.map(y => '<span class="hot-badge text-sky-400">' + y[0] + ' (' + y[1] + ')</span>').join('')}</div></div>\`;
            }
          });
        }
        setInterval(refreshStats, 5000); refreshStats();
      </script>
    </body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }

  // 2. ADMIN PANEL
  if (url.pathname === "/admin" && req.method === "GET") {
    let body = "";
    if (!storedPass) {
      body = `<div class="card-bg p-8 max-w-sm mx-auto text-center"><input type="password" id="np" class="w-full p-3 bg-zinc-900 border border-zinc-800 rounded mb-4" placeholder="Admin Key"><button onclick="setP()" class="btn-gold w-full p-3 uppercase">Save Setup</button></div><script>async function setP(){ await fetch("/api/config",{method:"POST",body:JSON.stringify({p:document.getElementById("np").value})}); location.reload(); }</script>`;
    } else {
      body = `
        <div id="login-box" class="card-bg p-8 max-w-sm mx-auto text-center"><input type="password" id="ak" class="w-full p-3 bg-zinc-900 border border-zinc-800 rounded mb-4" placeholder="Enter Key"><button onclick="doL()" class="btn-gold w-full p-3 uppercase">Login</button></div>
        <div id="dash" class="hidden text-center">
          <div class="card-bg p-8 border-t-4 border-red-600 max-w-md mx-auto">
            <h3 class="text-red-500 font-black uppercase text-xs mb-4">Wipe Analytics</h3>
            <p class="text-zinc-500 text-xs mb-8">This will reset all frequency counts for Head and Tail digits.</p>
            <button onclick="doR()" class="bg-red-600 text-white w-full py-4 rounded font-black uppercase">Reset All 2D Data</button>
          </div>
          <button onclick="sessionStorage.clear();location.reload()" class="mt-8 text-zinc-600 text-[10px] underline uppercase">Logout Admin</button>
        </div>
        <script>
          const sk = sessionStorage.getItem('ak'); if(sk) { document.getElementById('login-box').classList.add('hidden'); document.getElementById('dash').classList.remove('hidden'); }
          async function doL(){ const v=document.getElementById('ak').value; const r=await fetch('/api/verify',{method:'POST',body:JSON.stringify({p:v})}); if(r.ok){sessionStorage.setItem('ak',v);location.reload();}else{alert('Wrong!');} }
          async function doR(){ if(!confirm('Reset counts?'))return; await fetch('/api/reset',{method:'POST',body:JSON.stringify({k:sk})}); location.reload(); }
        </script>`;
    }
    return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=1024"><script src="https://cdn.tailwindcss.com"></script><style>${UI_CSS}</style></head><body class="p-6 text-center"><h2 class="text-3xl font-black text-yellow-500 mb-8 italic uppercase">Admin Console</h2>${body}</body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }

  // --- 3. API HANDLERS ---
  if (url.pathname === "/api/stats" && req.method === "GET") {
    const m = (await kv.get(["morning_stats"])).value;
    const e = (await kv.get(["evening_stats"])).value;
    return new Response(JSON.stringify({ morning_stats: m, evening_stats: e }));
  }
  if (url.pathname === "/api/reset" && req.method === "POST") {
    const { k } = await req.json(); if (k !== storedPass) return new Response("Error", { status: 401 });
    await kv.delete(["morning_stats"]); await kv.delete(["evening_stats"]); return new Response("OK");
  }
  if (url.pathname === "/api/verify" && req.method === "POST") {
    const { p } = await req.json(); return p === storedPass ? new Response("OK") : new Response("Error", { status: 401 });
  }
  if (url.pathname === "/api/config" && req.method === "POST") {
    const { p } = await req.json(); await kv.set(["config", "admin_password"], p); return new Response("OK");
  }

  return new Response("Not Found", { status: 404 });
});
