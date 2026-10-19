-- QAMAR — catalogue initial (copie de qamar/assets/data.js). Prix FICTIFS à valider avant ouverture.
insert into services (id, look_en, look_ar, name_en, name_ar, duration_min, price_aed, from_hour, free_matcha) values
  ('express', 'Qamar Express', 'قمر إكسبريس', 'Express Blow-Dry', 'سشوار سريع', 35, 129, null, false),
  ('glow', 'Qamar Glow', 'لمعة قمر', 'Glow Blow-Dry', 'سشوار اللمعان', 40, 169, null, false),
  ('waves', 'Marina Waves', 'أمواج المارينا', 'Waves / Hollywood Curls', 'تموجات / كيرلي هوليوود', 45, 189, null, false),
  ('sleek', 'Midnight Sleek', 'ميدنايت سليك', 'Sleek Straight', 'فرد ناعم', 40, 159, null, false),
  ('night', 'Night Glow', 'توهّج الليل', 'Blow-dry of your choice + free matcha', 'سشوار من اختيارك + ماتشا مجانية', 45, 179, 20, true),
  ('sos', 'SOS 15', 'إس أو إس ١٥', 'Fringe, sleek ponytail or quick braid', 'غرّة أو ذيل حصان ناعم أو ضفيرة سريعة', 15, 69, null, false),
  ('care', 'Moon Ritual', 'طقوس القمر', 'Shampoo & Care Ritual', 'غسيل وطقوس العناية', 30, 149, null, false),
  ('cut', 'Cut & Glow', 'قص ولمعان', 'Cut + Blow-Dry', 'قص + سشوار', 45, 249, null, false),
  ('root', 'Root & Glow', 'جذور ولمعان', 'Root Touch-Up + Blow-Dry', 'صبغة الجذور + سشوار', 45, 349, null, false),
  ('mini', 'Mini Glow', 'ميني جلو', 'Mini blow-dry or braids (kids)', 'سشوار أو ضفائر للصغيرات', 25, 79, null, false);

insert into addons (id, name_en, name_ar, kind, price_aed) values
  ('matcha-latte', 'Matcha Latte', 'ماتشا لاتيه', 'matcha', 25),
  ('matcha-iced', 'Iced Matcha', 'ماتشا مثلجة', 'matcha', 25),
  ('matcha-straw', 'Strawberry Matcha', 'ماتشا بالفراولة', 'matcha', 25),
  ('matcha-vanilla', 'Vanilla Matcha', 'ماتشا بالفانيليا', 'matcha', 25);
