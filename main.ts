import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const kv = await Deno.openKv();

// --- Background Logic: Accurate Independent Tracking ---
setInterval(async () => {
  const now = new Date();
  const mmTime = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Yangon", hour12: false });
  const currentTime = mmTime.substring(0, 5); // HH:MM

  // ညနေ ၆ နာရီ Auto Reset
  if (currentTime === "18:00") {
    await kv.delete(["morning_stats"]);
    await kv.delete(["evening_stats"]);
    return;
  }

  const isMorning = (currentTime >= "09:35" && currentTime <= "11:20");
  const isEvening = (currentTime >= "14:05" && currentTime <= "15:20");

  if (isMorning || isEvening) {
    try {
      const res = await fetch("https://api.thaistock2d.com/live");
      const data = await res.json();
      const live2d = data.live.twod;

      if (live2d && live2d.length === 2) {
        const curH = live2d[0]; // Current Head
        const curT = live2d[1]; // Current Tail
        const key = isMorning ? "morning_stats" : "evening_stats";
        
        const stats = (await kv.get([key])).value as any || { 
          heads: {}, tails: {}, 
          lastH: "", lastT: "", 
          lastFull: "--" 
        };

        let updated = false;

        // ၁။ ထိပ်စီး ပြောင်းလဲမှုရှိမှသာ တိုးခြင်း
        if (curH !== stats.lastH) {
          stats.heads[curH] = (stats.heads[curH] || 0) + 1;
          stats.lastH = curH;
          updated = true;
        }

        // ၂။ နောက်ပိတ် ပြောင်းလဲမှုရှိမှသာ တိုးခြင်း
        if (curT !== stats.lastT) {
          stats.tails[curT] = (stats.tails[curT] || 0) + 1;
          stats.lastT = curT;
          updated = true;
        }

        if (updated) {
          stats.lastFull = live2d;
          await kv.set([key], stats);
        }
      }
    } catch (e) { /* Error */ }
  }
}, 1000); // ၁ စက္ကန့်တစ်ခါ အတိအကျ စစ်ဆေးခြင်း

// --- UI Design: Compact Slate Theme (Vertical) ---
const UI_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Inter:wght@400;700&display=swap');
  body { background: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif; padding: 15px; }
  .v-card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; margin-bottom: 12px; padding: 15px 20px; position: relative; }
  .tag { position: absolute; top: 12px; right: 15px; font-size: 7px; font-weight: 900; padding: 2px 8px; border-radius: 50px; letter-spacing: 1px; }
  .tag-live { background: #ef4444; color: #fff; animation: blink 1s infinite; }
  .tag-off { background: #334155; color: #64748b; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .main-val { font-family: 'Orbitron', sans-serif; font-size: 60px; font-weight: 900; text-align: center; margin: 10px 0; color: #f3ca52; }
  .hot-box { background: #0f172a; border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-left: 3px solid; }
`;

serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/" && req.method === "GET") {
    return new Response(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>2D Check - Live</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>${UI_STYLE}</style>
    </head><body>
      <div class="max-w-sm mx-auto">
        <header class="text-center mb-4 mt-2">
          <h1 class="text-2xl font-black italic tracking-tighter uppercase">2D <span class="text-yellow-500">Check</span></h1>
          <p class="text-[7px] font-bold text-slate-500 uppercase tracking-[0.4em]">Independent Digit Tracker</p>
        </header>

        <div id="m-session" class="v-card">
          <div id="m-tag" class="tag tag-off italic">Wait</div>
          <h3 class="text-slate-400 font-bold uppercase text-[8px] tracking-widest text-left">Morning Analytics</h3>
          <div id="m-val" class="main-val">--</div>
          <div id="m-stats"></div>
        </div>

        <div id="e-session" class="v-card">
          <div id="e-tag" class="tag tag-off italic">Wait</div>
          <h3 class="text-slate-400 font-bold uppercase text-[8px] tracking-widest text-left">Evening Analytics</h3>
          <div id="e-val" class="main-val">--</div>
          <div id="e-stats"></div>
        </div>

        <footer class="text-center py-4 opacity-10"><p class="text-[6px] font-bold uppercase tracking-widest">&copy; 2025 2DCHECK.DENO.DEV</p></footer>
      </div>

      <script>
        function checkSt(start, end) {
          const t = new Date().toLocaleTimeString("en-GB", {timeZone: "Asia/Yangon", hour12: false}).substring(0,5);
          if (t >= start && t <= end) return 'LIVE';
          if (t > end) return 'CLOSED';
          return 'WAITING';
        }

        async function update() {
          try {
            const r = await fetch('/api/data'); const d = await r.json();
            const config = { morning: ["09:35", "11:20"], evening: ["14:05", "15:20"] };

            ['morning', 'evening'].forEach(ses => {
              const s = d[ses + '_stats'];
              const st = checkSt(config[ses][0], config[ses][1]);
              const tag = document.getElementById(ses[0] + '-tag');
              tag.innerText = st; tag.className = 'tag ' + (st === 'LIVE' ? 'tag-live' : 'tag-off');

              if(s && s.lastFull) {
                document.getElementById(ses[0] + '-val').innerText = s.lastFull;
                const hT = Object.entries(s.heads).sort((a,b)=>b[1]-a[1]).slice(0,4);
                const tT = Object.entries(s.tails).sort((a,b)=>b[1]-a[1]).slice(0,4);
                
                document.getElementById(ses[0] + '-stats').innerHTML = \`
                  <div class="grid grid-cols-2 gap-2 mt-4">
                    <div><p class="text-[7px] font-black text-slate-500 uppercase mb-1">Heads</p>
                    \${hT.map(x => '<div class="hot-box border-yellow-500/50"><span class="font-black text-slate-100 text-xs">' + x[0] + '</span><span class="text-slate-500 text-[8px] font-bold">' + x[1] + '</span></div>').join('')}</div>
                    <div><p class="text-[7px] font-black text-slate-500 uppercase mb-1">Tails</p>
                    \${tT.map(y => '<div class="hot-box border-blue-500/50"><span class="font-black text-slate-100 text-xs">' + y[0] + '</span><span class="text-slate-500 text-[8px] font-bold">' + y[1] + '</span></div>').join('')}</div>
                  </div>\`;
              }
            });
          } catch(e) {}
        }
        setInterval(update, 2000); update();
      </script>
    </body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }

  if (url.pathname === "/api/data" && req.method === "GET") {
    const m = (await kv.get(["morning_stats"])).value;
    const e = (await kv.get(["evening_stats"])).value;
    return new Response(JSON.stringify({ morning_stats: m, evening_stats: e }));
  }

  return new Response("Not Found", { status: 404 });
});
