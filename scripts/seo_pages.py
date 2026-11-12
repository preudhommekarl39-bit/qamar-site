# Génère les pages SEO statiques services/*.html, services/ar/*.html, areas/*.html, areas/ar/*.html
# (+ la page sommaire services/index.html et services/ar/index.html).
# Prix et durées lus dans assets/data.js (source unique). Modifier les textes ici puis : python3 scripts/seo_pages.py
# Règles : rien d'inventé (pas d'adresse, de téléphone, d'horaires confirmés, d'avis) ; prix seulement dans le texte visible, marqués « indicatifs ».
import html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SITE = 'https://qamarlounge.com/'
DATE = '2026-11-12'

# ---------- Données (assets/data.js) ----------
DJ = open('assets/data.js', encoding='utf-8').read()
SV = {}
for m in re.finditer(r"\{ id: '([a-z]+)', art:.*?look: \{ en: '([^']+)', ar: '([^']+)' \}, name: \{ en: '([^']+)', ar: '([^']+)' \}.*?duration: (\d+), price: (\d+)", DJ):
    SV[m[1]] = dict(look={'en': m[2], 'ar': m[3]}, name={'en': m[4], 'ar': m[5]}, dur=int(m[6]), price=int(m[7]))
EX = {m[1]: dict(name={'en': m[2], 'ar': m[3]}, price=int(m[4])) for m in re.finditer(r"\{ id: '([a-z]+)', name: \{ en: '([^']+)', ar: '([^']+)' \}, price: (\d+) \}", DJ.split('extras:')[1].split('],')[0])}
RITUAL = int(re.search(r"ritual: \{ price: (\d+)", DJ)[1])
LONG = int(re.search(r"extraLong: \{ price: (\d+)", DJ)[1])
DROP = int(re.search(r"dropPct: (\d+)", DJ)[1]); FLOOR = int(re.search(r"floorPct: (\d+)", DJ)[1])
MINM = int(re.search(r"minMonths: (\d+)", DJ)[1]); PAUSE = int(re.search(r"pauseMonths: (\d+)", DJ)[1])
FOUND = re.search(r"founding: \{ count: (\d+), startMonth: (\d+)", DJ); FOUND_N, FOUND_M = int(FOUND[1]), int(FOUND[2])
TIERS = [dict(id=m[1], name={'en': m[2], 'ar': m[3]}, visits=int(m[4]), price=int(m[5]), per={'en': m[6], 'ar': m[7]})
         for m in re.finditer(r"\{ id: '([a-z]+)', name: \{ en: '([^']+)', ar: '([^']+)' \}, visits: (\d+), price: (\d+),(?: popular: true,)? per: \{ en: '([^']+)', ar: '([^']+)' \}", DJ)]
PERKS = re.findall(r"\{ en: '([^']+)', ar: '([^']+)' \}", DJ.split('perks:')[1].split('],')[0])
HAPPY = re.search(r"happyHours: \{.*?pct: (\d+)", DJ)
HAPPY_PCT = int(HAPPY[1])
for k in ['express', 'glow', 'waves', 'sleek', 'night', 'sos', 'care', 'mini']: assert k in SV, k
for k in ['shower', 'steam', 'scent', 'hairscent', 'coffee', 'touchup']: assert k in EX, k
assert len(TIERS) == 3 and len(PERKS) >= 5
FLOOR_MONTH = FLOOR // DROP + 1  # 9e mois

AR_DIG = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')
def num(n, lang): return str(n).translate(AR_DIG) if lang == 'ar' else str(n)
def aed(n, lang): return f'{num(n, lang)} درهم' if lang == 'ar' else f'{n} AED'
def club_price(p, month): return round(p * (1 - min(DROP * (month - 1), FLOOR) / 100))
E = lambda s: html.escape(s, quote=True)

# Valeurs calculées réutilisées dans les textes
V = {k: v['price'] for k, v in SV.items()} | {'x_' + k: v['price'] for k, v in EX.items()}
V.update(ritual=RITUAL, long=LONG, drop=DROP, floor=FLOOR, minm=MINM, pause=PAUSE, floorm=FLOOR_MONTH, happy=HAPPY_PCT,
         found_n=FOUND_N, found_m=FOUND_M, half=TIERS[1]['price'], half_visit=round(TIERS[1]['price'] / TIERS[1]['visits']),
         alacarte=SV['glow']['price'] + RITUAL)
def fill(s, lang):
    return re.sub(r'\{(\w+)\}', lambda m: num(V[m[1]], lang), s)

# ---------- Contenu ----------
# Blocs : ('h2', t) ('p', t) ('ul', [..]) ('prices', [ids]) ('extras', [ids]) ('tiers', None) ('drop', None)
GUIDES = {'humidity': ('blow-dry-dubai-humidity', 'How to make a blow-dry last in Dubai humidity', 'كيف يدوم السشوار في رطوبة دبي'),
          'afterwork': ('get-ready-after-work-dubai', 'Where to get ready after work in Dubai', 'أين تتجهزين بعد العمل في دبي؟'),
          'abaya': ('steam-abaya-hijab', 'Steaming vs ironing your abaya and hijab', 'كيّ العباية والشيلة: بالبخار أم بالمكواة؟')}

SERVICES = [
 dict(slug='walk-in-blow-dry-dubai', img='look-glow.webp', area=None, guide='afterwork', rel=['express-blow-dry-dubai', 'blowout-dubai', 'hollywood-waves-dubai'],
  en=dict(title='Walk-In Blow-Dry in Dubai, No Appointment', nav='Walk-in blow-dry',
   desc='A women-only walk-in blow-dry lounge off Sheikh Zayed Road, Dubai. No appointment, every look in 45 minutes or less. Opening March 2027.',
   h1='Walk-in blow-dry in Dubai, without an appointment', stype='Blow-dry',
   alt='Glossy, voluminous blow-dry being finished by a miniature QAMAR team, the Qamar Glow look',
   lead='Most Dubai salons ask you to book days ahead, then run late anyway. QAMAR works the other way round: you walk in, join the queue from your phone, and sit down when your chair is ready.',
   body=[('h2', 'How walk-in works at QAMAR'),
    ('ul', ['Join the queue from your phone when you arrive: you see your place in line.', 'Wait with a drink, or step out for a few minutes. Your phone tells you the moment your chair is ready.', 'Choose your look in the chair. Every look on the menu takes 45 minutes or less.', 'Going straight out? Add a private shower while your outfit, abaya or hijab is steamed and perfumed.']),
    ('h2', 'Which blow-dry to choose'),
    ('prices', ['express', 'glow', 'sleek', 'waves']),
    ('p', 'Not sure? Tell your stylist where you are going. For a dinner outdoors in summer, a sleek or bouncy finish holds better than loose waves. For an evening full of photos, Qamar Glow gives the most shine. Extra long or thick hair adds {long} AED.'),
    ('h2', 'Why walk-in instead of booking'),
    ('p', 'A booking makes sense for colour or a big change of cut. A blow-dry is different: you usually decide on the day, once you know the weather, your plans and how your hair behaves. Walk-in means no deposit, no reminder messages, and no penalty when a meeting runs over and you arrive late.'),
    ('h2', 'Where and when'),
    ('p', 'QAMAR opens in March 2027 off Sheikh Zayed Road, between Mall of the Emirates and DIFC. The exact address will be announced before opening. Planned hours are 8 AM to midnight, so you can come before work, at lunch or late in the evening.')],
   faq=[('Do I need an appointment for a blow-dry at QAMAR?', 'No. QAMAR is walk-in only. You join the queue from your phone when you arrive, and your phone tells you when your chair is ready.'),
    ('How long does a blow-dry take?', 'Every look takes 45 minutes or less. Qamar Express is done in 35 minutes, or it is on us.'),
    ('How much does a blow-dry cost?', 'Indicative prices start at {express} AED for Qamar Express and go up to {waves} AED for Marina Waves. Extra long or thick hair adds {long} AED. Final prices are confirmed before opening.'),
    ('Is QAMAR open yet?', 'Not yet. Opening is planned for March 2027, off Sheikh Zayed Road in Dubai.')]),
  ar=dict(title='سشوار دبي بدون موعد، صالون نسائي', nav='سشوار بدون موعد',
   desc='صالون سشوار نسائي بدون موعد قرب شارع الشيخ زايد في دبي. كل إطلالة في ٤٥ دقيقة أو أقل. الافتتاح مارس ٢٠٢٧.',
   h1='سشوار في دبي بدون موعد', stype='سشوار',
   alt='شعر لامع وكثيف تضع عليه فرقة قمر الصغيرة اللمسات الأخيرة، إطلالة لمعة قمر',
   lead='أغلب صالونات دبي تطلب منكِ الحجز قبل أيام، ثم تتأخر رغم ذلك. في قمر الفكرة معكوسة: تدخلين، تنضمين إلى الطابور من هاتفكِ، وتجلسين عندما يجهز كرسيكِ.',
   body=[('h2', 'كيف يعمل الدخول بدون موعد في قمر'),
    ('ul', ['تنضمين إلى الطابور من هاتفكِ عند وصولكِ وترين دوركِ.', 'انتظري مع مشروب، أو اخرجي بضع دقائق، فهاتفكِ ينبّهكِ لحظة جاهزية كرسيكِ.', 'اختاري إطلالتكِ وأنتِ على الكرسي. كل إطلالة في القائمة تأخذ ٤٥ دقيقة أو أقل.', 'خارجة مباشرة؟ أضيفي دشّاً خاصاً بينما نكوي ملابسكِ أو عباءتكِ أو شيلتكِ بالبخار ونعطّرها.']),
    ('h2', 'أي سشوار تختارين'),
    ('prices', ['express', 'glow', 'sleek', 'waves']),
    ('p', 'محتارة؟ أخبري مصففتكِ إلى أين ستذهبين. لعشاء في الخارج صيفاً، السشوار الناعم أو المنسدل يصمد أكثر من التموجات. ولسهرة مليئة بالصور، لمعة قمر تعطي أكبر لمعان. الشعر الطويل جداً أو الكثيف يضيف {long} درهم.'),
    ('h2', 'لماذا بدون موعد بدل الحجز'),
    ('p', 'الحجز منطقي للصبغة أو لتغيير القصة. أما السشوار فمختلف: غالباً تقررينه في اليوم نفسه، بعد أن تعرفي الطقس وخططكِ وحال شعركِ. بدون موعد يعني لا عربون، لا رسائل تذكير، ولا غرامة إذا طال اجتماعكِ ووصلتِ متأخرة.'),
    ('h2', 'أين ومتى'),
    ('p', 'يفتح قمر في مارس ٢٠٢٧ قرب شارع الشيخ زايد، بين مول الإمارات ومركز دبي المالي العالمي. يُعلن العنوان الدقيق قبل الافتتاح. الساعات المخطط لها من ٨ صباحاً حتى منتصف الليل، فتأتين قبل العمل أو في استراحة الغداء أو في آخر المساء.')],
   faq=[('هل أحتاج إلى موعد للسشوار في قمر؟', 'لا. قمر بدون مواعيد إطلاقاً. تنضمين إلى الطابور من هاتفكِ عند وصولكِ، وهاتفكِ يخبركِ متى يجهز كرسيكِ.'),
    ('كم يستغرق السشوار؟', 'كل إطلالة تأخذ ٤٥ دقيقة أو أقل. قمر إكسبريس جاهز في ٣٥ دقيقة، أو يكون مجاناً.'),
    ('كم سعر السشوار؟', 'الأسعار التقريبية تبدأ من {express} درهم لقمر إكسبريس وتصل إلى {waves} درهم لأمواج المارينا. الشعر الطويل جداً أو الكثيف يضيف {long} درهم. تُؤكَّد الأسعار النهائية قبل الافتتاح.'),
    ('هل افتتح قمر؟', 'ليس بعد. الافتتاح مخطط له في مارس ٢٠٢٧ قرب شارع الشيخ زايد في دبي.')])),

 dict(slug='blowout-dubai', img='look-sleek.webp', guide='humidity', rel=['walk-in-blow-dry-dubai', 'express-blow-dry-dubai', 'evening-hair-dubai'],
  en=dict(title='Sleek Blowout in Dubai, Glass-Straight Hair', nav='Sleek blowout',
   desc='Midnight Sleek: a glass-straight, glossy blowout made for Dubai humidity, in 40 minutes. Women-only and walk-in, off Sheikh Zayed Road.',
   h1='Sleek straight blowout in Dubai', stype='Sleek blowout',
   alt='Long, glass-straight dark hair being polished by a miniature QAMAR team, the Midnight Sleek look',
   lead='A sleek blowout is the look that survives Dubai best: smooth from root to tip, glossy, and less likely to frizz between the car and the restaurant. At QAMAR it is called Midnight Sleek.',
   body=[('h2', 'What makes a good sleek blowout'),
    ('ul', ['The roots are dried completely first. Damp roots are where frizz starts.', 'The hair is smoothed section by section with a brush, so the shine comes from the blow-dry, not from heavy product.', 'A light anti-humidity finish and a cool shot of air seal the shape.', 'It fits in about 40 minutes, walk-in, with an all-female team.']),
    ('prices', ['sleek', 'glow']),
    ('h2', 'Sleek blowout or keratin?'),
    ('p', 'A blowout lasts until your next wash, often two to four days if you sleep on silk and stay away from steam rooms. A keratin treatment lasts for months but takes hours and uses chemical products. If you want straight hair for an event or a busy week, a blowout is the simpler choice. QAMAR focuses on blow-dries, not chemical straightening.'),
    ('h2', 'Make it last longer'),
    ('ul', ['Skip the gym shower and the sauna on the first day.', 'At night, tie your hair loosely with a silk scrunchie.', 'On day two, a little dry shampoo at the roots brings back the lift.', 'A touch-up within 48 hours is available as an extra ({x_touchup} AED).']),
    ('p', 'For more tips, read our guide on keeping a blow-dry smooth in Dubai humidity, linked below.')],
   faq=[('How long does a sleek blowout last in Dubai?', 'Usually two to four days, depending on humidity, your hair type and whether you wash or sweat. Sleek styles hold better in humidity than loose waves.'),
    ('Is a blowout the same as a blow-dry?', 'Yes. In Dubai both words describe hair styled with a dryer and brush. A sleek blowout simply means a straight, smooth finish.'),
    ('How much is a sleek blowout at QAMAR?', 'Midnight Sleek is {sleek} AED (indicative), about 40 minutes. Extra long or thick hair adds {long} AED.'),
    ('Do I need to book?', 'No. QAMAR is walk-in only, from opening in March 2027.')]),
  ar=dict(title='استشوار فرد ناعم في دبي (بلو آوت)', nav='فرد ناعم',
   desc='ميدنايت سليك: استشوار فرد ناعم ولامع كالزجاج يصمد في رطوبة دبي، في ٤٠ دقيقة. صالون نسائي بدون موعد قرب شارع الشيخ زايد.',
   h1='استشوار فرد ناعم في دبي', stype='استشوار فرد',
   alt='شعر داكن طويل مفرود كالزجاج تلمّعه فرقة قمر الصغيرة، إطلالة ميدنايت سليك',
   lead='الفرد الناعم هو الإطلالة التي تصمد في دبي أكثر من غيرها: ناعم من الجذور حتى الأطراف، لامع، وأقل عرضة للانتفاش بين السيارة والمطعم. في قمر نسميه ميدنايت سليك.',
   body=[('h2', 'ما الذي يصنع فرداً ناعماً جيداً'),
    ('ul', ['تجفيف الجذور بالكامل أولاً، فالانتفاش يبدأ من الجذور الرطبة.', 'تنعيم الشعر خصلة خصلة بالفرشاة، فيأتي اللمعان من السشوار لا من المستحضرات الثقيلة.', 'لمسة خفيفة مضادة للرطوبة ودفعة هواء بارد لتثبيت الشكل.', 'حوالي ٤٠ دقيقة، بدون موعد، مع فريق نسائي بالكامل.']),
    ('prices', ['sleek', 'glow']),
    ('h2', 'استشوار أم كيراتين؟'),
    ('p', 'الاستشوار يدوم حتى الغسلة التالية، غالباً من يومين إلى أربعة أيام إذا نمتِ على وسادة حرير وابتعدتِ عن غرف البخار. الكيراتين يدوم أشهراً لكنه يأخذ ساعات ويستخدم مواد كيميائية. إذا أردتِ شعراً مفروداً لمناسبة أو لأسبوع مزدحم، فالاستشوار هو الخيار الأبسط. قمر يركّز على السشوار، لا على الفرد الكيميائي.'),
    ('h2', 'ليدوم أطول'),
    ('ul', ['تجنبي دشّ النادي والساونا في اليوم الأول.', 'في الليل اربطي شعركِ برباط حرير بلا شدّ.', 'في اليوم الثاني، قليل من الشامبو الجاف على الجذور يعيد الحجم.', 'لمسة تصحيح خلال ٤٨ ساعة متوفرة كإضافة ({x_touchup} درهم).']),
    ('p', 'لمزيد من النصائح، اقرئي دليلنا عن السشوار في رطوبة دبي في الأسفل.')],
   faq=[('كم يدوم استشوار الفرد في دبي؟', 'عادة من يومين إلى أربعة أيام، حسب الرطوبة ونوع شعركِ وهل تغسلينه أو تتعرقين. الفرد يصمد في الرطوبة أكثر من التموجات.'),
    ('هل البلو آوت هو نفسه السشوار؟', 'نعم. في دبي الكلمتان تعنيان تصفيف الشعر بالسشوار والفرشاة. والفرد الناعم يعني نتيجة مستقيمة وملساء.'),
    ('كم سعر الفرد الناعم في قمر؟', 'ميدنايت سليك {sleek} درهم (سعر تقريبي)، حوالي ٤٠ دقيقة. الشعر الطويل جداً أو الكثيف يضيف {long} درهم.'),
    ('هل أحتاج إلى حجز؟', 'لا. قمر بدون مواعيد، من الافتتاح في مارس ٢٠٢٧.')])),

 dict(slug='hollywood-waves-dubai', img='look-waves.webp', guide='humidity', rel=['evening-hair-dubai', 'blowout-dubai', 'women-only-salon-dubai'],
  en=dict(title='Hollywood Waves & Curls in Dubai, Walk-In', nav='Waves & Hollywood curls',
   desc='Marina Waves: loose beach waves or glam Hollywood curls in 45 minutes, walk-in and women-only, off Sheikh Zayed Road, Dubai.',
   h1='Hollywood waves and curls in Dubai', stype='Hair waves and curls',
   alt='Soft, glossy waves being shaped by a miniature QAMAR team, the Marina Waves look',
   lead='Marina Waves is the QAMAR look for volume and movement: soft beach waves for a brunch, or polished Hollywood curls for a dinner, an engagement or a photo shoot.',
   body=[('h2', 'Beach waves or Hollywood curls?'),
    ('ul', ['Beach waves are looser and a little undone, with straighter ends. Easy for daytime and casual plans.', 'Hollywood curls are brushed out into even, glossy waves that fall to one side. The classic look for evenings and weddings.', 'Not sure? Show your stylist a photo of the outfit. The neckline often decides: open necklines suit side-swept curls, high necks suit volume at the back.']),
    ('prices', ['waves', 'night']),
    ('h2', 'Waves and Dubai humidity'),
    ('p', 'Waves drop faster in humidity than a sleek finish. Two habits help: let the curls cool completely before they are brushed out, and keep a claw clip in your bag for the walk outside. If you will spend the evening outdoors between May and October, ask for slightly tighter curls that relax into waves during the night, or choose a sleek blowout instead.'),
    ('h2', 'Under a shayla or hijab'),
    ('p', 'Curls flatten under a hijab, so many women prefer gentle volume at the crown and waves only in the lengths, for the moment they uncover at a ladies-only event. Tell your stylist if you will cover your hair after the salon and how you pin your shayla.'),
    ('h2', 'Late plans'),
    ('p', 'Weddings and engagements in Dubai often start late. From 8 PM to midnight, Night Glow gives you any blow-dry on the menu, including waves, with a matcha on us. Hours are planned and will be confirmed before opening.')],
   faq=[('How long do Hollywood curls take at QAMAR?', 'About 45 minutes, including the finish. Every look on the menu fits in 45 minutes or less.'),
    ('How much are waves or Hollywood curls?', 'Marina Waves is {waves} AED (indicative). Extra long or thick hair adds {long} AED.'),
    ('Will the waves hold in summer?', 'Waves relax faster in humidity. Ask for tighter curls if you will be outside, and avoid touching them too often.'),
    ('Can I come late in the evening before a wedding?', 'Yes. QAMAR plans to open until midnight, and Night Glow runs from 8 PM.')]),
  ar=dict(title='تموجات وكيرلي هوليوود في دبي بدون موعد', nav='تموجات وكيرلي هوليوود',
   desc='أمواج المارينا: تموجات شاطئية ناعمة أو كيرلي هوليوود فاخر في ٤٥ دقيقة، بدون موعد، في صالون نسائي قرب شارع الشيخ زايد في دبي.',
   h1='تموجات وكيرلي هوليوود في دبي', stype='تموجات وكيرلي',
   alt='تموجات ناعمة ولامعة تشكّلها فرقة قمر الصغيرة، إطلالة أمواج المارينا',
   lead='أمواج المارينا هي إطلالة قمر للحجم والحركة: تموجات شاطئية ناعمة للبرانش، أو كيرلي هوليوود أنيق لعشاء أو ملكة أو جلسة تصوير.',
   body=[('h2', 'تموجات شاطئية أم كيرلي هوليوود؟'),
    ('ul', ['التموجات الشاطئية أكثر انسيابية وعفوية، وأطرافها شبه مستقيمة. مناسبة للنهار والطلعات البسيطة.', 'كيرلي هوليوود تموجات متساوية ولامعة تنسدل على جانب واحد. الإطلالة الكلاسيكية للسهرات والأعراس.', 'محتارة؟ أري مصففتكِ صورة فستانكِ. فتحة العنق تحسم غالباً: الفتحة الواسعة تناسب الكيرلي الجانبي، والعنق العالي يناسب الحجم من الخلف.']),
    ('prices', ['waves', 'night']),
    ('h2', 'التموجات ورطوبة دبي'),
    ('p', 'التموجات تسقط في الرطوبة أسرع من الفرد. عادتان تساعدان: اتركي الكيرلي يبرد تماماً قبل تسريحه، واحملي مشبكاً في حقيبتكِ للمشي في الخارج. وإذا كانت سهرتكِ في الهواء الطلق بين مايو وأكتوبر، اطلبي كيرلي أشدّ قليلاً يرتخي إلى تموجات خلال الليل، أو اختاري الفرد الناعم.'),
    ('h2', 'تحت الشيلة أو الحجاب'),
    ('p', 'الكيرلي ينضغط تحت الحجاب، لذلك تفضّل كثيرات حجماً خفيفاً عند أعلى الرأس وتموجات في الأطوال فقط، للحظة نزع الشيلة في مناسبة نسائية. أخبري مصففتكِ إذا كنتِ ستغطين شعركِ بعد الصالون وكيف تثبّتين شيلتكِ.'),
    ('h2', 'للمواعيد المتأخرة'),
    ('p', 'الأعراس والملكات في دبي تبدأ غالباً متأخرة. من ٨ مساءً حتى منتصف الليل، توهّج الليل يمنحكِ أي سشوار من القائمة، ومنه التموجات، مع ماتشا على حسابنا. الساعات مخطط لها وتُؤكَّد قبل الافتتاح.')],
   faq=[('كم يستغرق كيرلي هوليوود في قمر؟', 'حوالي ٤٥ دقيقة مع اللمسات الأخيرة. كل إطلالة في القائمة تأخذ ٤٥ دقيقة أو أقل.'),
    ('كم سعر التموجات أو كيرلي هوليوود؟', 'أمواج المارينا {waves} درهم (سعر تقريبي). الشعر الطويل جداً أو الكثيف يضيف {long} درهم.'),
    ('هل تصمد التموجات في الصيف؟', 'التموجات ترتخي أسرع في الرطوبة. اطلبي كيرلي أشدّ إذا كنتِ ستبقين في الخارج، ولا تلمسيه كثيراً.'),
    ('هل يمكنني المجيء متأخرة قبل عرس؟', 'نعم. يخطط قمر للعمل حتى منتصف الليل، وتوهّج الليل يبدأ من ٨ مساءً.')])),

 dict(slug='express-blow-dry-dubai', img='look-express.webp', guide='afterwork', rel=['walk-in-blow-dry-dubai', 'blowout-dubai', 'blow-dry-membership-dubai'],
  en=dict(title='Express Blow-Dry in Dubai: Done in 35 Minutes', nav='Express blow-dry',
   desc='Qamar Express: a smooth, bouncy blow-dry in 35 minutes or it is on us. Walk-in and women-only, off Sheikh Zayed Road, Dubai.',
   h1='Express blow-dry in Dubai, in 35 minutes', stype='Express blow-dry',
   alt='Smooth, bouncy blow-dry being finished by a miniature QAMAR team, the Qamar Express look',
   lead='Some days you have forty minutes between two meetings, or between the office and a dinner. Qamar Express is built for that gap: smooth, bouncy hair in 35 minutes, or the blow-dry is on us.',
   body=[('h2', 'How the 35-minute promise works'),
    ('ul', ['The clock starts when your service starts, not while you wait in the queue.', 'If it takes longer than 35 minutes, the blow-dry is on us.', 'Your phone shows your place in line, so you know how long the whole stop will take.']),
    ('prices', ['express', 'sos']),
    ('h2', 'Even shorter: SOS 15'),
    ('p', 'When 35 minutes is still too long, SOS 15 covers the essentials in 15 minutes flat: a fringe, a sleek ponytail or a quick braid. It is the fix for a meeting that moved forward or a dinner you almost forgot.'),
    ('h2', 'Best times to come'),
    ('ul', ['Weekday late mornings and early afternoons should be the calmest.', 'Planned happy hours, 10 AM to 3 PM on weekdays, take {happy}% off.', 'Evenings before the weekend will likely be the busiest. Check the queue on your phone before you leave.']),
    ('h2', 'Express, every week'),
    ('p', 'If an express blow-dry is part of your week, the QAMAR Club Half Moon plan covers one blow-dry a week with a shower, steaming and a drink included, and its price drops every month you stay.')],
   faq=[('What happens if my express blow-dry takes longer than 35 minutes?', 'Then it is on us. The 35 minutes are counted from the start of the service, not from your arrival.'),
    ('Is an express blow-dry fine for long hair?', 'Yes, for a smooth or bouncy finish. Extra long or thick hair adds {long} AED (indicative). For waves, choose Marina Waves, which takes up to 45 minutes.'),
    ('How much is Qamar Express?', '{express} AED (indicative). SOS 15 is {sos} AED.'),
    ('Can I book an express slot?', 'No. QAMAR is walk-in only. You join the queue when you arrive and your phone tells you when your chair is ready.')]),
  ar=dict(title='سشوار سريع في دبي خلال ٣٥ دقيقة', nav='سشوار سريع',
   desc='قمر إكسبريس: سشوار ناعم ومنسدل في ٣٥ دقيقة أو يكون مجاناً. صالون نسائي بدون موعد قرب شارع الشيخ زايد في دبي.',
   h1='سشوار سريع في دبي خلال ٣٥ دقيقة', stype='سشوار سريع',
   alt='سشوار ناعم ومنسدل تنهيه فرقة قمر الصغيرة، إطلالة قمر إكسبريس',
   lead='في بعض الأيام لديكِ أربعون دقيقة بين اجتماعين، أو بين المكتب والعشاء. قمر إكسبريس صُمّم لهذه الفجوة: شعر ناعم ومنسدل في ٣٥ دقيقة، أو يكون السشوار مجاناً.',
   body=[('h2', 'كيف يعمل وعد الـ٣٥ دقيقة'),
    ('ul', ['يبدأ العدّ عند بداية الخدمة، لا أثناء انتظاركِ في الطابور.', 'إذا تجاوز ٣٥ دقيقة، يكون السشوار على حسابنا.', 'هاتفكِ يعرض دوركِ في الطابور، فتعرفين كم ستأخذ الزيارة كلها.']),
    ('prices', ['express', 'sos']),
    ('h2', 'أقصر بعد: إس أو إس ١٥'),
    ('p', 'عندما تكون ٣٥ دقيقة كثيرة، إس أو إس ١٥ يغطي الأساسيات في ١٥ دقيقة فقط: غرّة، أو ذيل حصان ناعم، أو ضفيرة سريعة. الحل لاجتماع تقدّم موعده أو عشاء كدتِ تنسينه.'),
    ('h2', 'أفضل أوقات المجيء'),
    ('ul', ['أواخر الصباح وبدايات الظهر في أيام الأسبوع يُتوقع أن تكون الأهدأ.', 'عروض الظهيرة المخطط لها، من ١٠ صباحاً حتى ٣ عصراً أيام الأسبوع، بخصم {happy}٪.', 'أمسيات ما قبل العطلة ستكون غالباً الأكثر ازدحاماً. تحققي من الطابور على هاتفكِ قبل الخروج.']),
    ('h2', 'إكسبريس كل أسبوع'),
    ('p', 'إذا كان السشوار السريع جزءاً من أسبوعكِ، فاشتراك نصف القمر في نادي قمر يشمل سشواراً كل أسبوع مع الدشّ والبخار والمشروب، وسعره ينخفض كل شهر تبقين فيه.')],
   faq=[('ماذا يحدث إذا تجاوز السشوار السريع ٣٥ دقيقة؟', 'يكون على حسابنا. تُحسب الـ٣٥ دقيقة من بداية الخدمة، لا من لحظة وصولكِ.'),
    ('هل السشوار السريع مناسب للشعر الطويل؟', 'نعم، لنتيجة ناعمة أو منسدلة. الشعر الطويل جداً أو الكثيف يضيف {long} درهم (سعر تقريبي). للتموجات اختاري أمواج المارينا، حتى ٤٥ دقيقة.'),
    ('كم سعر قمر إكسبريس؟', '{express} درهم (سعر تقريبي). وإس أو إس ١٥ بسعر {sos} درهم.'),
    ('هل يمكنني حجز موعد للسشوار السريع؟', 'لا. قمر بدون مواعيد. تنضمين إلى الطابور عند وصولكِ وهاتفكِ يخبركِ متى يجهز كرسيكِ.')])),

 dict(slug='evening-hair-dubai', img='look-night.webp', guide='afterwork', rel=['hollywood-waves-dubai', 'women-only-salon-dubai', 'blowout-dubai'],
  en=dict(title='Evening & Wedding Guest Hair in Dubai, Late', nav='Evening & wedding-guest hair',
   desc='Night Glow: any blow-dry from 8 PM to midnight with a matcha on us. Hair for dinners, engagements and wedding guests, women-only, Dubai.',
   h1='Evening and wedding-guest hair in Dubai', stype='Evening hairstyling',
   alt='Evening blow-dry with soft shine under warm night light, styled by a miniature QAMAR team, the Night Glow look',
   lead='In Dubai the evening starts late: dinners at ten, weddings that begin at eleven, henna nights that go past midnight. Many salons close just when you need them. QAMAR plans to stay open until midnight.',
   body=[('h2', 'Night Glow, 8 PM to midnight'),
    ('p', 'Every night from 8 PM, any blow-dry on the menu comes with a matcha on us. Choose Hollywood curls for a wedding, Midnight Sleek for a dinner, or Qamar Glow if you want shine in photos.'),
    ('prices', ['night', 'sos']),
    ('h2', 'Getting ready as a wedding guest'),
    ('ul', ['Bring your dress or abaya: while you take a private shower, it is steamed and lightly perfumed.', 'If you cover, tell your stylist how you will wear your shayla, so the volume sits in the right place.', 'Finish with a hair perfume: oud, rose or white musk.', 'Every look takes 45 minutes or less, so you leave for the hall without rushing.']),
    ('h2', 'Coming as a group'),
    ('p', 'Sisters, cousins, friends: with the planned Squad offer, four friends or more each save 25%. Everything is walk-in, so arrive a little earlier and join the queue together.'),
    ('h2', 'What QAMAR is not'),
    ('p', 'QAMAR focuses on blow-dries and quick styling rather than bridal hair and make-up. For the bride herself, a specialist bridal team is the better choice. For the guests, the sisters and the mothers, a walk-in blow-dry is often all that is needed.')],
   faq=[('Is there a salon in Dubai open late for evening hair?', 'QAMAR plans to open from 8 AM to midnight, with Night Glow from 8 PM. Hours will be confirmed before the March 2027 opening.'),
    ('How much is Night Glow?', '{night} AED (indicative) for any blow-dry of your choice, with a matcha included.'),
    ('Can my outfit be steamed while I get ready?', 'Yes. Your dress, abaya or hijab is steamed while you shower ({x_steam} AED per piece, indicative).'),
    ('Do you do bridal hair?', 'No, QAMAR is a blow-dry lounge. It suits wedding guests rather than brides.')]),
  ar=dict(title='تسريحات السهرة والأعراس في دبي حتى منتصف الليل', nav='تسريحات السهرة والأعراس',
   desc='توهّج الليل: أي سشوار من ٨ مساءً حتى منتصف الليل مع ماتشا على حسابنا. تسريحات للعشاء والملكة وضيفات الأعراس، صالون نسائي في دبي.',
   h1='تسريحات السهرة وضيفات الأعراس في دبي', stype='تسريحات السهرة',
   alt='سشوار سهرة بلمعان ناعم تحت إضاءة ليلية دافئة من فرقة قمر الصغيرة، إطلالة توهّج الليل',
   lead='في دبي تبدأ السهرة متأخرة: عشاء في العاشرة، عرس يبدأ في الحادية عشرة، وليلة حناء تتجاوز منتصف الليل. كثير من الصالونات تغلق في اللحظة التي تحتاجينها. قمر يخطط للبقاء مفتوحاً حتى منتصف الليل.',
   body=[('h2', 'توهّج الليل، من ٨ مساءً حتى منتصف الليل'),
    ('p', 'كل ليلة من الثامنة، أي سشوار من القائمة يأتي مع ماتشا على حسابنا. اختاري كيرلي هوليوود للعرس، أو ميدنايت سليك للعشاء، أو لمعة قمر إذا أردتِ لمعاناً في الصور.'),
    ('prices', ['night', 'sos']),
    ('h2', 'تجهيزكِ كضيفة في عرس'),
    ('ul', ['أحضري فستانكِ أو عباءتكِ: أثناء دشّكِ الخاص نكويها بالبخار ونعطّرها بخفة.', 'إذا كنتِ محجبة، أخبري مصففتكِ كيف ستلبسين شيلتكِ ليكون الحجم في مكانه الصحيح.', 'اختمي بعطر الشعر: عود أو ورد أو مسك أبيض.', 'كل إطلالة تأخذ ٤٥ دقيقة أو أقل، فتخرجين إلى القاعة بلا عجلة.']),
    ('h2', 'المجيء مع المجموعة'),
    ('p', 'الأخوات وبنات العم والصديقات: مع عرض سكواد المخطط له، تحصل كل واحدة من أربع صديقات أو أكثر على خصم ٢٥٪. كل شيء بدون موعد، فتعالين قبل الوقت بقليل وانضممن إلى الطابور معاً.'),
    ('h2', 'ما ليس قمر'),
    ('p', 'يركّز قمر على السشوار والتسريحات السريعة، لا على تسريحات العرائس والمكياج. للعروس نفسها، فريق متخصص في العرائس هو الخيار الأفضل. أما الضيفات والأخوات والأمهات، فغالباً يكفيهن سشوار بدون موعد.')],
   faq=[('هل يوجد صالون في دبي يفتح متأخراً لتسريحات السهرة؟', 'يخطط قمر للعمل من ٨ صباحاً حتى منتصف الليل، مع توهّج الليل من ٨ مساءً. تُؤكَّد الساعات قبل الافتتاح في مارس ٢٠٢٧.'),
    ('كم سعر توهّج الليل؟', '{night} درهم (سعر تقريبي) لأي سشوار تختارينه، مع ماتشا مشمولة.'),
    ('هل يمكن كيّ ملابسي بالبخار أثناء تجهيزي؟', 'نعم. نكوي فستانكِ أو عباءتكِ أو شيلتكِ بالبخار أثناء دشّكِ ({x_steam} درهم للقطعة، سعر تقريبي).'),
    ('هل تقدمون تسريحات العرائس؟', 'لا، قمر صالون سشوار. يناسب ضيفات الأعراس أكثر من العرائس.')])),

 dict(slug='women-only-salon-dubai', img='ritual-hijab.webp', guide='abaya', rel=['hair-care-ritual-dubai', 'evening-hair-dubai', 'walk-in-blow-dry-dubai'],
  en=dict(title='Women-Only Salon in Dubai, Hijab-Friendly', nav='Women-only, hijab-friendly salon',
   desc='A women-only blow-dry lounge in Dubai with an all-female team: private shower, abaya and hijab steaming, prayer room. Walk-in, off SZR.',
   h1='A women-only, hijab-friendly salon in Dubai', stype='Women-only hair salon',
   alt='Miniature QAMAR team steaming a blush hijab and folding an abaya at the hijab bar',
   lead='For many women in Dubai, privacy decides where they get their hair done. QAMAR is women-only from the door to the chair, with an all-female team, so you can take off your hijab or shayla without a second thought.',
   body=[('h2', 'Privacy, by design'),
    ('ul', ['Women only: every guest and every member of the team.', 'An all-female team of stylists and hosts.', 'Your own private shower, not a shared changing room.', 'Bilingual service in Arabic and English.']),
    ('h2', 'Your abaya, hijab and shayla'),
    ('p', 'While you shower, a second team member steams your abaya, dress or hijab and gives it a light scent, so everything is fresh when you leave. Steam relaxes creases on crepe, nida and chiffon without the shine an iron can leave. At the hijab bar you will also find pins and accessories.'),
    ('extras', ['shower', 'steam', 'scent', 'hairscent']),
    ('h2', 'A quiet place to pray'),
    ('p', 'The lounge has a calm prayer room with prayer mats, the qibla direction and a mirror, so you never have to rush your blow-dry around prayer time.'),
    ('h2', 'Covering after your blow-dry'),
    ('ul', ['Ask for volume at the crown, so the shape shows gently under the shayla.', 'Let the hair cool completely before covering, or it will flatten.', 'A hair perfume (oud, rose or white musk) stays fresh under the hijab for hours.'])],
   faq=[('Are there men in the salon?', 'No. QAMAR is women-only, for guests and team.'),
    ('Can my abaya and hijab be steamed?', 'Yes. While you shower, your dress, abaya or hijab is steamed ({x_steam} AED per piece, indicative) and can be lightly perfumed. Club members have it included.'),
    ('Is there a prayer room?', 'Yes, with prayer mats, the qibla direction and a mirror.'),
    ('Can I bring my daughter?', 'Yes. Mini Glow is a mini blow-dry or braids for girls, 25 minutes, {mini} AED (indicative).')]),
  ar=dict(title='صالون نسائي في دبي مناسب للمحجبات', nav='صالون نسائي للمحجبات',
   desc='صالون سشوار نسائي في دبي بفريق نسائي بالكامل: دشّ خاص، كيّ العباية والشيلة بالبخار، وغرفة صلاة. بدون موعد قرب شارع الشيخ زايد.',
   h1='صالون نسائي في دبي مناسب للمحجبات', stype='صالون نسائي',
   alt='فرقة قمر الصغيرة تكوي شيلة وردية بالبخار وتطوي عباءة عند ركن الحجاب',
   lead='بالنسبة لكثير من النساء في دبي، الخصوصية هي ما يحدد أين تصفّف شعرها. قمر نسائي بالكامل من الباب حتى الكرسي، بفريق نسائي فقط، فتنزعين حجابكِ أو شيلتكِ دون أي تردد.',
   body=[('h2', 'الخصوصية أولاً'),
    ('ul', ['للنساء فقط: كل الزائرات وكل الفريق.', 'فريق نسائي بالكامل من المصففات والمضيفات.', 'دشّ خاص بكِ، لا غرفة تبديل مشتركة.', 'خدمة بالعربية والإنجليزية.']),
    ('h2', 'عباءتكِ وحجابكِ وشيلتكِ'),
    ('p', 'أثناء الدشّ، تكوي زميلة ثانية عباءتكِ أو فستانكِ أو حجابكِ بالبخار وتعطّرها برائحة خفيفة، فيكون كل شيء منعشاً عند خروجكِ. البخار يرخي تجاعيد الكريب والندى والشيفون بلا اللمعة التي قد تتركها المكواة. وفي ركن الحجاب تجدين دبابيس وإكسسوارات.'),
    ('extras', ['shower', 'steam', 'scent', 'hairscent']),
    ('h2', 'مكان هادئ للصلاة'),
    ('p', 'في الصالون غرفة صلاة هادئة فيها سجادات صلاة واتجاه القبلة ومرآة، فلا تضطرين إلى استعجال السشوار عند وقت الصلاة.'),
    ('h2', 'التغطية بعد السشوار'),
    ('ul', ['اطلبي حجماً عند أعلى الرأس ليظهر الشكل بلطف تحت الشيلة.', 'اتركي الشعر يبرد تماماً قبل تغطيته، وإلا انضغط.', 'عطر الشعر (عود أو ورد أو مسك أبيض) يبقى منعشاً تحت الحجاب لساعات.'])],
   faq=[('هل يوجد رجال في الصالون؟', 'لا. قمر للنساء فقط، زائرات وفريقاً.'),
    ('هل يمكن كيّ عباءتي وشيلتي بالبخار؟', 'نعم. أثناء دشّكِ نكوي فستانكِ أو عباءتكِ أو شيلتكِ بالبخار ({x_steam} درهم للقطعة، سعر تقريبي) ويمكن تعطيرها بخفة. وهي مشمولة لعضوات النادي.'),
    ('هل توجد غرفة صلاة؟', 'نعم، فيها سجادات صلاة واتجاه القبلة ومرآة.'),
    ('هل يمكنني إحضار ابنتي؟', 'نعم. ميني جلو سشوار خفيف أو ضفائر للصغيرات، ٢٥ دقيقة، {mini} درهم (سعر تقريبي).')])),

 dict(slug='blow-dry-membership-dubai', img='ritual-drinks.webp', guide='afterwork', rel=['express-blow-dry-dubai', 'walk-in-blow-dry-dubai', 'hair-care-ritual-dubai'],
  en=dict(title='Blow-Dry Membership in Dubai, Price Drops Monthly', nav='Blow-dry membership (QAMAR Club)',
   desc='QAMAR Club: 2 to 12 blow-dries a month with shower, steaming and drinks included. Your price drops 2% a month, down to −16%. Dubai.',
   h1='A blow-dry membership in Dubai whose price goes down', stype='Blow-dry membership',
   alt='Matcha, karak and fresh juice served at the QAMAR drinks bar by a miniature team',
   lead='If you get your hair done every week, paying visit by visit adds up quickly. The QAMAR Club turns it into one monthly price with the extras included, and that price goes down every month you stay.',
   body=[('h2', 'The three plans'),
    ('tiers', None),
    ('h2', 'How the price drops'),
    ('p', 'Your monthly price falls by {drop}% for every month you stay, until it reaches −{floor}% in your {floorm}th month. After that it stays at that level for as long as you remain a member. With the indicative prices, that looks like this:'),
    ('drop', None),
    ('p', 'The minimum commitment is {minm} months. You can pause up to {pause} months a year and keep your price level. The first {found_n} members are planned to start directly at the month-{found_m} price.'),
    ('h2', 'What every member gets'),
    ('perks', None),
    ('h2', 'Is it worth it?'),
    ('p', 'With Half Moon, a blow-dry a week costs about {half_visit} AED per visit from the first month, with the shower, steaming and a drink included. Paid one by one, a Qamar Glow blow-dry with the complete ritual comes to {alacarte} AED. If you come twice a month or more, a plan usually makes sense.')],
   faq=[('How does the QAMAR Club price drop work?', 'Each month you stay, your price falls by {drop}%, until −{floor}% from the {floorm}th month. It then stays there.'),
    ('Is there a minimum commitment?', '{minm} months. After that you can cancel at any time, and you can pause up to {pause} months a year.'),
    ('What if I miss a visit?', 'An unused visit carries over to the next month.'),
    ('Are the Club prices final?', 'Not yet. They are indicative and will be confirmed before the March 2027 opening.')]),
  ar=dict(title='اشتراك سشوار شهري في دبي، سعر ينخفض', nav='اشتراك السشوار (نادي قمر)',
   desc='نادي قمر: من ٢ إلى ١٢ سشوار في الشهر مع الدشّ والبخار والمشروبات. سعركِ ينخفض ٢٪ كل شهر حتى −١٦٪. صالون نسائي في دبي.',
   h1='اشتراك سشوار في دبي سعره ينخفض كل شهر', stype='اشتراك سشوار',
   alt='ماتشا وكرك وعصير طازج يقدّمها فريق قمر الصغير في ركن المشروبات',
   lead='إذا كنتِ تصفّفين شعركِ كل أسبوع، فالدفع زيارة بزيارة يتراكم بسرعة. نادي قمر يحوّل ذلك إلى سعر شهري واحد مع الإضافات مشمولة، وهذا السعر ينخفض كل شهر تبقين فيه.',
   body=[('h2', 'الاشتراكات الثلاثة'),
    ('tiers', None),
    ('h2', 'كيف ينخفض السعر'),
    ('p', 'سعركِ الشهري ينخفض {drop}٪ عن كل شهر تبقين فيه، حتى يصل إلى −{floor}٪ في الشهر {floorm}. بعدها يبقى عند هذا المستوى طالما بقيتِ عضوة. بالأسعار التقريبية، يبدو ذلك هكذا:'),
    ('drop', None),
    ('p', 'الحد الأدنى للالتزام {minm} أشهر. يمكنكِ إيقاف الاشتراك مؤقتاً حتى شهرين في السنة مع الاحتفاظ بمستوى سعركِ. ومن المخطط أن تبدأ أول {found_n} عضوة مباشرة بسعر الشهر {found_m}.'),
    ('h2', 'ما تحصل عليه كل عضوة'),
    ('perks', None),
    ('h2', 'هل يستحق؟'),
    ('p', 'مع نصف القمر، يكلّف السشوار الأسبوعي حوالي {half_visit} درهم للزيارة من الشهر الأول، مع الدشّ والبخار والمشروب. أما بالدفع زيارة بزيارة، فسشوار لمعة قمر مع الطقوس الكاملة يصل إلى {alacarte} درهم. إذا كنتِ تأتين مرتين في الشهر أو أكثر، فالاشتراك غالباً منطقي.')],
   faq=[('كيف ينخفض سعر نادي قمر؟', 'كل شهر تبقين فيه، ينخفض سعركِ {drop}٪، حتى −{floor}٪ من الشهر {floorm}. ثم يبقى عند هذا المستوى.'),
    ('هل يوجد حد أدنى للالتزام؟', '{minm} أشهر. بعدها يمكنكِ الإلغاء في أي وقت، ويمكنكِ الإيقاف المؤقت حتى شهرين في السنة.'),
    ('ماذا لو فاتتني زيارة؟', 'الزيارة غير المستخدمة تنتقل إلى الشهر التالي.'),
    ('هل أسعار النادي نهائية؟', 'ليس بعد. هي أسعار تقريبية وتُؤكَّد قبل الافتتاح في مارس ٢٠٢٧.')])),

 dict(slug='hair-care-ritual-dubai', img='ritual-wash.webp', guide='abaya', rel=['women-only-salon-dubai', 'walk-in-blow-dry-dubai', 'blow-dry-membership-dubai'],
  en=dict(title='Hair Wash & Care Ritual in Dubai, Women-Only', nav='Hair wash & care ritual',
   desc='Moon Ritual: velvet wash chair, warm towel, mask and steam in 30 minutes. Add a blow-dry or a private shower. Women-only, walk-in, Dubai.',
   h1='A hair wash and care ritual in Dubai', stype='Hair wash and care treatment',
   alt='Velvet wash basin with warm towels prepared by a miniature QAMAR team for the Moon Ritual',
   lead='Dubai is hard on hair: strong sun, pool and sea water, dusty days and air-conditioning from morning to night. The Moon Ritual is 30 minutes of care at the wash basin, on its own or before your blow-dry.',
   body=[('h2', 'What the Moon Ritual includes'),
    ('ul', ['A velvet wash chair and a warm towel around your shoulders.', 'A thorough wash and a nourishing mask.', 'Steam, to help the mask work while you rest.', 'About 30 minutes, walk-in, with an all-female team.']),
    ('prices', ['care', 'glow']),
    ('h2', 'The complete ritual'),
    ('p', 'Going straight out? Add the complete ritual for {ritual} AED (indicative): a private shower with towel and products, one piece of your outfit steamed and perfumed, a hair perfume, and a coffee or tea. On their own, those extras would cost:'),
    ('extras', ['shower', 'steam', 'scent', 'hairscent', 'coffee']),
    ('h2', 'How often to treat your hair'),
    ('ul', ['Once a week if you swim often or colour your hair.', 'Every two weeks for most hair in the hot months.', 'Before an event, so the blow-dry comes out smoother and shinier.']),
    ('p', 'Club members have the shower, steaming, perfume and a drink included on every visit.')],
   faq=[('Can I come for a hair wash only?', 'Yes. The Moon Ritual works on its own: about 30 minutes, {care} AED (indicative), no appointment.'),
    ('Can I combine it with a blow-dry?', 'Yes. Choose both when you join the queue, and your stylist will tell you the total time.'),
    ('Is the shower private?', 'Yes. It is your own shower, with towel and products: {x_shower} AED on its own, or part of the complete ritual.'),
    ('Which drinks are there?', 'Coffee, tea, karak, matcha and fresh juice, from the drinks bar.')]),
  ar=dict(title='غسل الشعر وطقوس العناية في دبي', nav='غسل الشعر وطقوس العناية',
   desc='طقوس القمر: كرسي غسل مخملي، منشفة دافئة، ماسك وبخار في ٣٠ دقيقة. أضيفي السشوار أو الدشّ الخاص. صالون نسائي بدون موعد في دبي.',
   h1='غسل الشعر وطقوس العناية في دبي', stype='غسل الشعر والعناية',
   alt='مغسلة مخملية ومناشف دافئة جهّزتها فرقة قمر الصغيرة لطقوس القمر',
   lead='دبي قاسية على الشعر: شمس قوية، ماء المسابح والبحر، غبار، ومكيّفات من الصباح حتى الليل. طقوس القمر ٣٠ دقيقة من العناية عند المغسلة، وحدها أو قبل السشوار.',
   body=[('h2', 'ماذا تشمل طقوس القمر'),
    ('ul', ['كرسي غسل مخملي ومنشفة دافئة على كتفيكِ.', 'غسل عميق وماسك مغذٍّ.', 'بخار يساعد الماسك على العمل وأنتِ ترتاحين.', 'حوالي ٣٠ دقيقة، بدون موعد، مع فريق نسائي بالكامل.']),
    ('prices', ['care', 'glow']),
    ('h2', 'الطقوس الكاملة'),
    ('p', 'خارجة مباشرة؟ أضيفي الطقوس الكاملة بـ{ritual} درهم (سعر تقريبي): دشّ خاص مع منشفة ومستحضرات، قطعة من ملابسكِ بالبخار ومعطّرة، عطر الشعر، وقهوة أو شاي. لو أخذتِ هذه الإضافات منفردة لكانت:'),
    ('extras', ['shower', 'steam', 'scent', 'hairscent', 'coffee']),
    ('h2', 'كم مرة تعتنين بشعركِ'),
    ('ul', ['مرة في الأسبوع إذا كنتِ تسبحين كثيراً أو تصبغين شعركِ.', 'كل أسبوعين لأغلب أنواع الشعر في الأشهر الحارة.', 'قبل مناسبة، ليخرج السشوار أنعم وألمع.']),
    ('p', 'عضوات النادي يحصلن على الدشّ والبخار والعطر والمشروب في كل زيارة.')],
   faq=[('هل يمكنني المجيء لغسل الشعر فقط؟', 'نعم. طقوس القمر وحدها: حوالي ٣٠ دقيقة، {care} درهم (سعر تقريبي)، بدون موعد.'),
    ('هل يمكنني جمعها مع السشوار؟', 'نعم. اختاري الاثنين عند انضمامكِ إلى الطابور، وتخبركِ مصففتكِ بالوقت الإجمالي.'),
    ('هل الدشّ خاص؟', 'نعم، دشّ خاص بكِ مع منشفة ومستحضرات: {x_shower} درهم وحده، أو ضمن الطقوس الكاملة.'),
    ('ما المشروبات المتوفرة؟', 'قهوة وشاي وكرك وماتشا وعصير طازج من ركن المشروبات.')])),
]

AREAS = [
 dict(slug='al-barsha-mall-of-the-emirates', place='Al Barsha', place_ar='البرشاء', img='look-waves.webp', guide='humidity', show=['express', 'waves', 'night'],
  rel_s=['walk-in-blow-dry-dubai', 'hollywood-waves-dubai', 'hair-care-ritual-dubai'],
  en=dict(title='Blow-Dry Near Al Barsha & Mall of the Emirates', nav='Al Barsha & Mall of the Emirates',
   desc='A women-only walk-in blow-dry lounge opening off Sheikh Zayed Road, a short drive from Al Barsha and Mall of the Emirates. No appointment.',
   h1='A walk-in blow-dry near Al Barsha and Mall of the Emirates',
   alt='Soft waves styled by a miniature QAMAR team, the Marina Waves look',
   lead='If you live in Al Barsha or spend your weekends around Mall of the Emirates, QAMAR will be one of the closest walk-in blow-dry options on Sheikh Zayed Road: it opens off the road, a short drive from Al Barsha, towards DIFC.',
   body=[('h2', 'Getting there from Al Barsha'),
    ('ul', ['Mall of the Emirates sits at the western end of the stretch where QAMAR opens, so you drive towards DIFC on Sheikh Zayed Road rather than away from the city.', 'There is a Salik toll gate on Sheikh Zayed Road near Al Barsha. Check your route if you prefer to avoid it.', 'At weekends the roads around the mall get busy from late afternoon. A morning blow-dry is the calm option.']),
    ('h2', 'Good moments to come'),
    ('ul', ['Saturday morning, before a family lunch.', 'After the school drop-off on weekdays, during the planned happy hours (10 AM to 3 PM, −{happy}%).', 'Before a mall evening or a cinema night, with Night Glow from 8 PM.']),
    ('h2', 'Which look for which plan'),
    ('prices', ['express', 'waves', 'night']),
    ('p', 'Brunch or a family visit: Marina Waves. A busy weekday: Qamar Express, 35 minutes or it is on us. A late dinner: Night Glow, any blow-dry with a matcha on us.'),
    ('p', 'QAMAR opens in March 2027. The exact address and parking details will be shared before opening.')],
   faq=[('Is QAMAR inside Mall of the Emirates?', 'No. QAMAR opens off Sheikh Zayed Road, between Mall of the Emirates and DIFC. The exact address will be announced before opening.'),
    ('Do I need to book?', 'No. QAMAR is walk-in only; you join the queue from your phone when you arrive.'),
    ('Is there parking?', 'Parking details will be shared with the address before opening.')]),
  ar=dict(title='سشوار قرب البرشاء ومول الإمارات', nav='البرشاء ومول الإمارات',
   desc='صالون سشوار نسائي بدون موعد يفتح قرب شارع الشيخ زايد، على مسافة قصيرة بالسيارة من البرشاء ومول الإمارات. الافتتاح مارس ٢٠٢٧.',
   h1='سشوار بدون موعد قرب البرشاء ومول الإمارات',
   alt='تموجات ناعمة من فرقة قمر الصغيرة، إطلالة أمواج المارينا',
   lead='إذا كنتِ تسكنين في البرشاء أو تقضين عطلتكِ حول مول الإمارات، فسيكون قمر من أقرب صالونات السشوار بدون موعد على شارع الشيخ زايد: يفتح قرب الشارع، على مسافة قصيرة بالسيارة من البرشاء باتجاه مركز دبي المالي.',
   body=[('h2', 'الوصول من البرشاء'),
    ('ul', ['يقع مول الإمارات عند الطرف الغربي للمسافة التي يفتح فيها قمر، فتقودين باتجاه مركز دبي المالي على شارع الشيخ زايد.', 'توجد بوابة سالك على شارع الشيخ زايد قرب البرشاء. راجعي طريقكِ إذا كنتِ تفضّلين تجنبها.', 'في العطلة تزدحم الطرق حول المول من آخر العصر. سشوار الصباح هو الخيار الهادئ.']),
    ('h2', 'أوقات مناسبة للمجيء'),
    ('ul', ['صباح السبت، قبل غداء العائلة.', 'بعد توصيل الأولاد إلى المدرسة أيام الأسبوع، خلال عروض الظهيرة المخطط لها (من ١٠ صباحاً حتى ٣ عصراً، خصم {happy}٪).', 'قبل سهرة في المول أو السينما، مع توهّج الليل من ٨ مساءً.']),
    ('h2', 'أي إطلالة لأي مشوار'),
    ('prices', ['express', 'waves', 'night']),
    ('p', 'برانش أو زيارة عائلية: أمواج المارينا. يوم عمل مزدحم: قمر إكسبريس، ٣٥ دقيقة أو مجاناً. عشاء متأخر: توهّج الليل، أي سشوار مع ماتشا على حسابنا.'),
    ('p', 'يفتح قمر في مارس ٢٠٢٧. يُعلن العنوان الدقيق وتفاصيل المواقف قبل الافتتاح.')],
   faq=[('هل قمر داخل مول الإمارات؟', 'لا. يفتح قمر قرب شارع الشيخ زايد بين مول الإمارات ومركز دبي المالي العالمي. يُعلن العنوان الدقيق قبل الافتتاح.'),
    ('هل أحتاج إلى حجز؟', 'لا. قمر بدون مواعيد؛ تنضمين إلى الطابور من هاتفكِ عند وصولكِ.'),
    ('هل توجد مواقف سيارات؟', 'تُعلن تفاصيل المواقف مع العنوان قبل الافتتاح.')])),

 dict(slug='al-quoz', place='Al Quoz', place_ar='القوز', img='look-express.webp', guide='afterwork', show=['express', 'sos', 'sleek'],
  rel_s=['express-blow-dry-dubai', 'evening-hair-dubai', 'hair-care-ritual-dubai'],
  en=dict(title='Blow-Dry Salon Near Al Quoz, Sheikh Zayed Road', nav='Al Quoz',
   desc='Working in Al Quoz? A women-only walk-in blow-dry lounge is opening off Sheikh Zayed Road, a short drive away. Every look in 45 minutes.',
   h1='A walk-in blow-dry near Al Quoz',
   alt='Smooth, bouncy blow-dry finished by a miniature QAMAR team, the Qamar Express look',
   lead='Al Quoz runs alongside Sheikh Zayed Road: galleries and studios, warehouses turned into offices, and many people who finish work and go straight out. QAMAR opens off Sheikh Zayed Road, a short drive from Al Quoz.',
   body=[('h2', 'After a long day in Al Quoz'),
    ('p', 'Shoots, site visits, gallery set-ups: Al Quoz days are often long and warm. A private shower while your outfit is steamed and perfumed, then a blow-dry, turns a work day into an evening look. Every look on the menu takes 45 minutes or less.'),
    ('h2', 'Getting there'),
    ('ul', ['Al Quoz connects to Sheikh Zayed Road through several interchanges, so from most of the area you reach the main road in a few minutes.', 'If you can, avoid weekday evenings between 5 and 8 PM, when traffic towards Downtown and DIFC is at its heaviest.', 'Al Khail Road, which also crosses Al Quoz, is a useful alternative when Sheikh Zayed Road is jammed.']),
    ('h2', 'Before a gallery evening'),
    ('p', 'Gallery evenings in Al Quoz often start right after work. Come at lunchtime or mid-afternoon for a calmer queue, or choose SOS 15 if you only have a few minutes: a fringe, a sleek ponytail or a quick braid.'),
    ('prices', ['express', 'sos', 'sleek']),
    ('p', 'QAMAR opens in March 2027. The exact address will be announced before opening.')],
   faq=[('Is QAMAR in Al Quoz?', 'No. QAMAR opens off Sheikh Zayed Road, between Mall of the Emirates and DIFC, a short drive from Al Quoz. The address will be announced before opening.'),
    ('Can I come in work clothes and change?', 'Yes. Bring your outfit: it is steamed and perfumed while you take a private shower.'),
    ('How long will the stop take?', 'Every look takes 45 minutes or less. The steaming happens while you shower, so the ritual adds little time.')]),
  ar=dict(title='صالون سشوار قرب القوز وشارع الشيخ زايد', nav='القوز',
   desc='تعملين في القوز؟ صالون سشوار نسائي بدون موعد يفتح قرب شارع الشيخ زايد على مسافة قصيرة بالسيارة. كل إطلالة في ٤٥ دقيقة أو أقل.',
   h1='سشوار بدون موعد قرب القوز',
   alt='سشوار ناعم ومنسدل من فرقة قمر الصغيرة، إطلالة قمر إكسبريس',
   lead='يمتد القوز بمحاذاة شارع الشيخ زايد: معارض واستوديوهات، ومستودعات تحولت إلى مكاتب، وكثيرات ينهين العمل ويخرجن مباشرة. يفتح قمر قرب شارع الشيخ زايد، على مسافة قصيرة بالسيارة من القوز.',
   body=[('h2', 'بعد يوم طويل في القوز'),
    ('p', 'جلسات تصوير، زيارات مواقع، تجهيز معارض: أيام القوز غالباً طويلة وحارة. دشّ خاص بينما نكوي ملابسكِ بالبخار ونعطّرها، ثم سشوار، يحوّل يوم العمل إلى إطلالة سهرة. كل إطلالة في القائمة تأخذ ٤٥ دقيقة أو أقل.'),
    ('h2', 'الوصول'),
    ('ul', ['يتصل القوز بشارع الشيخ زايد عبر عدة تقاطعات، فتصلين إلى الشارع الرئيسي في دقائق من أغلب أنحاء المنطقة.', 'إن استطعتِ، تجنبي أمسيات أيام الأسبوع بين ٥ و٨ مساءً، حين تبلغ الزحمة ذروتها باتجاه داون تاون ومركز دبي المالي.', 'شارع الخيل، الذي يمر أيضاً بالقوز، بديل مفيد عندما يزدحم شارع الشيخ زايد.']),
    ('h2', 'قبل أمسية في المعارض'),
    ('p', 'أمسيات المعارض في القوز تبدأ غالباً بعد الدوام مباشرة. تعالي وقت الغداء أو منتصف العصر لطابور أهدأ، أو اختاري إس أو إس ١٥ إذا كان لديكِ بضع دقائق فقط: غرّة، أو ذيل حصان ناعم، أو ضفيرة سريعة.'),
    ('prices', ['express', 'sos', 'sleek']),
    ('p', 'يفتح قمر في مارس ٢٠٢٧. يُعلن العنوان الدقيق قبل الافتتاح.')],
   faq=[('هل قمر في القوز؟', 'لا. يفتح قمر قرب شارع الشيخ زايد بين مول الإمارات ومركز دبي المالي العالمي، على مسافة قصيرة بالسيارة من القوز. يُعلن العنوان قبل الافتتاح.'),
    ('هل يمكنني المجيء بملابس العمل والتبديل؟', 'نعم. أحضري ملابسكِ: نكويها بالبخار ونعطّرها أثناء دشّكِ الخاص.'),
    ('كم ستستغرق الزيارة؟', 'كل إطلالة ٤٥ دقيقة أو أقل. الكيّ بالبخار يتم أثناء الدشّ، فلا تضيف الطقوس وقتاً يُذكر.')])),

 dict(slug='business-bay-downtown', place='Business Bay', place_ar='الخليج التجاري', img='look-sos.webp', guide='afterwork', show=['express', 'sos', 'night'],
  rel_s=['express-blow-dry-dubai', 'blow-dry-membership-dubai', 'evening-hair-dubai'],
  en=dict(title='Blow-Dry Near Business Bay & Downtown Dubai', nav='Business Bay & Downtown',
   desc='Office in Business Bay or Downtown? A women-only walk-in blow-dry lounge opens off Sheikh Zayed Road in March 2027. Lunch break or after work.',
   h1='A walk-in blow-dry near Business Bay and Downtown Dubai',
   alt='Quick sleek ponytail styled by a miniature QAMAR team, the SOS 15 look',
   lead='Business Bay and Downtown are where many women in Dubai work, and where many evenings begin. QAMAR opens off Sheikh Zayed Road, a short drive from both, for a blow-dry at lunch or on the way from the office to dinner.',
   body=[('h2', 'A lunch-break blow-dry'),
    ('p', 'Qamar Express takes 35 minutes, or it is on us, and SOS 15 takes fifteen. During the planned happy hours, 10 AM to 3 PM on weekdays, blow-dries are {happy}% off.'),
    ('prices', ['express', 'sos', 'night']),
    ('h2', 'From the office to dinner'),
    ('ul', ['Leave the office a little before the evening rush if you can: Sheikh Zayed Road and the roads around Downtown are heaviest between 5 and 8 PM.', 'Bring your outfit in a bag. It is steamed and perfumed while you take a private shower.', 'From 8 PM, Night Glow gives you any blow-dry with a matcha on us.']),
    ('h2', 'Every week, for less'),
    ('p', 'If you have a blow-dry every week for meetings and presentations, the QAMAR Club Half Moon plan covers one a week with the extras included, and the price drops {drop}% every month you stay, down to −{floor}%.'),
    ('p', 'QAMAR opens in March 2027. The exact address will be announced before opening.')],
   faq=[('Is QAMAR in Downtown Dubai or Business Bay?', 'No. QAMAR opens off Sheikh Zayed Road, between Mall of the Emirates and DIFC, a short drive from Business Bay and Downtown.'),
    ('Can I fit a blow-dry into a lunch break?', 'Yes. Qamar Express takes 35 minutes or it is on us, and SOS 15 takes 15 minutes.'),
    ('Is there a plan for weekly blow-dries?', 'Yes, the Half Moon plan: one blow-dry a week, {half} AED a month (indicative), with the price dropping every month.')]),
  ar=dict(title='سشوار قرب الخليج التجاري وداون تاون دبي', nav='الخليج التجاري وداون تاون',
   desc='مكتبكِ في الخليج التجاري أو داون تاون؟ صالون سشوار نسائي بدون موعد يفتح قرب شارع الشيخ زايد في مارس ٢٠٢٧. في الغداء أو بعد الدوام.',
   h1='سشوار بدون موعد قرب الخليج التجاري وداون تاون دبي',
   alt='ذيل حصان ناعم وسريع من فرقة قمر الصغيرة، إطلالة إس أو إس ١٥',
   lead='الخليج التجاري وداون تاون حيث تعمل كثير من النساء في دبي، ومن هناك تبدأ كثير من السهرات. يفتح قمر قرب شارع الشيخ زايد على مسافة قصيرة بالسيارة من المنطقتين، لسشوار في استراحة الغداء أو في الطريق من المكتب إلى العشاء.',
   body=[('h2', 'سشوار في استراحة الغداء'),
    ('p', 'قمر إكسبريس يأخذ ٣٥ دقيقة أو يكون مجاناً، وإس أو إس ١٥ يأخذ خمس عشرة دقيقة. خلال عروض الظهيرة المخطط لها، من ١٠ صباحاً حتى ٣ عصراً أيام الأسبوع، خصم {happy}٪ على السشوار.'),
    ('prices', ['express', 'sos', 'night']),
    ('h2', 'من المكتب إلى العشاء'),
    ('ul', ['اخرجي من المكتب قبل زحمة المساء بقليل إن استطعتِ: شارع الشيخ زايد والطرق حول داون تاون في ذروتها بين ٥ و٨ مساءً.', 'أحضري ملابسكِ في حقيبة. نكويها بالبخار ونعطّرها أثناء دشّكِ الخاص.', 'من ٨ مساءً، توهّج الليل يمنحكِ أي سشوار مع ماتشا على حسابنا.']),
    ('h2', 'كل أسبوع، بسعر أقل'),
    ('p', 'إذا كنتِ تصففين شعركِ كل أسبوع للاجتماعات والعروض، فاشتراك نصف القمر في نادي قمر يشمل سشواراً أسبوعياً مع الإضافات، وسعره ينخفض {drop}٪ كل شهر تبقين فيه حتى −{floor}٪.'),
    ('p', 'يفتح قمر في مارس ٢٠٢٧. يُعلن العنوان الدقيق قبل الافتتاح.')],
   faq=[('هل قمر في داون تاون أو الخليج التجاري؟', 'لا. يفتح قمر قرب شارع الشيخ زايد بين مول الإمارات ومركز دبي المالي العالمي، على مسافة قصيرة بالسيارة من الخليج التجاري وداون تاون.'),
    ('هل يكفي وقت الغداء للسشوار؟', 'نعم. قمر إكسبريس ٣٥ دقيقة أو مجاناً، وإس أو إس ١٥ يأخذ ١٥ دقيقة.'),
    ('هل يوجد اشتراك للسشوار الأسبوعي؟', 'نعم، اشتراك نصف القمر: سشوار كل أسبوع، {half} درهم شهرياً (سعر تقريبي)، وسعره ينخفض كل شهر.')])),

 dict(slug='difc-trade-centre', place='DIFC', place_ar='مركز دبي المالي العالمي', img='look-sleek.webp', guide='afterwork', show=['express', 'sleek', 'night'],
  rel_s=['blowout-dubai', 'express-blow-dry-dubai', 'evening-hair-dubai'],
  en=dict(title='Blow-Dry Near DIFC & Trade Centre, Dubai', nav='DIFC & Trade Centre',
   desc='Near DIFC or Trade Centre? A women-only walk-in blow-dry lounge opens off Sheikh Zayed Road in March 2027. Before work, at lunch or late.',
   h1='A walk-in blow-dry near DIFC and the Trade Centre',
   alt='Long, glass-straight hair polished by a miniature QAMAR team, the Midnight Sleek look',
   lead='DIFC and the Trade Centre area sit at the eastern end of the stretch where QAMAR opens, off Sheikh Zayed Road. Early meetings, client dinners, conference days: the planned hours, 8 AM to midnight, are made for that rhythm.',
   body=[('h2', 'Before an early meeting'),
    ('p', 'With a planned opening time of 8 AM, a Qamar Express before a 9 AM meeting is realistic if you are among the first in the queue. It takes 35 minutes, or it is on us.'),
    ('h2', 'Exhibition and conference days'),
    ('p', 'When large exhibitions run at Dubai World Trade Centre, the roads around the area fill up quickly, especially in the morning and when the halls close. Leave extra time on those days, or come for your blow-dry before the crowds.'),
    ('h2', 'A sleek look for client dinners'),
    ('p', 'Midnight Sleek is the look that holds best through a long evening indoors and the short walk outside. For a dinner after 8 PM, Night Glow gives you any blow-dry with a matcha on us.'),
    ('prices', ['express', 'sleek', 'night']),
    ('p', 'QAMAR opens in March 2027. The exact address will be announced before opening.')],
   faq=[('Is QAMAR in DIFC?', 'No. QAMAR opens off Sheikh Zayed Road, between Mall of the Emirates and DIFC, a short drive from DIFC and the Trade Centre.'),
    ('Is QAMAR open early in the morning?', 'Planned hours are 8 AM to midnight. They will be confirmed before opening.'),
    ('Which look lasts best for a business dinner?', 'Midnight Sleek: glass-straight and glossy, it holds best in humidity.')]),
  ar=dict(title='سشوار قرب مركز دبي المالي والمركز التجاري', nav='مركز دبي المالي والمركز التجاري',
   desc='قريبة من مركز دبي المالي أو المركز التجاري العالمي؟ صالون سشوار نسائي بدون موعد يفتح قرب شارع الشيخ زايد في مارس ٢٠٢٧.',
   h1='سشوار بدون موعد قرب مركز دبي المالي والمركز التجاري',
   alt='شعر طويل مفرود كالزجاج تلمّعه فرقة قمر الصغيرة، إطلالة ميدنايت سليك',
   lead='يقع مركز دبي المالي العالمي ومنطقة المركز التجاري عند الطرف الشرقي للمسافة التي يفتح فيها قمر قرب شارع الشيخ زايد. اجتماعات مبكرة، عشاء مع عملاء، أيام مؤتمرات: الساعات المخطط لها، من ٨ صباحاً حتى منتصف الليل، تناسب هذا الإيقاع.',
   body=[('h2', 'قبل اجتماع مبكر'),
    ('p', 'مع افتتاح مخطط له في الثامنة صباحاً، يمكنكِ أخذ قمر إكسبريس قبل اجتماع التاسعة إذا كنتِ من أوائل الطابور. يأخذ ٣٥ دقيقة أو يكون مجاناً.'),
    ('h2', 'أيام المعارض والمؤتمرات'),
    ('p', 'عندما تُقام معارض كبيرة في مركز دبي التجاري العالمي، تمتلئ الطرق حول المنطقة بسرعة، خاصة صباحاً وعند إغلاق القاعات. خصصي وقتاً إضافياً في تلك الأيام، أو تعالي للسشوار قبل الزحمة.'),
    ('h2', 'إطلالة ناعمة لعشاء العمل'),
    ('p', 'ميدنايت سليك هي الإطلالة التي تصمد أفضل خلال سهرة طويلة في الداخل والمشي القصير في الخارج. ولعشاء بعد ٨ مساءً، توهّج الليل يمنحكِ أي سشوار مع ماتشا على حسابنا.'),
    ('prices', ['express', 'sleek', 'night']),
    ('p', 'يفتح قمر في مارس ٢٠٢٧. يُعلن العنوان الدقيق قبل الافتتاح.')],
   faq=[('هل قمر في مركز دبي المالي العالمي؟', 'لا. يفتح قمر قرب شارع الشيخ زايد بين مول الإمارات ومركز دبي المالي العالمي، على مسافة قصيرة بالسيارة من المركز المالي والمركز التجاري.'),
    ('هل يفتح قمر في الصباح الباكر؟', 'الساعات المخطط لها من ٨ صباحاً حتى منتصف الليل، وتُؤكَّد قبل الافتتاح.'),
    ('أي إطلالة تدوم أكثر لعشاء عمل؟', 'ميدنايت سليك: مفرودة ولامعة كالزجاج، وهي الأكثر صموداً في الرطوبة.')])),

 dict(slug='jumeirah', place='Jumeirah', place_ar='جميرا', img='look-care.webp', guide='humidity', show=['care', 'waves', 'mini'],
  rel_s=['hair-care-ritual-dubai', 'women-only-salon-dubai', 'hollywood-waves-dubai'],
  en=dict(title='Blow-Dry Near Jumeirah, Women-Only & Walk-In', nav='Jumeirah',
   desc='Living in Jumeirah, Umm Suqeim or Al Safa? A women-only walk-in blow-dry lounge opens off Sheikh Zayed Road in March 2027, a short drive away.',
   h1='A women-only walk-in blow-dry near Jumeirah',
   alt='Hair care ritual with mask and steam prepared by a miniature QAMAR team, the Moon Ritual',
   lead='Jumeirah lies between the beach and Sheikh Zayed Road. From Umm Suqeim, Al Safa or Al Wasl Road, the main road is only a few minutes inland, and QAMAR opens just off it, a short drive from Jumeirah.',
   body=[('h2', 'From the beach to the evening'),
    ('p', 'Salt water, sun and sand are hard on hair. The Moon Ritual (a wash, a mask and steam in about 30 minutes) followed by a blow-dry brings it back before dinner. Add a private shower while your outfit is steamed and perfumed, and you go straight from the beach to the evening.'),
    ('prices', ['care', 'waves', 'mini']),
    ('h2', 'Getting there'),
    ('ul', ['From Umm Suqeim, Al Thanya Road and the other interchanges take you up to Sheikh Zayed Road in a few minutes.', 'Around school times, roughly 7 to 8 AM and early afternoon, the roads near Jumeirah schools are slower. Mid-morning is the easy window.', 'Planned happy hours, 10 AM to 3 PM on weekdays, take {happy}% off.']),
    ('h2', 'With your daughter'),
    ('p', 'Mini Glow is a mini blow-dry or braids for girls, in about 25 minutes, for birthdays, Eid or a school event. It is women-only, so mothers and daughters can both relax.'),
    ('p', 'QAMAR opens in March 2027. The exact address will be announced before opening.')],
   faq=[('Is QAMAR in Jumeirah?', 'No. QAMAR opens off Sheikh Zayed Road, between Mall of the Emirates and DIFC, a short drive from Jumeirah.'),
    ('Do you style children’s hair?', 'Yes. Mini Glow: a mini blow-dry or braids for girls, {mini} AED (indicative).'),
    ('Can I come straight from the beach?', 'Yes. Take a private shower, have your outfit steamed, then choose the Moon Ritual or a blow-dry.')]),
  ar=dict(title='سشوار قرب جميرا، صالون نسائي بدون موعد', nav='جميرا',
   desc='تسكنين في جميرا أو أم سقيم أو الصفا؟ صالون سشوار نسائي بدون موعد يفتح قرب شارع الشيخ زايد في مارس ٢٠٢٧، على مسافة قصيرة بالسيارة.',
   h1='سشوار نسائي بدون موعد قرب جميرا',
   alt='طقوس العناية بالشعر بالماسك والبخار من فرقة قمر الصغيرة، طقوس القمر',
   lead='تقع جميرا بين الشاطئ وشارع الشيخ زايد. من أم سقيم أو الصفا أو شارع الوصل، الشارع الرئيسي على بعد دقائق فقط، ويفتح قمر بالقرب منه، على مسافة قصيرة بالسيارة من جميرا.',
   body=[('h2', 'من الشاطئ إلى السهرة'),
    ('p', 'ماء البحر والشمس والرمل قاسية على الشعر. طقوس القمر (غسل وماسك وبخار في حوالي ٣٠ دقيقة) ثم السشوار تعيد إليه حيويته قبل العشاء. أضيفي دشّاً خاصاً بينما نكوي ملابسكِ بالبخار ونعطّرها، فتنتقلين من الشاطئ إلى السهرة مباشرة.'),
    ('prices', ['care', 'waves', 'mini']),
    ('h2', 'الوصول'),
    ('ul', ['من أم سقيم، يوصلكِ شارع الثنية والتقاطعات الأخرى إلى شارع الشيخ زايد في دقائق.', 'في أوقات المدارس، تقريباً من ٧ إلى ٨ صباحاً وبداية الظهر، تكون الطرق قرب مدارس جميرا أبطأ. منتصف الصباح هو الوقت الأسهل.', 'عروض الظهيرة المخطط لها، من ١٠ صباحاً حتى ٣ عصراً أيام الأسبوع، بخصم {happy}٪.']),
    ('h2', 'مع ابنتكِ'),
    ('p', 'ميني جلو سشوار خفيف أو ضفائر للصغيرات في حوالي ٢٥ دقيقة، لعيد ميلاد أو للعيد أو لحفلة المدرسة. والصالون نسائي بالكامل، فترتاح الأم والابنة معاً.'),
    ('p', 'يفتح قمر في مارس ٢٠٢٧. يُعلن العنوان الدقيق قبل الافتتاح.')],
   faq=[('هل قمر في جميرا؟', 'لا. يفتح قمر قرب شارع الشيخ زايد بين مول الإمارات ومركز دبي المالي العالمي، على مسافة قصيرة بالسيارة من جميرا.'),
    ('هل تصففون شعر الصغيرات؟', 'نعم. ميني جلو: سشوار خفيف أو ضفائر للصغيرات، {mini} درهم (سعر تقريبي).'),
    ('هل يمكنني المجيء من الشاطئ مباشرة؟', 'نعم. خذي دشّاً خاصاً، ونكوي ملابسكِ بالبخار، ثم اختاري طقوس القمر أو السشوار.')])),
]

HUB = dict(
 en=dict(title='Blow-Dry Services & Areas in Dubai', h1='Blow-dry services and areas in Dubai',
  desc='Every QAMAR service in Dubai: walk-in blow-dry, sleek blowout, waves, express, evening hair, hair care, the Club, and the areas nearby.',
  lead='QAMAR is a women-only walk-in blow-dry lounge opening in March 2027 off Sheikh Zayed Road, between Mall of the Emirates and DIFC. Every look takes 45 minutes or less, with no appointment. Here is everything we do, and the areas we will be closest to.',
  sh='Services', ah='Areas near the lounge',
  aintro='The exact address will be announced before opening. These pages explain how to reach the lounge from each area, with honest local tips.',
  faq=[('Where exactly will QAMAR open?', 'Off Sheikh Zayed Road, between Mall of the Emirates and DIFC. The exact address will be announced before opening.'),
   ('Are prices final?', 'No. Prices on these pages are indicative, in AED, and will be confirmed before the March 2027 opening.'),
   ('Do I need an appointment?', 'Never. QAMAR is walk-in only, for women only, with an all-female team.')]),
 ar=dict(title='خدمات السشوار والمناطق في دبي', h1='خدمات السشوار والمناطق في دبي',
  desc='كل خدمات قمر في دبي: سشوار بدون موعد، فرد ناعم، تموجات، سشوار سريع، تسريحات السهرة، العناية بالشعر، النادي، والمناطق القريبة.',
  lead='قمر صالون سشوار نسائي بدون موعد يفتح في مارس ٢٠٢٧ قرب شارع الشيخ زايد، بين مول الإمارات ومركز دبي المالي العالمي. كل إطلالة في ٤٥ دقيقة أو أقل، بدون موعد. إليكِ كل ما نقدمه، والمناطق الأقرب إلينا.',
  sh='الخدمات', ah='المناطق القريبة',
  aintro='يُعلن العنوان الدقيق قبل الافتتاح. تشرح هذه الصفحات كيف تصلين إلينا من كل منطقة، مع نصائح محلية صادقة.',
  faq=[('أين سيفتح قمر بالضبط؟', 'قرب شارع الشيخ زايد، بين مول الإمارات ومركز دبي المالي العالمي. يُعلن العنوان الدقيق قبل الافتتاح.'),
   ('هل الأسعار نهائية؟', 'لا. الأسعار في هذه الصفحات تقريبية بالدرهم، وتُؤكَّد قبل الافتتاح في مارس ٢٠٢٧.'),
   ('هل أحتاج إلى موعد؟', 'أبداً. قمر بدون مواعيد، للنساء فقط، بفريق نسائي بالكامل.')]))

UI = {
 'en': dict(dir='ltr', loc='en_AE', brand='QAMAR', home='Home', hub='Services & areas', sign='© QAMAR Blowdry Lounge · Dubai', other='العربية',
   look='Look', svc='Service', time='Time', price='Indicative price', extra='Extra', mins='min', faq='Frequently asked questions',
   good='Good to know', explore='On the home page', looks='See all looks', menu='Full menu and prices', club='QAMAR Club',
   related='Related services', areas='Nearby areas', guide='Guide', cta='Discover QAMAR',
   facts=['Opening March 2027, off Sheikh Zayed Road (between Mall of the Emirates and DIFC). Exact address announced before opening.', 'Women only, all-female team, Arabic and English.', 'Walk-in only: no appointment, every look in 45 minutes or less.', 'Planned hours: 8 AM to midnight (to be confirmed).', 'Prices are indicative, in AED, and confirmed before opening.'],
   plan='Plan', visits='Blow-dries', m1='Month 1', mfm='Month {m}', mfl='Month {m} onwards', perm='/ month', crumbs_hub='Services & areas'),
 'ar': dict(dir='rtl', loc='ar_AE', brand='قمر', home='الرئيسية', hub='الخدمات والمناطق', sign='© قمر بلودراي لاونج · دبي', other='English',
   look='الإطلالة', svc='الخدمة', time='المدة', price='السعر التقريبي', extra='الإضافة', mins='دقيقة', faq='أسئلة شائعة',
   good='معلومات مهمة', explore='في الصفحة الرئيسية', looks='كل الإطلالات', menu='القائمة الكاملة والأسعار', club='نادي قمر',
   related='خدمات ذات صلة', areas='مناطق قريبة', guide='دليل', cta='اكتشفي قمر',
   facts=['الافتتاح مارس ٢٠٢٧ قرب شارع الشيخ زايد (بين مول الإمارات ومركز دبي المالي العالمي). يُعلن العنوان الدقيق قبل الافتتاح.', 'للنساء فقط، فريق نسائي بالكامل، بالعربية والإنجليزية.', 'بدون موعد: كل إطلالة في ٤٥ دقيقة أو أقل.', 'الساعات المخطط لها: من ٨ صباحاً حتى منتصف الليل (تُؤكَّد لاحقاً).', 'الأسعار تقريبية بالدرهم، وتُؤكَّد قبل الافتتاح.'],
   plan='الاشتراك', visits='السشوارات', m1='الشهر ١', mfm='الشهر {m}', mfl='من الشهر {m}', perm='/ شهرياً', crumbs_hub='الخدمات والمناطق'),
}

CSS = """:root{--night:#120B0F;--rose:#C9788F;--rose-ink:#A4506A;--gold:#C49A5A;--cream:#FAF5F0;--ink:#1F1417;--ink2:#5E4A50;--line:rgba(196,154,90,.35)}*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--cream);color:var(--ink);font:300 18px/1.7 Jost,system-ui,sans-serif}a{color:var(--rose-ink)}header,footer{background:linear-gradient(120deg,#F8E1DC,#F3D3D6 60%,#EFC6CC);color:var(--ink)}header .w,footer .w{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;min-height:68px}header nav,footer nav{display:flex;gap:18px;flex-wrap:wrap}header nav a,footer nav a{color:var(--ink);min-height:44px;display:inline-flex;align-items:center;text-decoration:none}.w{width:min(780px,100% - 32px);margin:auto}.brand{color:var(--ink);text-decoration:none;font:500 22px 'Cormorant Garamond',serif;letter-spacing:.3em}.crumbs{font-size:14px;color:var(--ink2);margin:20px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px}.crumbs li+li:before{content:'›';margin-inline-end:6px}h1,h2,h3{font-family:'Cormorant Garamond',serif;font-weight:500;line-height:1.15}h1{font-size:clamp(34px,6vw,52px);margin:20px 0 16px}h2{font-size:30px;margin:40px 0 8px}h3{font-size:22px;margin:22px 0 4px}.lead{color:var(--ink2);font-size:20px}li{margin:6px 0}figure{margin:28px 0}figure img{display:block;width:100%;height:auto;max-height:520px;object-fit:cover;border-radius:18px}.tbl{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:16px;margin:12px 0}th,td{text-align:start;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{font-weight:500}td.n{white-space:nowrap}.note{font-size:14px;color:var(--ink2)}.box{background:#fff;border:1px solid var(--line);border-radius:18px;padding:8px 22px;margin:36px 0}.box ul{padding-inline-start:20px}.cards{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.cards li{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 18px;margin:0}.cards a{font-weight:500;text-decoration:none}.cards p{margin:4px 0 0;font-size:15px;color:var(--ink2)}.cta{display:inline-flex;align-items:center;min-height:52px;padding:0 28px;border-radius:999px;background:var(--rose-ink);color:#fff;text-decoration:none;font-weight:500;margin:28px 0}.more{border-top:1px solid var(--line);margin-top:40px;padding-top:8px}footer{margin-top:64px;font-size:15px}:focus-visible{outline:2px solid var(--gold);outline-offset:3px}"""
CSS_AR = "body{font-family:Tajawal,system-ui,sans-serif}h1,h2,h3{font-family:Tajawal,serif;font-weight:500;line-height:1.35}h1{font-size:clamp(30px,5.4vw,46px)}h2{font-size:27px}h3{font-size:20px}.brand{font-family:Tajawal,serif;letter-spacing:.05em}"

# ---------- Rendu ----------
def url_of(kind, slug, lang):
    base = kind + ('/ar/' if lang == 'ar' else '/')
    return base + ('' if slug == 'index' else slug + '.html')

def ref(P, kind, slug, lang):
    return P + url_of(kind, slug, lang)

def home(P, lang, anchor=''):
    return P + ('ar.html' if lang == 'ar' else '') + anchor if (lang == 'ar' or anchor) else P

def prices_table(ids, lang):
    u = UI[lang]
    rows = ''.join(f'<tr><td>{E(SV[i]["look"][lang])}</td><td>{E(SV[i]["name"][lang])}</td><td class="n">{num(SV[i]["dur"], lang)} {u["mins"]}</td><td class="n">{aed(SV[i]["price"], lang)}</td></tr>' for i in ids)
    return f'<div class="tbl"><table><thead><tr><th>{u["look"]}</th><th>{u["svc"]}</th><th>{u["time"]}</th><th>{u["price"]}</th></tr></thead><tbody>{rows}</tbody></table></div>'

def extras_table(ids, lang):
    u = UI[lang]
    rows = ''.join(f'<tr><td>{E(EX[i]["name"][lang])}</td><td class="n">{aed(EX[i]["price"], lang)}</td></tr>' for i in ids)
    return f'<div class="tbl"><table><thead><tr><th>{u["extra"]}</th><th>{u["price"]}</th></tr></thead><tbody>{rows}</tbody></table></div>'

def tiers_table(lang):
    u = UI[lang]
    rows = ''.join(f'<tr><td>{E(t["name"][lang])}</td><td>{E(t["per"][lang])}</td><td class="n">{aed(t["price"], lang)} {u["perm"]}</td></tr>' for t in TIERS)
    return f'<div class="tbl"><table><thead><tr><th>{u["plan"]}</th><th>{u["visits"]}</th><th>{u["price"]} ({u["m1"]})</th></tr></thead><tbody>{rows}</tbody></table></div>'

def drop_table(lang):
    u = UI[lang]; ms = [1, 4, FLOOR_MONTH]
    hd = [u['m1'], u['mfm'].replace('{m}', num(4, lang)), u['mfl'].replace('{m}', num(FLOOR_MONTH, lang))]
    rows = ''.join('<tr><td>' + E(t['name'][lang]) + '</td>' + ''.join(f'<td class="n">{aed(club_price(t["price"], m), lang)}</td>' for m in ms) + '</tr>' for t in TIERS)
    return f'<div class="tbl"><table><thead><tr><th>{u["plan"]}</th>' + ''.join(f'<th>{h}</th>' for h in hd) + f'</tr></thead><tbody>{rows}</tbody></table></div>'

def block(t, v, lang):
    if t == 'ul': return '<ul>' + ''.join(f'<li>{E(fill(x, lang))}</li>' for x in v) + '</ul>'
    if t == 'prices': return prices_table(v, lang)
    if t == 'extras': return extras_table(v, lang)
    if t == 'tiers': return tiers_table(lang)
    if t == 'drop': return drop_table(lang)
    if t == 'perks': return '<ul>' + ''.join(f'<li>{E(p[0] if lang == "en" else p[1])}</li>' for p in PERKS) + '</ul>'
    return f'<{t}>{E(fill(v, lang))}</{t}>'

SBY = {s['slug']: s for s in SERVICES}; ABY = {a['slug']: a for a in AREAS}

def text_of(h):
    m = re.search(r'<main[^>]*>(.*)</main>', h, re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', m[1]))).strip()

def page(kind, item, lang):
    """kind: 'services' | 'areas' ; item = dict ; slug 'index' for hub."""
    u = UI[lang]; c = item[lang]; slug = item['slug']
    P = '../../' if lang == 'ar' else '../'
    url = SITE + url_of(kind, slug, lang); en_url = SITE + url_of(kind, slug, 'en'); ar_url = SITE + url_of(kind, slug, 'ar')
    other_href = (f'../{slug}.html' if slug != 'index' else '../') if lang == 'ar' else (f'ar/{slug}.html' if slug != 'index' else 'ar/')
    title = f"{c['title']} | {u['brand']}"
    assert len(title) <= 60, (len(title), title)
    assert len(c['desc']) <= 155, (len(c['desc']), c['desc'])
    home_abs = SITE + ('ar.html' if lang == 'ar' else '')
    hub_abs = SITE + url_of('services', 'index', lang)
    is_hub = slug == 'index'
    crumbs = [(u['brand'], home_abs, home(P, lang))]
    if not is_hub: crumbs.append((u['crumbs_hub'], hub_abs, ref(P, 'services', 'index', lang)))
    crumbs.append((c['h1'], url, None))
    graph = [
      {"@type": "WebPage", "@id": url + '#webpage', "url": url, "name": title, "description": c['desc'], "inLanguage": lang,
       "isPartOf": {"@type": "WebSite", "name": "QAMAR Blowdry Lounge", "url": SITE}, "about": {"@id": SITE + "#salon"},
       "breadcrumb": {"@id": url + '#breadcrumb'}, "datePublished": DATE, "dateModified": DATE},
      {"@type": "BreadcrumbList", "@id": url + '#breadcrumb', "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": a} for i, (n, a, _) in enumerate(crumbs)]}]
    faq = [(fill(q, lang), fill(a, lang)) for q, a in c['faq']]
    graph.append({"@type": "FAQPage", "@id": url + '#faq', "inLanguage": lang, "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]})
    if kind == 'services' and not is_hub:
        graph.append({"@type": "Service", "@id": url + '#service', "name": c['h1'], "serviceType": c['stype'], "description": c['desc'], "url": url,
                      "provider": {"@id": SITE + "#salon"}, "areaServed": {"@type": "City", "name": "Dubai"}, "audience": {"@type": "PeopleAudience", "suggestedGender": "female"}})
    if kind == 'areas':
        place = item['place'] if lang == 'en' else item['place_ar']
        graph.append({"@type": "Service", "@id": url + '#service', "name": c['h1'], "serviceType": 'Blow-dry' if lang == 'en' else 'سشوار', "description": c['desc'], "url": url,
                      "provider": {"@id": SITE + "#salon"}, "areaServed": [{"@type": "Place", "name": place}, {"@type": "City", "name": "Dubai"}], "audience": {"@type": "PeopleAudience", "suggestedGender": "female"}})
    if is_hub:
        items = [(s[lang]['nav'], SITE + url_of('services', s['slug'], lang)) for s in SERVICES] + [(a[lang]['nav'], SITE + url_of('areas', a['slug'], lang)) for a in AREAS]
        graph.append({"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "url": l} for i, (n, l) in enumerate(items)]})
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace('</', '<\\/')

    crumb_html = '<ol class="crumbs">' + ''.join(f'<li><a href="{h}">{E(n)}</a></li>' if h else f'<li aria-current="page">{E(n)}</li>' for n, _, h in crumbs) + '</ol>'
    # Corps
    if is_hub:
        cards_s = ''.join(f'<li><a href="{ref(P, "services", s["slug"], lang)}">{E(s[lang]["nav"])}</a><p>{E(s[lang]["desc"])}</p></li>' for s in SERVICES)
        cards_a = ''.join(f'<li><a href="{ref(P, "areas", a["slug"], lang)}">{E(a[lang]["nav"])}</a><p>{E(a[lang]["desc"])}</p></li>' for a in AREAS)
        body = f'<p class="lead">{E(c["lead"])}</p><h2>{u["sh"] if "sh" in u else c["sh"]}</h2><ul class="cards">{cards_s}</ul><h2>{c["ah"]}</h2><p>{E(c["aintro"])}</p><ul class="cards">{cards_a}</ul>'
        fig = ''
    else:
        img = item['img']; w, h = (640, 823) if img.startswith('look-') else (1200, 800)
        fig = f'<figure><img src="{P}assets/img/{img}" alt="{E(c["alt"])}" width="{w}" height="{h}" loading="lazy" decoding="async"></figure>'
        body = f'<p class="lead">{E(fill(c["lead"], lang))}</p>' + fig + ''.join(block(t, v, lang) for t, v in c['body'])
        body += f'<p class="note">{"Prices are indicative, in AED, and will be confirmed before opening." if lang == "en" else "الأسعار تقريبية بالدرهم وتُؤكَّد قبل الافتتاح."}</p>'
    faq_html = f'<section><h2>{u["faq"]}</h2>' + ''.join(f'<h3>{E(q)}</h3><p>{E(a)}</p>' for q, a in faq) + '</section>'
    good = f'<div class="box"><h2>{u["good"]}</h2><ul>' + ''.join(f'<li>{E(x)}</li>' for x in u['facts']) + '</ul></div>'
    explore = f'<div class="more"><h2>{u["explore"]}</h2><ul><li><a href="{home(P, lang, "#looks")}">{u["looks"]}</a></li><li><a href="{home(P, lang, "#menu")}">{u["menu"]}</a></li><li><a href="{home(P, lang, "#club")}">{u["club"]}</a></li></ul>'
    if not is_hub:
        rs = item['rel'] if kind == 'services' else item['rel_s']
        explore += f'<h2>{u["related"]}</h2><ul>' + ''.join(f'<li><a href="{ref(P, "services", r, lang)}">{E(SBY[r][lang]["nav"])}</a></li>' for r in rs) + '</ul>'
        ar_list = [a for a in AREAS if a['slug'] != slug][:4] if kind == 'areas' else AREAS
        explore += f'<h2>{u["areas"]}</h2><ul>' + ''.join(f'<li><a href="{ref(P, "areas", a["slug"], lang)}">{E(a[lang]["nav"])}</a></li>' for a in ar_list) + '</ul>'
        g = GUIDES[item['guide']]
        explore += f'<h2>{u["guide"]}</h2><ul><li><a href="{P}guides/{"ar/" if lang == "ar" else ""}{g[0]}.html">{E(g[1] if lang == "en" else g[2])}</a></li></ul>'
        explore += f'<p><a href="{ref(P, "services", "index", lang)}">{u["hub"]}</a></p>'
    explore += '</div>'
    t = E(title); d = E(c['desc'])
    og_img = SITE + 'assets/og-qamar.png'
    out = f'''<!doctype html>
<html lang="{lang}" dir="{u['dir']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{en_url}"><link rel="alternate" hreflang="ar" href="{ar_url}"><link rel="alternate" hreflang="x-default" href="{en_url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="QAMAR Blowdry Lounge"><meta property="og:locale" content="{u['loc']}"><meta property="og:locale:alternate" content="{'en_AE' if lang == 'ar' else 'ar_AE'}"><meta property="og:title" content="{t}"><meta property="og:description" content="{d}"><meta property="og:image" content="{og_img}"><meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{d}"><meta name="twitter:image" content="{og_img}">
<meta name="theme-color" content="#F3D3D6">
<script type="application/ld+json">{ld}</script>
<link rel="icon" href="{P}assets/app/favicon-32.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;500{'&family=Tajawal:wght@300;400;500' if lang == 'ar' else ''}&display=swap" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;500{'&family=Tajawal:wght@300;400;500' if lang == 'ar' else ''}&display=swap"></noscript>
<style>{CSS}{CSS_AR if lang == 'ar' else ''}</style>
</head>
<body>
<header><div class="w"><a class="brand" href="{home(P, lang)}" translate="no">QAMAR</a><nav><a href="{ref(P, 'services', 'index', lang)}">{u['hub']}</a><a href="{other_href}" hreflang="{'en' if lang == 'ar' else 'ar'}" lang="{'en' if lang == 'ar' else 'ar'}">{u['other']}</a></nav></div></header>
<main class="w">
{crumb_html}
<h1>{E(c['h1'])}</h1>
{body}
{good}
{faq_html}
<a class="cta" href="{home(P, lang)}">{u['cta']}</a>
{explore}
</main>
<footer><div class="w"><span translate="no">{u['sign']}</span><nav><a href="{home(P, lang)}">{u['home']}</a><a href="{home(P, lang, '#looks')}">{u['looks']}</a><a href="{home(P, lang, '#club')}">{u['club']}</a><a href="{ref(P, 'services', 'index', lang)}">{u['hub']}</a></nav></div></footer>
</body>
</html>
'''
    return out

def write(path, s):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(s)

if __name__ == '__main__':
    report = []
    titles, descs = set(), set()
    for kind, items in (('services', SERVICES), ('areas', AREAS), ('services', [dict(slug='index', en=HUB['en'], ar=HUB['ar'])])):
        for it in items:
            for lang in ('en', 'ar'):
                h = page(kind, it, lang)
                path = url_of(kind, it['slug'], lang) or kind + '/'
                path = path + 'index.html' if path.endswith('/') else path
                write(path, h)
                tt = re.search(r'<title>([^<]+)', h)[1]; dd = re.search(r'name="description" content="([^"]+)', h)[1]
                assert tt not in titles and dd not in descs, ('duplicate', path); titles.add(tt); descs.add(dd)
                words = len(text_of(h).split())
                report.append((path, words))
    for p, w in report: print(f'{w:4d} words  {p}')
    print(len(report), 'pages')
