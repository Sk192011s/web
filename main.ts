import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const kv = await Deno.openKv();

// Memory Lock to prevent duplicate increments during async window
let isProcessing = false;

// --- Background High-Speed Precise Tracking ---
setInterval(async () => {
  if (isProcessing) return; // စစ်ဆေးနေတုန်းဆိုရင် ထပ်မလုပ်ရန်
  
  const now = new Date();
  const mmTime = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Yangon", hour12: false });
  const currentTime = mmTime.substring(0, 5); // HH:MM

  // ညနေ ၆ နာရီမှ မနက် ၉ နာရီခွဲကြား ဒေတာကျန်နေလျှင် ဖျက်ပစ်မည့် logic
  if (currentTime >= "18:00" || currentTime < "09:30") {
    const m = await kv.get(["morning_stats"]);
    const e = await kv.get(["evening_stats"]);
    if (m.value || e.value) {
      await kv.delete(["morning_stats"]);
      await kv.delete(["evening_stats"]);
    }
    return; // Reset အချိန်အတွင်းဆိုလျှင် အောက်က Tracking logic တွေကို မလုပ်တော့ဘဲ ရပ်လိုက်မည်
  }
  const isMorning = (currentTime >= "09:30" && currentTime <= "11:35");
  const isEvening = (currentTime >= "14:01" && currentTime <= "15:35");

  if (isMorning || isEvening) {
    isProcessing = true;
    try {
      const res = await fetch("https://api.thaistock2d.com/live");
      const data = await res.json();
      const live2d = data.live.twod;

      if (live2d && live2d.length === 2) {
        const curH = live2d[0]; // Current Head Digit
        const curT = live2d[1]; // Current Tail Digit
        const key = isMorning ? "morning_stats" : "evening_stats";
        
        const stats = (await kv.get([key])).value as any || { 
          heads: {}, tails: {}, lastH: "", lastT: "", lastFull: "--" 
        };

        let hasChange = false;

        // Logic: အရင်ဂဏန်းနဲ့ အခုကျလာတဲ့ဂဏန်း လုံးဝမတူမှသာ ၁ ကြိမ်တိုးခြင်း
        if (curH !== stats.lastH) {
          stats.heads[curH] = (stats.heads[curH] || 0) + 1;
          stats.lastH = curH;
          hasChange = true;
        }

        if (curT !== stats.lastT) {
          stats.tails[curT] = (stats.tails[curT] || 0) + 1;
          stats.lastT = curT;
          hasChange = true;
        }

        if (hasChange) {
          stats.lastFull = live2d;
          await kv.set([key], stats);
        }
      }
    } catch (e) { /* Error Handling */ }
    isProcessing = false;
  }
}, 1000); // ၁ စက္ကန့်တစ်ခါ အတိအကျ စစ်ဆေးခြင်း

// --- Super Compact Mobile UI Design ---
const UI_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Inter:wght@400;700&display=swap');
  body { background: #0f172a; color: #f1f5f9; font-family: 'Inter', sans-serif; padding: 10px; overflow-x: hidden; }
  .v-card { background: #1e293b; border: 1px solid #334155; border-radius: 18px; margin-bottom: 8px; padding: 12px 18px; position: relative; }
  .tag { position: absolute; top: 12px; right: 15px; font-size: 6px; font-weight: 900; padding: 2px 8px; border-radius: 50px; letter-spacing: 0.5px; }
  .tag-live { background: #ef4444; color: #fff; animation: blink 1.2s infinite; }
  .tag-off { background: #334155; color: #94a3b8; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .main-val { font-family: 'Orbitron', sans-serif; font-size: 48px; font-weight: 900; text-align: center; margin: 5px 0; color: #f3ca52; }
  .hit-row { background: #0f172a; border-radius: 8px; padding: 5px 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; border-left: 3px solid; }
  .title-area { text-align: center; margin-bottom: 12px; }
`;

serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/" && req.method === "GET") {
    return new Response(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>2D Check - Reliable</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>${UI_STYLE}</style>
    </head><body>
      <div class="max-w-sm mx-auto">
        <div class="title-area">
          <h1 class="text-2xl font-black italic tracking-tighter uppercase">2D <span class="text-yellow-500">Check</span></h1>
          <p class="text-[7px] font-bold text-slate-500 uppercase tracking-[0.3em]">No-Repeat Counting Engine</p>
        </div>

        <div id="m-session" class="v-card">
          <div id="m-tag" class="tag tag-off italic">Wait</div>
          <h3 class="text-slate-400 font-bold uppercase text-[8px] tracking-widest text-left">Morning</h3>
          <div id="m-val" class="main-val">--</div>
          <div id="m-stats"></div>
        </div>

        <div id="e-session" class="v-card">
          <div id="e-tag" class="tag tag-off italic">Wait</div>
          <h3 class="text-slate-400 font-bold uppercase text-[8px] tracking-widest text-left">Evening</h3>
          <div id="e-val" class="main-val">--</div>
          <div id="e-stats"></div>
        </div>

        <footer class="text-center py-2 opacity-10 text-[6px] font-bold uppercase tracking-widest">&copy; 2025 2DCHECK.DENO.DEV</footer>
      </div>

      <script>
        function checkStatus(s, e) {
          const t = new Date().toLocaleTimeString("en-GB", {timeZone: "Asia/Yangon", hour12: false}).substring(0,5);
          if (t >= s && t <= e) return 'LIVE';
          if (t > e) return 'CLOSED';
          return 'WAIT';
        }

        async function updateUI() {
          try {
            const r = await fetch('/api/data'); const d = await r.json();
            const config = { morning: ["09:35", "11:20"], evening: ["14:05", "15:20"] };

            ['morning', 'evening'].forEach(ses => {
              const s = d[ses + '_stats'];
              const st = checkStatus(config[ses][0], config[ses][1]);
              const tag = document.getElementById(ses[0] + '-tag');
              tag.innerText = st; tag.className = 'tag ' + (st === 'LIVE' ? 'tag-live' : 'tag-off');

              if(s && s.lastFull) {
                document.getElementById(ses[0] + '-val').innerText = s.lastFull;
                const hT = Object.entries(s.heads).sort((a,b)=>b[1]-a[1]).slice(0,4);
                const tT = Object.entries(s.tails).sort((a,b)=>b[1]-a[1]).slice(0,4);
                
                document.getElementById(ses[0] + '-stats').innerHTML = \`
                  <div class="grid grid-cols-2 gap-2 mt-2">
                    <div><p class="text-[6px] font-black text-slate-500 uppercase mb-1">Heads</p>
                    \${hT.map(x => '<div class="hit-row border-yellow-500/50"><span class="font-black text-slate-100 text-xs">' + x[0] + '</span><span class="text-slate-500 text-[8px] font-bold">' + x[1] + '</span></div>').join('')}</div>
                    <div><p class="text-[6px] font-black text-slate-500 uppercase mb-1">Tails</p>
                    \${tT.map(y => '<div class="hit-row border-blue-500/50"><span class="font-black text-slate-100 text-xs">' + y[0] + '</span><span class="text-slate-500 text-[8px] font-bold">' + y[1] + '</span></div>').join('')}</div>
                  </div>\`;
              }
            });
          } catch(e) {}
        }
        setInterval(updateUI, 2000); updateUI();
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
