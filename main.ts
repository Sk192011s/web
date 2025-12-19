import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const kv = await Deno.openKv();

// --- Background Logic: Tracking & Auto-Reset ---
setInterval(async () => {
  const now = new Date();
  const mmTime = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Yangon", hour12: false });
  const currentTime = mmTime.substring(0, 5); // HH:MM

  // ၁။ ညနေ ၆ နာရီမှာ ဒေတာ အလိုအလျောက် Reset လုပ်ခြင်း
  if (currentTime === "18:00") {
    await kv.delete(["morning_stats"]);
    await kv.delete(["evening_stats"]);
    return;
  }

  // ၂။ ပွဲချိန်အတွင်း Live Tracking လုပ်ခြင်း
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
        const stats = (await kv.get([key])).value as any || { heads: {}, tails: {}, last: "", lastChange: "" };

        // ဂဏန်း အမှန်တကယ် ပြောင်းလဲမှသာ Count တိုးခြင်း
        if (stats.lastChange !== data.live.time) {
          stats.heads[h] = (stats.heads[h] || 0) + 1;
          stats.tails[t] = (stats.tails[t] || 0) + 1;
          stats.last = live2d;
          stats.lastChange = data.live.time;
          await kv.set([key], stats);
        }
      }
    } catch (e) { /* API Offline handle */ }
  }
}, 3000);

// --- UI Design (Mobile Vertical Sleek) ---
const UI_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Inter:wght@400;700&display=swap');
  body { background: #080808; color: #fff; font-family: 'Inter', sans-serif; padding: 20px; }
  .v-card { background: #121212; border: 1px solid #222; border-radius: 28px; margin-bottom: 30px; padding: 35px; position: relative; }
  .status-tag { position: absolute; top: 20px; right: 25px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 50px; }
  .status-live { background: #ef4444; color: #fff; animation: pulse 1.5s infinite; }
  .status-closed { background: #222; color: #555; }
  @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
  .big-digit { font-family: 'Orbitron', sans-serif; font-size: 100px; line-height: 1; margin: 20px 0; background: linear-gradient(180deg, #fff 0%, #444 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .hot-row { background: #1a1a1a; border-radius: 15px; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-left: 3px solid; }
`;

serve(async (req) => {
  const url = new URL(req.url);

  // 1. PUBLIC VIEW (AUTO-RELOADING DATA)
  if (url.pathname === "/" && req.method === "GET") {
    return new Response(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Winner-Corner Live</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>${UI_STYLE}</style>
    </head><body>
      <div class="max-w-md mx-auto">
        <header class="text-center mb-10 pt-4">
          <h1 class="text-3xl font-black italic tracking-tighter uppercase text-yellow-500">Winner-Corner</h1>
          <p class="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Real-time 2D Engine</p>
        </header>

        <div id="morning-session" class="v-card">
          <div id="m-tag" class="status-tag status-closed">Checking...</div>
          <h3 class="text-zinc-500 font-black uppercase text-[11px] tracking-widest">Morning (09:35 - 11:20)</h3>
          <div id="m-val" class="big-digit text-center">--</div>
          <div id="m-stats" class="space-y-3"></div>
        </div>

        <div id="evening-session" class="v-card">
          <div id="e-tag" class="status-tag status-closed">Checking...</div>
          <h3 class="text-zinc-500 font-black uppercase text-[11px] tracking-widest">Evening (14:05 - 15:20)</h3>
          <div id="e-val" class="big-digit text-center">--</div>
          <div id="e-stats" class="space-y-3"></div>
        </div>

        <footer class="text-center pb-10 opacity-30">
          <p class="text-[9px] font-bold uppercase tracking-widest">&copy; 2025 Winner-Corner 2D Live</p>
        </footer>
      </div>

      <script>
        function getTimeStatus(start, end) {
          const now = new Date();
          const t = now.toLocaleTimeString("en-GB", {timeZone: "Asia/Yangon", hour12: false}).substring(0,5);
          if (t >= start && t <= end) return 'LIVE';
          if (t > end) return 'FINISHED';
          return 'WAITING';
        }

        async function updateLive() {
          const r = await fetch('/api/stats'); const d = await r.json();
          const configs = { morning: ["09:35", "11:20"], evening: ["14:05", "15:20"] };

          ['morning', 'evening'].forEach(ses => {
            const s = d[ses + '_stats'];
            const status = getTimeStatus(configs[ses][0], configs[ses][1]);
            const tag = document.getElementById(ses[0] + '-tag');
            
            tag.innerText = status;
            tag.className = 'status-tag ' + (status === 'LIVE' ? 'status-live' : 'status-closed');

            if(s && s.last) {
              document.getElementById(ses[0] + '-val').innerText = s.last;
              const hTop = Object.entries(s.heads).sort((a,b)=>b[1]-a[1]).slice(0,4);
              const tTop = Object.entries(s.tails).sort((a,b)=>b[1]-a[1]).slice(0,4);
              
              document.getElementById(ses[0] + '-stats').innerHTML = \`
                <div class="mt-6"><p class="text-[9px] font-black text-zinc-600 uppercase mb-2">Hot Heads</p>
                \${hTop.map(x => '<div class="hot-row border-yellow-500/50"><span class="font-black text-lg">' + x[0] + '</span><span class="text-zinc-500 text-xs font-bold">' + x[1] + ' times</span></div>').join('')}</div>
                <div class="mt-6"><p class="text-[9px] font-black text-zinc-600 uppercase mb-2">Hot Tails</p>
                \${tTop.map(y => '<div class="hot-row border-blue-500/50"><span class="font-black text-lg">' + y[0] + '</span><span class="text-zinc-500 text-xs font-bold">' + y[1] + ' times</span></div>').join('')}</div>\`;
            }
          });
        }
        setInterval(updateLive, 4000); updateLive();
      </script>
    </body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }

  // 2. API HANDLER
  if (url.pathname === "/api/stats" && req.method === "GET") {
    const m = (await kv.get(["morning_stats"])).value;
    const e = (await kv.get(["evening_stats"])).value;
    return new Response(JSON.stringify({ morning_stats: m, evening_stats: e }));
  }

  if (url.pathname === "/api/config" && req.method === "POST") {
    const { p } = await req.json(); await kv.set(["config", "admin_password"], p); return new Response("OK");
  }

  return new Response("Not Found", { status: 404 });
});
