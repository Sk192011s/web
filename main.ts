import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const kv = await Deno.openKv();

async function getAdminPassword() {
  const entry = await kv.get(["config", "admin_password"]);
  return entry.value as string | null;
}

// --- Background Live Data Processor ---
setInterval(async () => {
  const now = new Date();
  const mmTime = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Yangon", hour12: false });
  const currentTime = mmTime.substring(0, 5);

  const isMorning = (currentTime >= "09:35" && currentTime <= "11:20");
  const isEvening = (currentTime >= "14:05" && currentTime <= "15:20");

  if (isMorning || isEvening) {
    try {
      const res = await fetch("https://api.thaistock2d.com/live");
      const data = await res.json();
      const live2d = data.live.twod;

      if (live2d && live2d.length === 2) {
        const h = live2d[0]; const t = live2d[1];
        const key = isMorning ? "morning_stats" : "evening_stats";
        const stats = (await kv.get([key])).value as any || { heads: {}, tails: {}, last: "--", time: "" };

        stats.heads[h] = (stats.heads[h] || 0) + 1;
        stats.tails[t] = (stats.tails[t] || 0) + 1;
        stats.last = live2d;
        stats.time = mmTime;

        await kv.set([key], stats);
      }
    } catch (e) { /* API connection handle */ }
  }
}, 3000);

// --- Sleek UI Styles ---
const UI_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&display=swap');
  body { background: #050505; color: #e0e0e0; font-family: 'Inter', sans-serif; }
  .glass-card { background: rgba(20, 20, 20, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; }
  .live-dot { height: 8px; width: 8px; background-color: #ef4444; border-radius: 50%; display: inline-block; animation: blink 1s infinite; }
  @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
  .digit-font { font-family: 'Orbitron', sans-serif; }
  .hot-box { background: #1a1a1a; border: 1px solid #262626; border-radius: 12px; padding: 10px; }
  .btn-action { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000; font-weight: 800; border-radius: 12px; transition: 0.2s; }
`;

serve(async (req) => {
  const url = new URL(req.url);
  const adminPass = await getAdminPassword();

  // 1. PUBLIC VIEW (AUTO-UPDATE)
  if (url.pathname === "/" && req.method === "GET") {
    return new Response(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=1024">
      <title>Winner-Corner 2D Live</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>${UI_STYLE}</style>
    </head><body class="p-8">
      <div class="max-w-5xl mx-auto">
        <div class="flex justify-between items-center mb-12">
           <div><h1 class="text-4xl font-black tracking-tighter text-white uppercase digit-font">Winner-Corner <span class="text-yellow-500">2D</span></h1><p class="text-zinc-500 text-xs font-bold tracking-widest mt-1 uppercase">Advanced Real-Time Analytics</p></div>
           <div class="flex items-center gap-3 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800"><span class="live-dot"></span><span class="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live Engine Active</span></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div class="glass-card p-10 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-yellow-500/50"></div>
            <div class="flex justify-between items-start mb-8"><h3 class="text-zinc-400 font-black uppercase text-xs tracking-widest">Morning Session</h3><span class="text-[10px] text-zinc-600 font-mono">09:35 - 11:20</span></div>
            <div id="m-val" class="text-8xl digit-font font-black text-white mb-10 tracking-tighter">--</div>
            <div id="m-data" class="space-y-6"></div>
          </div>

          <div class="glass-card p-10 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-blue-500/50"></div>
            <div class="flex justify-between items-start mb-8"><h3 class="text-zinc-400 font-black uppercase text-xs tracking-widest">Evening Session</h3><span class="text-[10px] text-zinc-600 font-mono">14:05 - 15:20</span></div>
            <div id="e-val" class="text-8xl digit-font font-black text-white mb-10 tracking-tighter">--</div>
            <div id="e-data" class="space-y-6"></div>
          </div>
        </div>

        <footer class="mt-24 pt-10 border-t border-zinc-900 text-center"><p class="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.5em]">&copy; 2025 WINNER-CORNER ANALYTICS</p></footer>
      </div>

      <script>
        async function updateDashboard() {
          try {
            const r = await fetch('/api/stats'); const d = await r.json();
            ['morning', 'evening'].forEach(ses => {
              const s = d[ses + '_stats']; if(!s) return;
              const liveEl = document.getElementById(ses[0] + '-val'); 
              liveEl.innerText = s.last || '--'; liveEl.classList.add('text-white');
              
              const hTop = Object.entries(s.heads).sort((a,b)=>b[1]-a[1]).slice(0,4);
              const tTop = Object.entries(s.tails).sort((a,b)=>b[1]-a[1]).slice(0,4);
              
              document.getElementById(ses[0] + '-data').innerHTML = \`
                <div class="grid grid-cols-2 gap-4">
                  <div class="hot-box"><p class="text-[9px] text-zinc-500 uppercase font-black mb-3 tracking-tighter">Hot Heads (Top 4)</p>
                  <div class="flex flex-col gap-2">\${hTop.map(x => '<div class="flex justify-between text-sm"><span class="text-yellow-500 font-black">' + x[0] + '</span><span class="text-zinc-600 font-mono">' + x[1] + '</span></div>').join('')}</div></div>
                  <div class="hot-box"><p class="text-[9px] text-zinc-500 uppercase font-black mb-3 tracking-tighter">Hot Tails (Top 4)</p>
                  <div class="flex flex-col gap-2">\${tTop.map(y => '<div class="flex justify-between text-sm"><span class="text-blue-400 font-black">' + y[0] + '</span><span class="text-zinc-600 font-mono">' + y[1] + '</span></div>').join('')}</div></div>
                </div>\`;
            });
          } catch(e){}
        }
        setInterval(updateDashboard, 4000); updateDashboard();
      </script>
    </body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }

  // 2. ADMIN VIEW
  if (url.pathname === "/admin" && req.method === "GET") {
    let body = "";
    if (!adminPass) {
      body = `<div class="glass-card p-8 max-w-sm mx-auto"><input type="password" id="np" class="w-full p-4 bg-black border border-zinc-800 rounded-xl mb-4 outline-none" placeholder="Set Admin Key"><button onclick="setP()" class="btn-action w-full p-4 uppercase">Initialize Setup</button></div><script>async function setP(){ await fetch("/api/config",{method:"POST",body:JSON.stringify({p:document.getElementById("np").value})}); location.reload(); }</script>`;
    } else {
      body = `
        <div id="lbox" class="glass-card p-8 max-w-sm mx-auto text-center">
           <input type="password" id="ak" class="w-full p-4 bg-black border border-zinc-800 rounded-xl mb-4 outline-none" placeholder="Enter Key"><button onclick="doL()" class="btn-action w-full p-4 uppercase tracking-widest">Enter Admin</button>
        </div>
        <div id="dash" class="hidden text-center max-w-md mx-auto">
          <div class="glass-card p-10 border-t-4 border-red-600">
            <h3 class="text-red-500 font-black uppercase text-xs mb-4 tracking-widest">Wipe Live Stats</h3>
            <p class="text-zinc-500 text-xs mb-8 italic">Clear all head/tail frequency data for the new session.</p>
            <button onclick="doR()" class="bg-red-600/20 text-red-500 border border-red-900 w-full py-4 rounded-xl font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition">Reset All Frequency Data</button>
          </div>
          <button onclick="sessionStorage.clear();location.reload()" class="mt-12 text-zinc-600 text-[10px] underline uppercase tracking-[0.3em]">Logout Securely</button>
        </div>
        <script>
          const sk = sessionStorage.getItem('ak'); if(sk) { document.getElementById('lbox').classList.add('hidden'); document.getElementById('dash').classList.remove('hidden'); }
          async function doL(){ const v=document.getElementById('ak').value; const r=await fetch('/api/verify',{method:'POST',body:JSON.stringify({p:v})}); if(r.ok){sessionStorage.setItem('ak',v);location.reload();}else{alert('Denied!');} }
          async function doR(){ if(!confirm('Are you sure?'))return; await fetch('/api/reset',{method:'POST',body:JSON.stringify({k:sk})}); location.reload(); }
        </script>`;
    }
    return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=1024"><script src="https://cdn.tailwindcss.com"></script><style>${UI_STYLE}</style></head><body class="p-10 text-center"><h2 class="text-2xl font-black text-white mb-12 uppercase tracking-[0.4em] digit-font">Admin <span class="text-yellow-500">Dashboard</span></h2>${body}</body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }

  // 3. API ENDPOINTS
  if (url.pathname === "/api/stats" && req.method === "GET") {
    const m = (await kv.get(["morning_stats"])).value; const e = (await kv.get(["evening_stats"])).value;
    return new Response(JSON.stringify({ morning_stats: m, evening_stats: e }));
  }
  if (url.pathname === "/api/reset" && req.method === "POST") {
    const { k } = await req.json(); if (k !== adminPass) return new Response("Error", { status: 401 });
    await kv.delete(["morning_stats"]); await kv.delete(["evening_stats"]); return new Response("OK");
  }
  if (url.pathname === "/api/verify" && req.method === "POST") {
    const { p } = await req.json(); return p === adminPass ? new Response("OK") : new Response("Error", { status: 401 });
  }
  if (url.pathname === "/api/config" && req.method === "POST") {
    const { p } = await req.json(); await kv.set(["config", "admin_password"], p); return new Response("OK");
  }

  return new Response("Not Found", { status: 404 });
});
