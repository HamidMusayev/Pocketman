import random, datetime as dt, requests
B="http://localhost:8000/api"; random.seed(7)
r=requests.post(B+"/auth/register",json={"username":"demouser","password":"DemoPass!2026"})
if r.status_code>=400: r=requests.post(B+"/auth/login",json={"username":"demouser","password":"DemoPass!2026"})
H={"Authorization":"Bearer "+r.json()["token"]}
def P(p,j): x=requests.post(B+p,json=j,headers=H); assert x.status_code<300,(p,x.text); return x.json()
def G(p): return requests.get(B+p,headers=H).json()
requests.put(B+"/settings",json={"currency_symbol":"₼"},headers=H)
acc={a["name"]:a["id"] for a in G("/accounts")}
main=acc["Main"]
bank=P("/accounts",{"name":"Kapital Bank","type":"card","icon":"card","opening_balance":"1850.00"})["id"]
sav=P("/accounts",{"name":"Savings","type":"savings","icon":"bank","opening_balance":"4200.00"})["id"]
cats={c["name"]:c for c in G("/categories")}
budgets={"Food":450,"Dining":180,"Transport":90,"Entertainment":120,"Utilities":160,"Subscriptions":40,"Fuel":150}
for n,b in budgets.items(): requests.put(B+f"/categories/{cats[n]['id']}",json={"budget":f"{b}.00"},headers=H)
C=lambda n: cats[n]["id"]
today=dt.date(2026,11,23); start=dt.date(2026,7,1)
def T(t,amt,desc,cat,d,a=None,tags=None,note=None,to=None):
    j={"type":t,"amount":f"{amt:.2f}","description":desc,"account_id":a or bank,"date":d.isoformat(),"tags":tags or []}
    if note:j["note"]=note
    if to: j["transfer_account_id"]=to
    else: j["category_id"]=C(cat)
    P("/transactions",j)
d=start
shops=["Bravo","Araz Market","Bazarstore","OBA Market"]
cafes=["Coffee Moffie","Mado","Firuze","Pasifico","Wolt order"]
while d<=today:
    if d.day==1:
        T("income",2400,"Monthly salary","Salary",d,tags=["work"])
        T("expense",650,"Rent","Housing",d)
        T("transfer",300,"Move to savings",None,d,to=sav)
    if d.day==5: T("expense",random.uniform(70,140),"Electricity & gas","Utilities",d)
    if d.day==8: T("expense",11.99,"Netflix","Subscriptions",d); T("expense",9.99,"Spotify","Subscriptions",d)
    if d.day==15 and d.month%2==0: T("income",random.choice([380,520,640]),"Logo design project","Freelance",d,tags=["side-project"])
    if d.day in(10,24): T("expense",random.uniform(55,80),"Fuel - SOCAR","Fuel",d)
    if d.weekday() in(1,5): T("expense",random.uniform(25,85),random.choice(shops),"Food",d)
    if d.weekday() in(4,6) or random.random()<.15: T("expense",random.uniform(8,38),random.choice(cafes),"Dining",d,a=random.choice([bank,main]))
    if random.random()<.35: T("expense",random.uniform(0.6,9),random.choice(["Metro","Bolt ride","Bus"]),"Transport",d,a=main)
    if random.random()<.06: T("expense",random.uniform(15,45),random.choice(["Cinema","Concert ticket","Bowling"]),"Entertainment",d)
    if d.day==20: T("expense",45,"Gym membership","Fitness",d)
    if random.random()<.03: T("expense",random.uniform(20,70),"Pharmacy","Healthcare",d)
    d+=dt.timedelta(days=1)
T("expense",480,"Flight to Istanbul","Travel",dt.date(2026,9,12),tags=["vacation"],note="Autumn trip")
T("expense",320,"Hotel","Travel",dt.date(2026,9,13),tags=["vacation"])
P("/recurring",{"description":"Rent","amount":"650.00","category_id":C("Housing"),"account_id":bank,"type":"expense","frequency":"Monthly","start_date":"2026-12-01"})
P("/recurring",{"description":"Netflix","amount":"11.99","category_id":C("Subscriptions"),"account_id":bank,"type":"expense","frequency":"Monthly","start_date":"2026-11-23"})
P("/recurring",{"description":"Gym membership","amount":"45.00","category_id":C("Fitness"),"account_id":bank,"type":"expense","frequency":"Monthly","start_date":"2026-11-22"})
P("/recurring",{"description":"Salary","amount":"2400.00","category_id":C("Salary"),"account_id":bank,"type":"income","frequency":"Monthly","start_date":"2026-12-01","auto_approve":True})
requests.post(B+"/recurring/catch-up",headers=H)
P("/goals",{"name":"New laptop","target_amount":"2500.00","saved_amount":"1650.00","target_date":"2027-03-01","icon":"target"})
P("/goals",{"name":"Summer trip","target_amount":"3000.00","saved_amount":"900.00","target_date":"2027-06-15","icon":"travel"})
P("/goals",{"name":"Emergency fund","target_amount":"6000.00","saved_amount":"4200.00","icon":"savings"})
print("ok",len(G("/transactions?limit=500")))
