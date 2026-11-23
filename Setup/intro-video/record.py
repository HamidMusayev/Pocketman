import sys, asyncio, base64, os, json
from playwright.async_api import async_playwright
OUT=sys.argv[1]; U="http://localhost:5173"; os.makedirs(OUT,exist_ok=True)
CSS="""
#pm-cap{position:fixed;left:50%;bottom:34px;transform:translate(-50%,20px);opacity:0;z-index:99999;
 background:rgba(14,15,19,.92);border:1px solid rgba(252,213,53,.35);border-radius:16px;padding:14px 26px;
 font-family:var(--sans),system-ui,sans-serif;color:#fff;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.55);
 transition:opacity .45s ease,transform .45s ease;max-width:860px;backdrop-filter:blur(8px)}
#pm-cap.on{opacity:1;transform:translate(-50%,0)}
#pm-cap b{display:block;color:#FCD535;font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:5px}
#pm-cap span{font-size:24px;font-weight:600;letter-spacing:-.01em}
#pm-card{position:fixed;inset:0;z-index:100000;background:radial-gradient(900px 500px at 30% 20%,rgba(252,213,53,.16),transparent 60%),#0b0c0f;
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#fff;font-family:var(--sans),system-ui,sans-serif;
 opacity:0;transition:opacity .6s ease}
#pm-card.on{opacity:1}
#pm-card .lg{display:flex;align-items:center;gap:14px;font-size:44px;font-weight:700;letter-spacing:-.02em}
#pm-card .lg i{width:64px;height:64px;border-radius:16px;background:#FCD535;display:grid;place-items:center}
#pm-card .lg em{font-style:normal;color:#FCD535}
#pm-card h1{font-size:40px;margin:6px 0 0;font-weight:700;letter-spacing:-.02em;text-align:center}
#pm-card p{font-size:21px;color:#a8adb7;margin:0;text-align:center;max-width:760px;line-height:1.45}
#pm-card .cta{margin-top:10px;background:#FCD535;color:#181a20;font-weight:700;font-size:20px;padding:14px 30px;border-radius:12px}
"""
LOGO='<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#181a20" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h13a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="M21 11.5h-6a2 2 0 0 0 0 4h6v-4Z"/></svg>'
frames=[]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox","--hide-scrollbars"])
    ctx=await b.new_context(viewport={"width":1280,"height":720})
    pg=await ctx.new_page()
    await pg.goto(U+"/login"); await pg.fill("#username","demouser"); await pg.fill("#password","DemoPass!2026")
    await pg.click("button[type=submit]"); await pg.wait_for_url("**/overview"); await pg.wait_for_timeout(1500)
    async def inject():
      await pg.add_style_tag(content=CSS)
      await pg.evaluate("()=>{if(!document.getElementById('pm-cap')){const d=document.createElement('div');d.id='pm-cap';document.body.appendChild(d)}}")
    async def nav(path):
      await pg.evaluate("()=>{const c=document.getElementById('pm-cap');if(c)c.classList.remove('on')}"); await pg.wait_for_timeout(350)
      await pg.click(f"nav.topbar-tabs a[href='{path}']") if await pg.locator(f"nav.topbar-tabs a[href='{path}']").count() else await pg.goto(U+path)
      await pg.wait_for_timeout(200); await pg.evaluate("window.scrollTo(0,0)"); await pg.wait_for_timeout(700); await inject()
    async def cap(k,t):
      await pg.evaluate("([k,t])=>{const c=document.getElementById('pm-cap');c.classList.remove('on');setTimeout(()=>{c.innerHTML='<b>'+k+'</b><span>'+t+'</span>';c.classList.add('on')},k?250:0)}",[k,t])
    async def uncap(): await pg.evaluate("()=>document.getElementById('pm-cap').classList.remove('on')")
    async def card(html,ms):
      await pg.evaluate("(h)=>{let c=document.getElementById('pm-card');if(!c){c=document.createElement('div');c.id='pm-card';document.body.appendChild(c)};c.innerHTML=h;requestAnimationFrame(()=>c.classList.add('on'))}",html)
      await pg.wait_for_timeout(ms)
    async def uncard(): await pg.evaluate("()=>{const c=document.getElementById('pm-card');c.classList.remove('on');setTimeout(()=>c.remove(),700)}"); await pg.wait_for_timeout(700)
    async def wheel(dy,steps=30,ms=40):
      for _ in range(steps): await pg.mouse.wheel(0,dy/steps); await pg.wait_for_timeout(ms)
    W=pg.wait_for_timeout
    await inject(); await pg.mouse.move(900,300)
    cdp=await ctx.new_cdp_session(pg)
    def on_frame(ev):
      frames.append((ev["metadata"]["timestamp"],ev["data"]))
      asyncio.ensure_future(cdp.send("Page.screencastFrameAck",{"sessionId":ev["sessionId"]}))
    cdp.on("Page.screencastFrame",on_frame)
    # opening card is shown before screencast starts so the first frame is the card
    await card(f'<div class="lg"><i>{LOGO}</i><span>pocket<em>man</em></span></div><h1>Your personal finance tracker</h1><p>Income, expenses, budgets and savings goals in one private place.</p>',300)
    await cdp.send("Page.startScreencast",{"format":"jpeg","quality":88,"maxWidth":1280,"maxHeight":720,"everyNthFrame":1})
    await W(3200); await uncard()
    await cap("Overview","Your balance, income and spending at a glance"); await W(2800)
    await pg.mouse.move(980,360); await wheel(420,35); await W(800); await wheel(-420,20,25); await W(500)
    await cap("Add in seconds","Log income, expenses or transfers between accounts")
    await W(600); await pg.click("text=Add transaction"); await W(700)
    await pg.locator("[aria-label=Amount]").press_sequentially("12.50",delay=120)
    await pg.locator("[aria-label=Description]").press_sequentially("Coffee with friends",delay=55)
    await pg.locator(".add-chip:has-text('Dining')").first.click(); await W(1800)
    await pg.keyboard.press("Escape"); await W(600)
    if await pg.locator(".modal, [role=dialog]").count(): await pg.mouse.click(40,700); await W(500)
    await pg.evaluate("window.scrollTo(0,0)"); await cap("Recurring payments","Bills and salary arrive on time and wait for your OK"); await W(700)
    await pg.click(".pending-panel-head"); await W(3200); await pg.click(".pending-panel-head"); await W(500)
    await nav("/charts"); await cap("Charts","See where your money goes, day by day"); await W(2600)
    await pg.mouse.move(640,420); await wheel(520,40); await cap("Trends","Income vs expenses and your balance over time"); await W(3000)
    await nav("/budget"); await cap("Budgets","Set limits per category and get alerts before you overspend"); await W(2600); await pg.mouse.move(900,420); await wheel(260,25); await W(1400)
    await nav("/accounts"); await cap("Accounts & goals","Net worth across cash, cards and savings"); await W(2400)
    await pg.mouse.move(640,420); await wheel(480,35); await cap("Savings goals","Know how much to put aside each month"); await W(2800)
    await uncap(); await W(350); await pg.goto(U+"/report"); await W(900); await inject()
    await cap("Monthly report","Compare with last month, then save it as PDF"); await W(3400)
    await nav("/overview"); await pg.click("[aria-label^='Switch to']"); await W(300)
    await cap("Your style","Dark or light theme, accent color and currency"); await W(2600)
    await pg.click("[aria-label^='Switch to']"); await W(600); await uncap(); await W(300)
    await card(f'<div class="lg"><i>{LOGO}</i><span>pocket<em>man</em></span></div><h1>Private. Secure. Simple.</h1><p>Passwords hashed with bcrypt. No bank connection, no ads.<br>Your numbers stay in your account.</p><div class="cta">Create your free account</div>',3800)
    await cdp.send("Page.stopScreencast"); await W(300)
    end=frames[-1][0]+0.1
    lst=[]
    for i,(ts,data) in enumerate(frames):
      fn=f"{OUT}/f{i:05d}.jpg"; open(fn,"wb").write(base64.b64decode(data))
      nxt=frames[i+1][0] if i+1<len(frames) else ts+2.5
      lst.append(f"file '{fn}'\nduration {max(nxt-ts,0.001):.4f}")
    lst.append(f"file '{OUT}/f{len(frames)-1:05d}.jpg'")
    open(f"{OUT}/list.txt","w").write("\n".join(lst))
    print(len(frames),"frames", frames[-1][0]-frames[0][0],"s")
    await b.close()
asyncio.run(main())
