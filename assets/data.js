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
  },

  // look = nom signature affiché aux clientes, name = nom de la prestation
  services: [
    { id: 'express', art: 'bouncy', cat: 'blowdry', look: { en: 'Qamar Express', ar: 'قمر إكسبريس' }, name: { en: 'Express Blow-Dry', ar: 'سشوار سريع' }, desc: { en: 'Smooth, bouncy, done in 35 minutes — or it is on us.', ar: 'ناعم ومنسدل، جاهز خلال ٣٥ دقيقة — أو مجاناً.' }, duration: 35, price: 129, tone: ['#F6D9D2', '#E7B8A8'] },
    { id: 'glow', art: 'glow', cat: 'blowdry', look: { en: 'Qamar Glow', ar: 'لمعة قمر' }, name: { en: 'Glow Blow-Dry', ar: 'سشوار اللمعان' }, desc: { en: 'Our signature: mirror shine, airy volume, soft ends.', ar: 'توقيعنا: لمعان كالمرآة وحجم خفيف وأطراف ناعمة.' }, duration: 40, price: 169, tone: ['#F3E2D3', '#D9B48C'] },
    { id: 'waves', art: 'waves', cat: 'blowdry', look: { en: 'Marina Waves', ar: 'أمواج المارينا' }, name: { en: 'Waves / Hollywood Curls', ar: 'تموجات / كيرلي هوليوود' }, desc: { en: 'Loose beach waves or glam Hollywood curls.', ar: 'تموجات شاطئية ناعمة أو كيرلي هوليوود الفاخر.' }, duration: 45, price: 189, tone: ['#F4D6CF', '#C9917E'] },
    { id: 'sleek', art: 'straight', cat: 'blowdry', look: { en: 'Midnight Sleek', ar: 'ميدنايت سليك' }, name: { en: 'Sleek Straight', ar: 'فرد ناعم' }, desc: { en: 'Glass-straight, ultra glossy, humidity-proof.', ar: 'فرد كالزجاج، لمعان فائق، مقاوم للرطوبة.' }, duration: 40, price: 159, tone: ['#E9D3D0', '#8E6A6A'] },
    { id: 'night', art: 'night', cat: 'night', look: { en: 'Night Glow', ar: 'توهّج الليل' }, name: { en: 'Blow-dry of your choice + free matcha', ar: 'سشوار من اختيارك + ماتشا مجانية' }, desc: { en: '8 PM – midnight only. Any blow-dry + a matcha on us.', ar: 'من ٨ مساءً حتى منتصف الليل فقط. أي سشوار + ماتشا مجانية.' }, duration: 45, price: 179, freeMatcha: true, fromHour: 20, tone: ['#3A2630', '#C49A5A'] },
    { id: 'sos', art: 'braid', cat: 'sos', look: { en: 'SOS 15', ar: 'إس أو إس ١٥' }, name: { en: 'Fringe, sleek ponytail or quick braid', ar: 'غرّة أو ذيل حصان ناعم أو ضفيرة سريعة' }, desc: { en: 'Late for dinner or a meeting? 15 minutes flat.', ar: 'مستعجلة لعشاء أو اجتماع؟ ١٥ دقيقة فقط.' }, duration: 15, price: 69, tone: ['#F7E4DC', '#E2A48E'] },
    { id: 'care', art: 'drops', cat: 'care', look: { en: 'Moon Ritual', ar: 'طقوس القمر' }, name: { en: 'Shampoo & Care Ritual', ar: 'غسيل وطقوس العناية' }, desc: { en: 'Velvet wash chair, warm towel, mask and steam.', ar: 'كرسي غسيل مخملي، منشفة دافئة، ماسك وبخار.' }, duration: 30, price: 149, tone: ['#F1E6DE', '#B9A08A'] },
    { id: 'cut', art: 'cut', cat: 'colour', look: { en: 'Cut & Glow', ar: 'قص ولمعان' }, name: { en: 'Cut + Blow-Dry', ar: 'قص + سشوار' }, desc: { en: 'A fresh shape, finished with a glow blow-dry.', ar: 'قصة جديدة مع سشوار لامع.' }, duration: 45, price: 249, tone: ['#EFD5CC', '#A97964'] },
    { id: 'root', art: 'root', cat: 'colour', look: { en: 'Root & Glow', ar: 'جذور ولمعان' }, name: { en: 'Root Touch-Up + Blow-Dry', ar: 'صبغة الجذور + سشوار' }, desc: { en: 'Seamless roots, then the full glow finish.', ar: 'جذور متناسقة ثم لمسة اللمعان الكاملة.' }, duration: 45, price: 349, tone: ['#EAD0C4', '#7F5444'] },
    { id: 'mini', art: 'mini', cat: 'kids', look: { en: 'Mini Glow', ar: 'ميني جلو' }, name: { en: 'Mini blow-dry or braids (kids)', ar: 'سشوار أو ضفائر للصغيرات' }, desc: { en: 'For little princesses: mini blow-dry or braids.', ar: 'للأميرات الصغيرات: سشوار صغير أو ضفائر.' }, duration: 25, price: 79, tone: ['#FBE3E0', '#E9A9A0'] }
  ],

  maxMinutes: 45, // aucune formule ne dépasse 45 min
  extraLong: { price: 40, minutes: 0 },

  /* Règles commerciales — SOURCE UNIQUE utilisée par le site, la page cliente, les postes et le dashboard.
     Règle de cumul (VALIDÉE le 17/10/2026) : une seule remise par visite, la plus avantageuse pour la cliente.
     La remise porte sur la prestation (supplément cheveux longs inclus), jamais sur les boissons ni le pourboire. */
  promotions: {
    launch: { enabled: true, label: { en: 'Opening offer', ar: 'عرض الافتتاح' }, firstN: 30, firstPct: 70, restPct: 50 },
    happyHours: { enabled: true, label: { en: 'Happy hours', ar: 'ساعات السعادة' }, pct: 20, days: [1, 2, 3, 4, 5], fromHour: 10, toHour: 15 } // lun–ven (week-end UAE : sam–dim)
    // Squad (−25 %), carte 4 brushings, abonnement, anniversaire et parrainage : appliqués manuellement en caisse
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

  packages: [
    { id: 'card4', name: { en: '4 Blow-Dry Card', ar: 'بطاقة ٤ سشوار' }, price: '449 AED', note: { en: 'Split it in 4 with Tabby or Tamara', ar: 'قسّطيها على ٤ دفعات مع تابي أو تمارا' } },
    { id: 'unlimited', name: { en: 'Unlimited Weekday Membership', ar: 'عضوية غير محدودة أيام الأسبوع' }, price: '799 AED / month', note: { en: 'Sunday to Thursday, as often as you like', ar: 'من الأحد إلى الخميس، كلما رغبتِ' } },
    { id: 'squad', name: { en: 'Squad — 4 friends or more', ar: 'سكواد — ٤ صديقات أو أكثر' }, price: '−25%', note: { en: 'Each of you saves 25%', ar: 'خصم ٢٥٪ لكل واحدة منكن' } },
    { id: 'happy', name: { en: 'Happy Hours · 10 AM – 3 PM weekdays', ar: 'ساعات السعادة · ١٠ص – ٣م أيام الأسبوع' }, price: '−20%', note: { en: 'Perfect for a lunch-break glow', ar: 'مثالي لاستراحة الغداء' } }
  ],

  stylists: [
    { id: 'layla', name: 'Layla', seat: 1, pin: '1111', ig: 'qamar.layla', specialty: { en: 'Hollywood curls', ar: 'كيرلي هوليوود' } },
    { id: 'noor', name: 'Noor', seat: 2, pin: '2222', ig: 'qamar.noor', specialty: { en: 'Sleek & glass hair', ar: 'الشعر الناعم واللامع' } },
    { id: 'sara', name: 'Sara', seat: 3, pin: '3333', ig: 'qamar.sara', specialty: { en: 'Cuts & colour', ar: 'القص والصبغة' } },
    { id: 'mariam', name: 'Mariam', seat: 4, pin: '4444', ig: 'qamar.mariam', specialty: { en: 'Braids & updos', ar: 'الضفائر والتسريحات' } },
    { id: 'yasmin', name: 'Yasmin', seat: 5, pin: '5555', ig: 'qamar.yasmin', specialty: { en: 'Volume & waves', ar: 'الحجم والتموجات' } }
  ]
};
