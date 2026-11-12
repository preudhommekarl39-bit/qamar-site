# Génère les guides SEO de guides/ (pages statiques EN). Modifier les textes ici puis : python3 scripts/guides.py
import json, html
SITE = 'https://qamarlounge.com/'
G = [
 dict(slug='get-ready-after-work-dubai', title='Where to Get Ready After Work in Dubai (Near Sheikh Zayed Road)',
  desc='Dinner straight after the office? How to go from desk to evening in under an hour in Dubai: shower, outfit, hair, and where to do it near Sheikh Zayed Road.',
  h1='Where to get ready after work in Dubai', img='step-shower.webp',
  body=[('p','Dinner is at eight. You leave the office at seven. Going home to Al Barsha or the Marina and back again eats the whole hour, and Sheikh Zayed Road traffic decides the rest.'),
   ('h2','What you actually need in one hour'),
   ('ul',['A shower, so you feel fresh after a full day in the heat.','Your outfit without creases. Clothes folded in a bag all day need steam.','Your hair done. A blow-dry changes how the whole look reads.','Five calm minutes and a drink before you head out.']),
   ('h2','The usual options, and where they fall short'),
   ('p','A gym changing room gives you a shower but no styling. A salon gives you a blow-dry but usually no shower, and many need a booking. Hotel spas do both, at a hotel-spa price and pace.'),
   ('h2','How QAMAR does it'),
   ('p','QAMAR is a women-only lounge opening in March 2027, off Sheikh Zayed Road between Mall of the Emirates and DIFC. You walk in without an appointment. While you shower, a second person steams and lightly perfumes your dress, abaya or hijab. Then you sit down for your blow-dry and your drink arrives: coffee, tea, matcha, fresh juice or something iced. Forty-five minutes at most.'),
   ('h2','Tips for the evening'),
   ('ul',['Keep a small bag at the office: underwear, deodorant, shoes, a light layer for air-conditioned restaurants.','Roll the dress instead of folding it. It creases less.','Ask for a sleek or bouncy blow-dry if you will be outside: both hold better than loose waves in humidity.'])]),
 dict(slug='blow-dry-dubai-humidity', title='How to Make a Blow-Dry Last in Dubai Humidity',
  desc='Dubai humidity ruins a blow-dry fast. Practical tips to keep your hair smooth longer: which style to choose, what to ask your stylist, and what to avoid.',
  h1='How to make a blow-dry last in Dubai humidity', img='step-hair.webp',
  body=[('p','From May to October, Dubai humidity can undo a fresh blow-dry in the time it takes to walk from the car to the restaurant. Here is what helps.'),
   ('h2','Choose a style that holds'),
   ('ul',['Sleek and straight lasts longest, as long as the hair is fully dry at the root.','A bouncy round-brush blow-dry keeps its shape better than loose waves.','Defined curls set with a diffuser handle humidity well because they already have their natural shape.']),
   ('h2','What to ask your stylist'),
   ('ul',['Dry the roots completely. Damp roots are the first place frizz starts.','Use a light anti-humidity spray at the end, not a heavy oil that weighs the hair down.','Finish with a cool shot of air to set the shape.']),
   ('h2','During the evening'),
   ('ul',['Keep a small claw clip in your bag for the walk outside.','Do not touch your hair too often. Hands add moisture.','Go from car to inside quickly in summer: five minutes outdoors at night can be enough to lift the roots.']),
   ('h2','At QAMAR'),
   ('p','Our four signature looks (Midnight Sleek, Qamar Glow, Marina Waves and Desert Curls) are done by an all-female team, in 45 minutes at most, without an appointment. Opening March 2027 off Sheikh Zayed Road.')]),
 dict(slug='steam-abaya-hijab', title='Steaming vs Ironing Your Abaya and Hijab: What Works Best',
  desc='Should you steam or iron your abaya and hijab? Which fabrics need what, how to remove creases fast, and how to keep a light scent without staining.',
  h1='Steaming vs ironing your abaya and hijab', img='step-outfit.webp',
  body=[('p','An abaya that spent the day folded in a bag, or a hijab creased from the car seat, can make a whole outfit look tired. Steam usually fixes it faster than an iron, and more gently.'),
   ('h2','When to steam'),
   ('ul',['Crepe, nida and chiffon abayas: steam relaxes the creases without leaving a shine.','Chiffon and jersey hijabs: steam keeps the drape soft.','Embellished pieces: steam from inside, so beads and embroidery are never pressed.']),
   ('h2','When to iron'),
   ('ul',['Cotton and linen that need a sharp line.','Always on low heat with a pressing cloth for dark fabrics, to avoid shiny marks.']),
   ('h2','Scent without stains'),
   ('p','Spray perfume from at least 30 cm, on the inside of the fabric or into the air and walk through it. Oils and bakhoor smoke are beautiful but can mark light silk, so test on a hidden seam first.'),
   ('h2','At QAMAR'),
   ('p','While you shower, we steam your abaya, dress or hijab and give it a light scent, so you leave with everything fresh at the same time. Women only, opening March 2027 off Sheikh Zayed Road.')]),
]
CSS = """:root{--night:#120B0F;--rose:#C9788F;--gold:#C49A5A;--cream:#FAF5F0;--ink:#1F1417;--ink2:#5E4A50}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:300 18px/1.7 Jost,system-ui,sans-serif}a{color:var(--rose)}header,footer{background:linear-gradient(120deg,#F8E1DC,#F3D3D6 60%,#EFC6CC);color:var(--ink)}header .w,footer .w{display:flex;justify-content:space-between;align-items:center;min-height:68px}.w{width:min(760px,100% - 40px);margin:auto}.brand{color:var(--ink);text-decoration:none;font:500 22px 'Cormorant Garamond',serif;letter-spacing:.3em}h1,h2{font-family:'Cormorant Garamond',serif;font-weight:500;line-height:1.15}h1{font-size:clamp(36px,6vw,54px);margin:48px 0 16px}h2{font-size:30px;margin:40px 0 8px}.lead{color:var(--ink2)}li{margin:6px 0}.cta{display:inline-flex;align-items:center;min-height:52px;padding:0 28px;border-radius:999px;background:var(--rose);color:#fff;text-decoration:none;font-weight:500;margin:32px 0}.more{border-top:1px solid rgba(196,154,90,.35);margin-top:48px;padding-top:24px}footer{margin-top:64px;font-size:15px}footer a{color:var(--ink);min-height:44px;display:inline-flex;align-items:center}:focus-visible{outline:2px solid var(--gold);outline-offset:3px}"""
def block(t, v):
    if t == 'ul': return '<ul>' + ''.join(f'<li>{html.escape(x)}</li>' for x in v) + '</ul>'
    return f'<{t}>{html.escape(v)}</{t}>'
for g in G:
    url = SITE + 'guides/' + g['slug'] + '.html'
    ld = {"@context":"https://schema.org","@type":"Article","headline":g['h1'],"description":g['desc'],"inLanguage":"en","image":SITE+'assets/og-qamar.png',"datePublished":"2026-11-12","author":{"@type":"Organization","name":"QAMAR Blowdry Lounge","url":SITE},"publisher":{"@type":"Organization","name":"QAMAR Blowdry Lounge"},"mainEntityOfPage":url}
    others = ''.join(f'<li><a href="{o["slug"]}.html">{html.escape(o["h1"])}</a></li>' for o in G if o is not g)
    page = f'''<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(g['title'])} | QAMAR</title>
<meta name="description" content="{html.escape(g['desc'])}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article"><meta property="og:title" content="{html.escape(g['title'])}"><meta property="og:description" content="{html.escape(g['desc'])}"><meta property="og:image" content="{SITE}assets/og-qamar.png"><meta property="og:url" content="{url}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<link rel="icon" href="../assets/app/favicon-32.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;500&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<header><div class="w"><a class="brand" href="../" translate="no">QAMAR</a><a href="../#contact" style="color:var(--ink)">Contact</a></div></header>
<main class="w">
<h1>{html.escape(g['h1'])}</h1>
{''.join(block(t, v) for t, v in g['body'])}
<a class="cta" href="../">Discover QAMAR</a>
<div class="more"><h2>More guides</h2><ul>{others}</ul></div>
</main>
<footer><div class="w"><span translate="no">© QAMAR Blowdry Lounge · Dubai</span><a href="../">Home</a></div></footer>
</body>
</html>
'''
    open(f"guides/{g['slug']}.html", 'w').write(page)
    print(g['slug'])
