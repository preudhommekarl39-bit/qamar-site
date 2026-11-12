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
   ('p','Our blow-dry looks (Qamar Express, Qamar Glow, Marina Waves and Midnight Sleek) are done by an all-female team, in 45 minutes at most, without an appointment. Opening March 2027 off Sheikh Zayed Road.')]),
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
GA = [
 dict(slug='get-ready-after-work-dubai', title='أين تتجهزين بعد العمل في دبي قرب شارع الشيخ زايد',
  desc='عشاء مباشرة بعد الدوام؟ كيف تنتقلين من المكتب إلى السهرة في أقل من ساعة في دبي: دشّ، ملابس بلا تجاعيد وسشوار، قرب شارع الشيخ زايد.',
  h1='أين تتجهزين بعد العمل في دبي؟',
  body=[('p','العشاء في الثامنة، وتخرجين من المكتب في السابعة. الذهاب إلى البيت في البرشاء أو المارينا والعودة يأخذ الساعة كلها، وزحمة شارع الشيخ زايد تتكفل بالباقي.'),
   ('h2','ما تحتاجينه فعلاً في ساعة واحدة'),
   ('ul',['دشّ منعش بعد يوم كامل في الحرّ.','ملابس بلا تجاعيد، فالفستان المطوي في الحقيبة طوال اليوم يحتاج إلى البخار.','تسريحة جاهزة، فالسشوار يغيّر الإطلالة كلها.','خمس دقائق هادئة ومشروب قبل الخروج.']),
   ('h2','الخيارات المعتادة، وأين تقصر'),
   ('p','غرفة تبديل الملابس في النادي الرياضي توفّر الدشّ بلا تسريحة. والصالون يوفّر السشوار غالباً بلا دشّ، وكثير منها يحتاج إلى موعد. أما سبا الفنادق فيجمع الاثنين، لكن بسعر ووقت السبا.'),
   ('h2','كيف يفعلها قمر'),
   ('p','قمر صالون نسائي يفتح في مارس ٢٠٢٧ قرب شارع الشيخ زايد، بين مول الإمارات ومركز دبي المالي العالمي. تدخلين بدون موعد. أثناء الدشّ نكوي فستانكِ أو عباءتكِ أو شيلتكِ بالبخار ونعطّرها، ثم تجلسين للسشوار ومشروبكِ، في ٤٥ دقيقة أو أقل.'),
   ('h2','نصائح للسهرة'),
   ('ul',['احتفظي بحقيبة صغيرة في المكتب: ملابس داخلية، مزيل عرق، حذاء، وطبقة خفيفة لمكيّفات المطاعم.','لفّي الفستان بدل طيّه، فيتجعد أقل.','اطلبي سشواراً ناعماً أو بحجم إذا كنتِ ستخرجين، فهما يصمدان في الرطوبة أكثر من التموجات.'])]),
 dict(slug='blow-dry-dubai-humidity', title='كيف يدوم السشوار في رطوبة دبي',
  desc='الرطوبة في دبي تفسد السشوار بسرعة. نصائح عملية ليبقى شعركِ ناعماً أطول: أي تسريحة تختارين، وماذا تطلبين من مصففتكِ، وما الذي تتجنبينه.',
  h1='كيف يدوم السشوار في رطوبة دبي',
  body=[('p','من مايو إلى أكتوبر، قد تفسد رطوبة دبي سشواراً جديداً في الطريق من السيارة إلى المطعم. إليكِ ما يساعد.'),
   ('h2','اختاري تسريحة تصمد'),
   ('ul',['الشعر الناعم المفرود يدوم أطول، بشرط أن تجفّ الجذور تماماً.','السشوار بالفرشاة الدائرية مع حجم يحافظ على شكله أكثر من التموجات الخفيفة.','التموجات المحددة تتحمل الرطوبة جيداً لأنها قريبة من شكل الشعر الطبيعي.']),
   ('h2','ماذا تطلبين من مصففتكِ'),
   ('ul',['تجفيف الجذور بالكامل، فالرطوبة تبدأ من هناك.','رذاذ خفيف مضاد للرطوبة في النهاية، بدل الزيوت الثقيلة.','دفعة هواء باردة لتثبيت الشكل.']),
   ('h2','بعد الخروج'),
   ('ul',['احملي مشبك شعر صغير في حقيبتكِ للمشي في الخارج.','لا تلمسي شعركِ كثيراً، فاليدان تضيفان رطوبة.','في الصيف انتقلي من السيارة إلى الداخل بسرعة، فخمس دقائق في الخارج ليلاً قد تكفي لرفع الجذور.']),
   ('p','تسريحاتنا (قمر إكسبريس، قمر جلو، أمواج المارينا، ميدنايت سليك) ينفذها فريق نسائي بالكامل، في ٤٥ دقيقة كحد أقصى، بدون موعد. الافتتاح مارس ٢٠٢٧ قرب شارع الشيخ زايد.')]),
 dict(slug='steam-abaya-hijab', title='كيّ العباية والشيلة: بالبخار أم بالمكواة؟',
  desc='هل تكوين عباءتكِ وشيلتكِ بالبخار أم بالمكواة؟ أي قماش يحتاج ماذا، وكيف تزيلين التجاعيد بسرعة، وكيف تحتفظين برائحة خفيفة بلا بقع.',
  h1='كيّ العباية والشيلة: بالبخار أم بالمكواة؟',
  body=[('p','عباءة قضت اليوم مطوية في الحقيبة، أو شيلة تجعدت من مقعد السيارة، قد تجعل الإطلالة كلها متعبة. البخار يصلحها عادة أسرع من المكواة وبلطف أكبر.'),
   ('h2','متى تستخدمين البخار'),
   ('ul',['عبايات الكريب والندى والشيفون: البخار يرخي التجاعيد بلا لمعة.','شيلات الشيفون والجيرسيه: البخار يحافظ على انسدالها الناعم.','القطع المطرزة: بخّري من الداخل حتى لا تُضغط الخرز والتطريزات.']),
   ('h2','متى تستخدمين المكواة'),
   ('ul',['القطن والكتان عندما تحتاجين خطاً حاداً.','دائماً على حرارة منخفضة مع قطعة قماش فوق الأقمشة الداكنة لتجنب اللمعان.']),
   ('h2','عطر بلا بقع'),
   ('p','رشّي العطر من مسافة ٣٠ سم على الأقل، على الجهة الداخلية للقماش أو في الهواء ثم امشي خلاله. الزيوت ودخان البخور جميلة لكنها قد تترك أثراً على الحرير الفاتح، فجرّبي على طرف مخفي أولاً.'),
   ('h2','في قمر'),
   ('p','أثناء الدشّ نكوي عباءتكِ أو فستانكِ أو شيلتكِ بالبخار ونعطّرها برائحة خفيفة، فتخرجين وكل شيء منعش في الوقت نفسه. للنساء فقط، الافتتاح مارس ٢٠٢٧ قرب شارع الشيخ زايد.')]),
]
CSS = """:root{--night:#120B0F;--rose:#C9788F;--gold:#C49A5A;--cream:#FAF5F0;--ink:#1F1417;--ink2:#5E4A50}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font:300 18px/1.7 Jost,system-ui,sans-serif}a{color:var(--rose)}header,footer{background:linear-gradient(120deg,#F8E1DC,#F3D3D6 60%,#EFC6CC);color:var(--ink)}header .w,footer .w{display:flex;justify-content:space-between;align-items:center;min-height:68px}.w{width:min(760px,100% - 40px);margin:auto}.brand{color:var(--ink);text-decoration:none;font:500 22px 'Cormorant Garamond',serif;letter-spacing:.3em}h1,h2{font-family:'Cormorant Garamond',serif;font-weight:500;line-height:1.15}h1{font-size:clamp(36px,6vw,54px);margin:48px 0 16px}h2{font-size:30px;margin:40px 0 8px}.lead{color:var(--ink2)}li{margin:6px 0}.cta{display:inline-flex;align-items:center;min-height:52px;padding:0 28px;border-radius:999px;background:var(--rose);color:#fff;text-decoration:none;font-weight:500;margin:32px 0}.more{border-top:1px solid rgba(196,154,90,.35);margin-top:48px;padding-top:24px}footer{margin-top:64px;font-size:15px}footer a{color:var(--ink);min-height:44px;display:inline-flex;align-items:center}:focus-visible{outline:2px solid var(--gold);outline-offset:3px}"""
def block(t, v):
    if t == 'ul': return '<ul>' + ''.join(f'<li>{html.escape(x)}</li>' for x in v) + '</ul>'
    return f'<{t}>{html.escape(v)}</{t}>'
import os
os.makedirs('guides/ar', exist_ok=True)
UI = {'en': dict(dir='ltr', loc='en_AE', home='Home', cta='Discover QAMAR', more='More guides', contact='Contact', pre='../', crumb='QAMAR', sign='© QAMAR Blowdry Lounge · Dubai'),
      'ar': dict(dir='rtl', loc='ar_AE', home='الرئيسية', cta='اكتشفي قمر', more='أدلة أخرى', contact='تواصلي معنا', pre='../../', crumb='قمر', sign='© قمر بلودراي لاونج · دبي')}
def page(g, lang, lst):
    u = UI[lang]; P = u['pre']
    url = SITE + ('guides/ar/' if lang == 'ar' else 'guides/') + g['slug'] + '.html'
    en_url = SITE + 'guides/' + g['slug'] + '.html'; ar_url = SITE + 'guides/ar/' + g['slug'] + '.html'
    home = SITE + ('ar.html' if lang == 'ar' else '')
    ld = {"@context":"https://schema.org","@graph":[
      {"@type":"Article","headline":g['h1'],"description":g['desc'],"inLanguage":lang,"image":SITE+'assets/og-qamar.png',"datePublished":"2026-11-12","dateModified":"2026-11-12","author":{"@type":"Organization","name":"QAMAR Blowdry Lounge","url":SITE},"publisher":{"@id":SITE+"#salon"},"about":{"@id":SITE+"#salon"},"mainEntityOfPage":url},
      {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":u['crumb'],"item":home},{"@type":"ListItem","position":2,"name":g['h1'],"item":url}]}]}
    others = ''.join(f'<li><a href="{o["slug"]}.html">{html.escape(o["h1"])}</a></li>' for o in lst if o is not g)
    t = html.escape(g['title']); d = html.escape(g['desc'])
    return f'''<!doctype html>
<html lang="{lang}" dir="{u['dir']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t} | {'قمر' if lang == 'ar' else 'QAMAR'}</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{en_url}"><link rel="alternate" hreflang="ar" href="{ar_url}"><link rel="alternate" hreflang="x-default" href="{en_url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="QAMAR Blowdry Lounge"><meta property="og:locale" content="{u['loc']}"><meta property="og:title" content="{t}"><meta property="og:description" content="{d}"><meta property="og:image" content="{SITE}assets/og-qamar.png"><meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{d}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<link rel="icon" href="{P}assets/app/favicon-32.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;500{'&family=Tajawal:wght@400;500' if lang == 'ar' else ''}&display=swap" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;500{'&family=Tajawal:wght@400;500' if lang == 'ar' else ''}&display=swap"></noscript>
<style>{CSS}{"body{font-family:Tajawal,system-ui,sans-serif}h1,h2{font-family:Tajawal,serif;font-weight:500}" if lang == 'ar' else ''}</style>
</head>
<body>
<header><div class="w"><a class="brand" href="{P}{'ar.html' if lang == 'ar' else ''}" translate="no">QAMAR</a><a href="{P}{'ar.html' if lang == 'ar' else ''}#contact" style="color:var(--ink)">{u['contact']}</a></div></header>
<main class="w">
<h1>{html.escape(g['h1'])}</h1>
{''.join(block(t, v) for t, v in g['body'])}
<a class="cta" href="{P}{'ar.html' if lang == 'ar' else ''}">{u['cta']}</a>
<div class="more"><h2>{u['more']}</h2><ul>{others}</ul></div>
</main>
<footer><div class="w"><span translate="no">{u['sign']}</span><a href="{P}{'ar.html' if lang == 'ar' else ''}">{u['home']}</a></div></footer>
</body>
</html>
'''
for g in G:
    open(f"guides/{g['slug']}.html", 'w').write(page(g, 'en', G)); print(g['slug'])
for g in GA:
    open(f"guides/ar/{g['slug']}.html", 'w').write(page(g, 'ar', GA)); print('ar', g['slug'])
