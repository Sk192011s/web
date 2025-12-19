import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const kv = await Deno.openKv();

// --- High-Speed Background Logic (1-Second Interval) ---
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
      // ၁ စက္ကန့်တစ်ခါ Live ဒေတာဆွဲယူခြင်း
      const res = await fetch("https://api.thaistock2d.com/live");
      const data = await res.json();
      const live2d = data.live.twod;
      const apiTimestamp = data.live.time; // API မှ လာသော အချိန်အတိအကျ

      if (live2d && live2d.length === 2) {
        const key = isMorning ? "morning_stats" : "evening_stats";
        const stats = (await kv.get([key])).value as any || { heads: {}, tails: {}, last: "--", lastApiTime: "" };

        // API ကပေးတဲ့ အချိန်ပြောင်းမှသာ ဂဏန်းအသစ်ဟု သတ်မှတ်ပြီး Count တိုးခြင်း
        if (stats.lastApiTime !== apiTimestamp) {
          const h = live2d[0]; 
          const t = live2d[1];
          
          stats.heads[h] = (stats.heads[h] || 0) + 1;
          stats.tails[t] = (stats.tails[t] || 0) + 1;
          stats.last = live2d;
          stats.lastApiTime = apiTimestamp;
          
          await kv.set([key], stats);
        }
      }
    } catch (e) { /* API Offline Handle */ }
  }
}, 1000); // တစ်စက္ကန့်တစ်ခါ မပြတ်မကွက် စစ်ဆေးခြင်း

// --- UI Design (Optimized for Fast Updates) ---
const UI_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Inter:wght@400;700&display=swap');
  body { background: #030303; color: #fff; font-family: 'Inter', sans-serif; padding: 20px; }
  .v-card { background: #0a0a0a; border: 1px solid #151515; border-radius: 35px; margin-bottom: 30px; padding: 45px 30px; position: relative; }
  .tag { position: absolute; top: 25px; right: 30px; font-size: 8px; font-weight: 900; padding: 5px 12px; border-radius: 50px; letter-spacing: 1.5px; }
  .tag-live { background: #ff0000; color: #fff; animation: blink 1s infinite; }
  .tag-wait { background: #151515; color: #444; }
  @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
  .digit-display { font-family: 'Orbitron', sans-serif; font-size: 110px; font-weight: 900; text-align: center; margin: 30px 0; background: linear-gradient(180deg, #fff 0%, #333 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .stat-item { background: #0f0f0f; border-radius: 20px; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border: 1px solid #1a1a1a; }
`;

serve(async (req) => {
  const url = new URL(req.url);

  // 1. PUBLIC VIEW (AUTO-REFRESHING)
  if (url.pathname === "/" && req.method === "GET") {
    return new Response(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>2D Check - Realtime Tracker</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>${UI_STYLE}</style>
    </head><body>
      <div class="max-w-md mx-auto">
        <header class="text-center mb-12 pt-6">
          <h1 class="text-5xl font-black italic tracking-tighter uppercase text-white">2D <span class="text-yellow-500">CHECK</span></h1>
          <p class="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.5em] mt-2">Ultra-Fast Analytics Engine</p>
        </header>

        <div id="m-session" class="v-card">
          <div id="m-tag" class="tag tag-wait italic">Waiting</div>
          <h3 class="text-zinc-600 font-bold uppercase text-[10px] tracking-widest text-left">Morning Session</h3>
          <div id="m-val" class="digit-display">--</div>
          <div id="m-stats"></div>
        </div>

        <div id="e-session" class="v-card">
          <div id="e-tag" class="tag tag-wait italic">Waiting</div>
          <h3 class="text-zinc-600 font-bold uppercase text-[10px] tracking-widest text-left">Evening Session</h3>
          <div id="e-val" class="digit-display">--</div>
          <div id="e-stats"></div>
        </div>

        <footer class="text-center py-10 opacity-10"><p class="text-[8px] font-bold uppercase tracking-widest">&copy; 2025 2DCHECK.DENO.DEV</p></footer>
      </div>

      <script>
        function getStatus(start, end) {
          const t = new Date().toLocaleTimeString("en-GB", {timeZone: "Asia/Yangon", hour12: false}).substring(0,5);
          if (t >= start && t <= end) return 'LIVE';
          if (t > end) return 'FINISHED';
          return 'WAITING';
        }

        async function updateData() {
          try {
            const r = await fetch('/api/data'); const d = await r.json();
            const config = { morning: ["09:35", "11:20"], evening: ["14:05", "15:20"] };

            ['morning', 'evening'].forEach(ses => {
              const s = d[ses + '_stats'];
              const st = getStatus(config[ses][0], config[ses][1]);
              const tag = document.getElementById(ses[0] + '-tag');
              tag.innerText = st; tag.className = 'tag ' + (st === 'LIVE' ? 'tag-live' : 'tag-wait');

              if(s && s.last) {
                document.getElementById(ses[0] + '-val').innerText = s.last;
                const hTop = Object.entries(s.heads).sort((a,b)=>b[1]-a[1]).slice(0,4);
                const tTop = Object.entries(s.tails).sort((a,b)=>b[1]-a[1]).slice(0,4);
                
                document.getElementById(ses[0] + '-stats').innerHTML = \`
                  <div class="mt-8">
                    <p class="text-[8px] font-black text-zinc-700 uppercase mb-4 tracking-widest text-center">Top Frequency Hits</p>
                    <div class="grid grid-cols-2 gap-4">
                      <div>\${hTop.map(x => '<div class="stat-item"><span class="font-black text-xl text-yellow-500">' + x[0] + '</span><span class="text-zinc-600 text-[9px] font-black">' + x[1] + '</span></div>').join('')}</div>
                      <div>\${tTop.map(y => '<div class="stat-item" style="border-color:#1e3a8a"><span class="font-black text-xl text-blue-500">' + y[0] + '</span><span class="text-zinc-600 text-[9px] font-black">' + y[1] + '</span></div>').join('')}</div>
                    </div>
                  </div>\`;
              }
            });
          } catch(e) {}
        }
        setInterval(updateData, 2000); updateData();
      </script>
    </body></html>`, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
  }

  // 2. DATA API
  if (url.pathname === "/api/data" && req.method === "GET") {
    const m = (await kv.get(["morning_stats"])).value;
    const e = (await kv.get(["evening_stats"])).value;
    return new Response(JSON.stringify({ morning_stats: m, evening_stats: e }));
  }

  return new Response("Not Found", { status: 404 });
});
