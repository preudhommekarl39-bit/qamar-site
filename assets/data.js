/* QAMAR — données du salon (prix fictifs pour l'instant) */
window.QAMAR_DATA = {
  brand: {
    name: 'QAMAR',
    nameAr: 'قمر',
    tagline: { en: 'Walk in. Glow out. Open until midnight.', ar: 'ادخلي. تألّقي. مفتوح حتى منتصف الليل.' },
    area: { en: 'Dubai · location announced soon', ar: 'دبي · الموقع يُعلن قريباً' },
    hours: { open: 8, close: 24 },
    whatsapp: '', // numéro WhatsApp Business au format international sans + (ex. 9715XXXXXXXX). Vide = pas encore confirmé : aucun lien WhatsApp n'est affiché
    instagram: 'qamar.dubai', // compte à confirmer avant publication des liens
    hoursConfirmed: false, // passer à true quand les horaires 8h–minuit sont définitifs (active les horaires dans les données structurées)
    instagramConfirmed: false, // passer à true quand les comptes officiels Instagram/TikTok/Snapchat existent (liens affichés + données structurées)
    teamConfirmed: false, // passer à true quand les vraies coiffeuses sont recrutées (prénoms et Instagram affichés comme réels)
    phoneConfirmed: false, // passer à true avec le vrai numéro (ajouté aux données structurées)
    address: null, // { streetAddress, addressLocality: 'Dubai' } — uniquement l'adresse réelle du local signé
  },

  // look = nom signature affiché aux clientes, name = nom de la prestation
  services: [
    { id: 'express', art: 'bouncy', img: 'assets/img/look-express.webp', cat: 'blowdry', look: { en: 'Qamar Express', ar: 'قمر إكسبريس' }, name: { en: 'Express Blow-Dry', ar: 'سشوار سريع' }, desc: { en: 'Smooth, bouncy, done in 35 minutes — or it is on us.', ar: 'ناعم ومنسدل، جاهز خلال ٣٥ دقيقة — أو مجاناً.' }, duration: 35, price: 139, tone: ['#F6D9D2', '#E7B8A8'] },
    { id: 'glow', art: 'glow', img: 'assets/img/look-glow.webp', cat: 'blowdry', look: { en: 'Qamar Glow', ar: 'لمعة قمر' }, name: { en: 'Glow Blow-Dry', ar: 'سشوار اللمعان' }, desc: { en: 'Our signature: mirror shine, airy volume, soft ends.', ar: 'توقيعنا: لمعان كالمرآة وحجم خفيف وأطراف ناعمة.' }, duration: 40, price: 179, tone: ['#F3E2D3', '#D9B48C'] },
    { id: 'waves', art: 'waves', img: 'assets/img/look-waves.webp', cat: 'blowdry', look: { en: 'Marina Waves', ar: 'أمواج المارينا' }, name: { en: 'Waves / Hollywood Curls', ar: 'تموجات / كيرلي هوليوود' }, desc: { en: 'Loose beach waves or glam Hollywood curls.', ar: 'تموجات شاطئية ناعمة أو كيرلي هوليوود الفاخر.' }, duration: 45, price: 199, tone: ['#F4D6CF', '#C9917E'] },
    { id: 'sleek', art: 'straight', img: 'assets/img/look-sleek.webp', cat: 'blowdry', look: { en: 'Midnight Sleek', ar: 'ميدنايت سليك' }, name: { en: 'Sleek Straight', ar: 'فرد ناعم' }, desc: { en: 'Glass-straight, ultra glossy, humidity-proof.', ar: 'فرد كالزجاج، لمعان فائق، مقاوم للرطوبة.' }, duration: 40, price: 169, tone: ['#E9D3D0', '#8E6A6A'] },
    { id: 'night', art: 'night', img: 'assets/img/look-night.webp', cat: 'night', look: { en: 'Night Glow', ar: 'توهّج الليل' }, name: { en: 'Blow-dry of your choice + free matcha', ar: 'سشوار من اختيارك + ماتشا مجانية' }, desc: { en: '8 PM – midnight only. Any blow-dry + a matcha on us.', ar: 'من ٨ مساءً حتى منتصف الليل فقط. أي سشوار + ماتشا مجانية.' }, duration: 45, price: 189, freeMatcha: true, fromHour: 20, tone: ['#3A2630', '#C49A5A'] },
    { id: 'sos', art: 'braid', img: 'assets/img/look-sos.webp', cat: 'sos', look: { en: 'SOS 15', ar: 'إس أو إس ١٥' }, name: { en: 'Fringe, sleek ponytail or quick braid', ar: 'غرّة أو ذيل حصان ناعم أو ضفيرة سريعة' }, desc: { en: 'Late for dinner or a meeting? 15 minutes flat.', ar: 'مستعجلة لعشاء أو اجتماع؟ ١٥ دقيقة فقط.' }, duration: 15, price: 69, tone: ['#F7E4DC', '#E2A48E'] },
    { id: 'care', art: 'drops', img: 'assets/img/look-care.webp', cat: 'care', look: { en: 'Moon Ritual', ar: 'طقوس القمر' }, name: { en: 'Shampoo & Care Ritual', ar: 'غسل الشعر وطقوس العناية' }, desc: { en: 'Velvet wash chair, warm towel, mask and steam.', ar: 'كرسي غسل الشعر مخملي، منشفة دافئة، ماسك وبخار.' }, duration: 30, price: 149, tone: ['#F1E6DE', '#B9A08A'] },
    { id: 'cut', art: 'cut', img: 'assets/img/look-cut.webp', cat: 'colour', look: { en: 'Cut & Glow', ar: 'قص ولمعان' }, name: { en: 'Cut + Blow-Dry', ar: 'قص + سشوار' }, desc: { en: 'A fresh shape, finished with a glow blow-dry.', ar: 'قصة جديدة مع سشوار لامع.' }, duration: 45, price: 279, tone: ['#EFD5CC', '#A97964'] },
    { id: 'root', art: 'root', img: 'assets/img/look-root.webp', cat: 'colour', look: { en: 'Root & Glow', ar: 'جذور ولمعان' }, name: { en: 'Root Touch-Up + Blow-Dry', ar: 'صبغة الجذور + سشوار' }, desc: { en: 'Seamless roots, then the full glow finish.', ar: 'جذور متناسقة ثم لمسة اللمعان الكاملة.' }, duration: 45, price: 379, tone: ['#EAD0C4', '#7F5444'] },
    { id: 'mini', art: 'mini', img: 'assets/img/look-mini.webp', cat: 'kids', look: { en: 'Mini Glow', ar: 'ميني جلو' }, name: { en: 'Mini blow-dry or braids (kids)', ar: 'سشوار أو ضفائر للصغيرات' }, desc: { en: 'For little princesses: mini blow-dry or braids.', ar: 'للأميرات الصغيرات: سشوار خفيف أو ضفائر.' }, duration: 25, price: 89, tone: ['#FBE3E0', '#E9A9A0'] }
  ],

  maxMinutes: 45, // aucune formule ne dépasse 45 min
  maxParty: 6, // visite de groupe : jusqu'à 6 personnes sur un même ticket
  // Affluence en direct (« venez quand c'est calme ») : seuils en minutes d'attente estimée, compteur du salon valable 2 h
  live: { quietMax: 10, moderateMax: 30, staleMinutes: 120, avgMinutes: 30, loungeMax: 30 },
  extraLong: { price: 40, minutes: 0 },

  /* Règles commerciales — SOURCE UNIQUE utilisée par le site, la page cliente, les postes et le dashboard.
     Règle de cumul (VALIDÉE le 17/10/2026) : une seule remise par visite, la plus avantageuse pour la cliente.
     La remise porte sur la prestation (supplément cheveux longs inclus), jamais sur les boissons ni le pourboire. */
  promotions: {
    launch: { enabled: true, label: { en: 'Opening offer', ar: 'عرض الافتتاح' }, firstN: 30, firstPct: 70, restPct: 50 },
    happyHours: { enabled: true, label: { en: 'Happy hours', ar: 'عروض الظهيرة' }, pct: 20, days: [1, 2, 3, 4, 5], fromHour: 10, toHour: 15 }, // lun–ven (week-end UAE : sam–dim)
    // Squad : appliqué automatiquement à chaque personne d'une visite de groupe (un seul ticket, 4 personnes ou plus),
    // sauf si une remise plus forte s'applique à cette personne (règle « une seule remise, la meilleure »)
    squad: { enabled: true, label: { en: 'Squad', ar: 'سكواد' }, minPeople: 4, pct: 25 }
    // Carte 4 brushings, abonnement, anniversaire et parrainage : appliqués manuellement en caisse
    // tant que les règles (justificatifs, plafonds, durée de validité) ne sont pas validées. Voir AUDIT.md.
  },
  guarantee: { serviceIds: ['express'], minutes: 35 }, // mesuré entre « début de prestation » et « fin de prestation », hors attente
  limits: { nameMax: 40, commentMax: 500, tipMaxPct: 100, tipMaxAed: 500 },

  addons: [
    { id: 'matcha-latte', name: { en: 'Matcha Latte', ar: 'ماتشا لاتيه' }, price: 25, kind: 'matcha' },
    { id: 'matcha-iced', name: { en: 'Iced Matcha', ar: 'ماتشا مثلجة' }, price: 25, kind: 'matcha' },
    { id: 'matcha-straw', name: { en: 'Strawberry Matcha', ar: 'ماتشا بالفراولة' }, price: 25, kind: 'matcha' },
    { id: 'matcha-vanilla', name: { en: 'Vanilla Matcha', ar: 'ماتشا بالفانيليا' }, price: 25, kind: 'matcha' }
  ],

  perfumes: [
    { id: 'oud', name: { en: 'Oud', ar: 'عود' } },
    { id: 'rose', name: { en: 'Rose', ar: 'ورد' } },
    { id: 'musk', name: { en: 'White Musk', ar: 'مسك أبيض' } }
  ],

  /* Extras à l'unité (PROPOSITION 12/11/2026, à valider par Karl). Les abonnées en ont une partie offerte selon la formule. */
  extras: [
    { id: 'shower', name: { en: 'Private shower (towel and products)', ar: 'دشّ خاص (منشفة ومستحضرات)' }, price: 49 },
    { id: 'steam', name: { en: 'Outfit steamed: dress, abaya or hijab (per piece)', ar: 'كيّ بالبخار: فستان أو عباءة أو شيلة (للقطعة)' }, price: 35 },
    { id: 'scent', name: { en: 'Outfit lightly perfumed', ar: 'تعطير الملابس' }, price: 15 },
    { id: 'hairscent', name: { en: 'Hair perfume: oud, rose or white musk', ar: 'عطر الشعر: عود أو ورد أو مسك أبيض' }, price: 20 },
    { id: 'coffee', name: { en: 'Coffee, tea or karak', ar: 'قهوة أو شاي أو كرك' }, price: 20 },
    { id: 'matcha', name: { en: 'Matcha or fresh juice', ar: 'ماتشا أو عصير طازج' }, price: 25 },
    { id: 'touchup', name: { en: 'Touch-up within 48 hours', ar: 'لمسة خلال ٤٨ ساعة' }, price: 59 },
    { id: 'nails', name: { en: 'Express nails (polish change)', ar: 'أظافر سريعة (تغيير الطلاء)' }, price: 79 },
    { id: 'long', name: { en: 'Extra long or thick hair', ar: 'شعر طويل جداً أو كثيف' }, price: 40 }
  ],
  ritual: { price: 79, includes: ['shower', 'steam', 'scent', 'hairscent', 'coffee'], name: { en: 'Complete ritual: shower, 1 piece steamed and perfumed, hair perfume, coffee or tea', ar: 'الطقوس الكاملة: دشّ، قطعة بالبخار ومعطّرة، عطر الشعر، قهوة أو شاي' } },

  /* Club QAMAR (abonnements) — PROPOSITION du 12/11/2026, prix à valider par Karl avant l'ouverture.
     À l'unité on paie chaque extra ; les abonnées les ont offerts selon la formule. Le prix baisse chaque mois tant qu'on reste. */
  club: {
    dropPct: 2,               // baisse du prix à chaque mois d'abonnement
    floorPct: 16,             // baisse maximale (atteinte au 9e mois), ensuite le prix reste à ce niveau — au-delà, plus rentable (voir note Obsidian)
    minMonths: 3,             // engagement minimum
    pauseMonths: 2,           // pause possible par an, le palier de prix est conservé
    founding: { count: 100, startMonth: 4 }, // 100 premières abonnées : démarrent directement au prix du 4e mois
    tiers: [
      { id: 'crescent', name: { en: 'Crescent', ar: 'هلال' }, visits: 2, price: 329, per: { en: '2 blow-dries a month', ar: 'سشواران في الشهر' },
        gifts: [{ en: 'Private shower, every visit', ar: 'دشّ خاص في كل زيارة' }, { en: '1 piece steamed and perfumed', ar: 'قطعة واحدة بالبخار ومعطّرة' }, { en: 'Hair perfume', ar: 'عطر الشعر' }, { en: 'Coffee, tea or karak', ar: 'قهوة أو شاي أو كرك' }] },
      { id: 'half', name: { en: 'Half Moon', ar: 'نصف القمر' }, visits: 4, price: 599, popular: true, per: { en: '1 blow-dry a week', ar: 'سشوار كل أسبوع' },
        gifts: [{ en: 'Everything in Crescent', ar: 'كل ما في هلال' }, { en: 'All your pieces steamed and perfumed', ar: 'كل قطعكِ بالبخار ومعطّرة' }, { en: 'Matcha or fresh juice', ar: 'ماتشا أو عصير طازج' }, { en: 'Free touch-up within 48 hours', ar: 'لمسة مجانية خلال ٤٨ ساعة' }, { en: '1 express nails a month', ar: 'أظافر سريعة مرة في الشهر' }] },
      { id: 'full', name: { en: 'Full Moon', ar: 'البدر' }, visits: 12, price: 1199, per: { en: 'Up to 3 blow-dries a week', ar: 'حتى ٣ سشوارات في الأسبوع' },
        gifts: [{ en: 'Everything in Half Moon', ar: 'كل ما في نصف القمر' }, { en: '2 express nails a month', ar: 'أظافر سريعة مرتين في الشهر' }, { en: 'Extra long hair at no charge', ar: 'الشعر الطويل بدون رسوم إضافية' }, { en: 'Birthday blow-dry for a friend', ar: 'سشوار عيد الميلاد لصديقتكِ' }] }
    ],
    perks: [
      { en: 'Members’ lane in the queue', ar: 'مسار خاص بالعضوات في الطابور' },
      { en: 'Your price goes down every month you stay', ar: 'سعركِ ينخفض كل شهر تبقين فيه' },
      { en: 'A friend at −50% once a month', ar: 'صديقة بخصم ٥٠٪ مرة في الشهر' },
      { en: 'Birthday blow-dry on us', ar: 'سشوار عيد ميلادكِ على حسابنا' },
      { en: 'An unused visit carries over to next month', ar: 'الزيارة غير المستخدمة تنتقل للشهر التالي' }
    ],
    // tableau comparatif : extra → ce que chaque formule a (true = offert à chaque visite, texte = quantité)
    compare: [
      ['shower', true, true, true], ['steam', { en: '1 piece', ar: 'قطعة' }, { en: 'All', ar: 'الكل' }, { en: 'All', ar: 'الكل' }], ['scent', true, true, true],
      ['hairscent', true, true, true], ['coffee', true, true, true], ['matcha', false, true, true], ['touchup', false, true, true],
      ['nails', false, { en: '1 / month', ar: 'مرة شهرياً' }, { en: '2 / month', ar: 'مرتان شهرياً' }], ['long', false, false, true]
    ]
  },

  packages: [
    { id: 'club', name: { en: 'QAMAR Club · from 329 AED / month', ar: 'نادي قمر · من ٣٢٩ درهماً شهرياً' }, price: { en: 'From 329 AED', ar: 'من ٣٢٩ درهماً' }, note: { en: 'Extras included, and the price goes down every month', ar: 'الإضافات مشمولة، والسعر ينخفض كل شهر' } },
    { id: 'squad', name: { en: 'Squad — 4 friends or more', ar: 'سكواد — ٤ صديقات أو أكثر' }, price: { en: '−25%', ar: 'خصم ٢٥٪' }, note: { en: 'Each of you saves 25%', ar: 'خصم ٢٥٪ لكل واحدة منكن' } },
    { id: 'happy', name: { en: 'Happy Hours · 10 AM – 3 PM weekdays', ar: 'عروض الظهيرة · ١٠ص – ٣م أيام الأسبوع' }, price: { en: '−20%', ar: 'خصم ٢٠٪' }, note: { en: 'Perfect for a lunch-break glow', ar: 'مثالي لاستراحة الغداء' } }
  ],

  // name : identifiant affiché sur les écrans du personnel ; names : prénom traduit pour le site public (EN/AR)
  stylists: [
    { id: 'layla', name: 'Layla', names: { en: 'Layla', ar: 'ليلى' }, seat: 1, pin: '1111', ig: 'qamar.layla', specialty: { en: 'Hollywood curls', ar: 'كيرلي هوليوود' } },
    { id: 'noor', name: 'Noor', names: { en: 'Noor', ar: 'نور' }, seat: 2, pin: '2222', ig: 'qamar.noor', specialty: { en: 'Sleek & glass hair', ar: 'الشعر الناعم واللامع' } },
    { id: 'sara', name: 'Sara', names: { en: 'Sara', ar: 'سارة' }, seat: 3, pin: '3333', ig: 'qamar.sara', specialty: { en: 'Cuts & colour', ar: 'القص والصبغة' } },
    { id: 'mariam', name: 'Mariam', names: { en: 'Mariam', ar: 'مريم' }, seat: 4, pin: '4444', ig: 'qamar.mariam', specialty: { en: 'Braids & updos', ar: 'الضفائر والتسريحات' } },
    { id: 'yasmin', name: 'Yasmin', names: { en: 'Yasmin', ar: 'ياسمين' }, seat: 5, pin: '5555', ig: 'qamar.yasmin', specialty: { en: 'Volume & waves', ar: 'الحجم والتموجات' } }
  ]
};
