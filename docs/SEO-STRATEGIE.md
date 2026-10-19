# QAMAR — Stratégie SEO (Dubaï, anglais + arabe)

Version du 19/10/2026. **Aucun volume de recherche, aucune difficulté ni aucun classement n'a été mesuré** : aucun outil SEO payant (Ahrefs, Semrush, Google Keyword Planner avec compte Ads) n'était disponible. Les niveaux de confiance ci-dessous sont des hypothèses à valider. Personne ne peut garantir une première position sur Google.

## 1. Ce qui est en place (technique)
| Élément | État |
|---|---|
| Titres et descriptions uniques (EN, AR, confidentialité, mentions) | ✅ |
| Page arabe indexable `ar.html` (texte arabe dans le HTML initial, `lang="ar"`, `dir="rtl"`) | ✅ générée au build |
| `canonical` absolu sur chaque page indexable | ✅ URL actuelle GitHub Pages (à changer avec le domaine) |
| `hreflang` en / ar / x-default, réciproques, + dans le sitemap | ✅ conforme à la doc Google |
| `sitemap.xml` (accueil EN, AR, confidentialité, mentions) | ✅ |
| Open Graph : image 1200×630 en URL absolue, `og:url`, locales | ✅ |
| Données structurées `HairSalon` (nom, description, URL, logo, zone Dubaï, langues) | ✅ sans adresse, horaires, prix ni avis tant qu'ils ne sont pas confirmés |
| Pages du personnel, parcours cliente, tests : `noindex` | ✅ |
| FAQ visible (9 questions, EN + AR) | ✅ — pas de balisage FAQPage : Google réserve ces résultats enrichis aux sites gouvernementaux et de santé |
| Contenu essentiel dans le HTML initial | ⚠ partiel : titres, textes des sections et FAQ sont dans le HTML initial (EN et AR) ; la grille des looks, ses filtres et la carte des prix sont générés en JavaScript (Google exécute le JavaScript, mais une génération au build serait plus robuste — P2) |

**Limite GitHub Pages :** le site est un « site de projet » (`/qamar-site/`). Google ne lit `robots.txt` qu'à la racine d'un domaine : le `robots.txt` publié ne sera réellement pris en compte qu'avec le domaine définitif. En attendant, le sitemap doit être **déclaré dans Search Console**. Un sous-domaine `github.io` n'est pas idéal pour la marque ni pour le SEO local : **acheter le domaine est la première action SEO** (voir `MISE-EN-PRODUCTION.md`).

## 2. Mots-clés — anglais
Intention : T = transactionnelle, L = locale, I = informationnelle, P = prix.

| Mot-clé | Intention | Page | Priorité | Confiance | Validation à faire | Action |
|---|---|---|---|---|---|---|
| blow dry Dubai | T+L | Accueil | P1 | Moyenne (terme générique de la catégorie) | Keyword Planner + Search Console après 4 semaines | Titre, H1 sémantique, description |
| blow dry salon Dubai | T+L | Accueil | P1 | Moyenne | idem | Déjà dans le titre (« Blow-Dry ») |
| blowout Dubai / blowout salon Dubai | T+L | Accueil + future page « Our blowouts » | P2 | Faible-moyenne (terme américain, usage local à vérifier) | Keyword Planner | Mentionner naturellement « blowout » dans le texte |
| walk-in hair salon Dubai | T+L | Accueil | P1 | Moyenne — c'est la différence de QAMAR | Search Console | H2 « No appointment » + FAQ « Do I need to book? » |
| express blow dry Dubai | T | Look Qamar Express | P2 | Faible | idem | Description du look |
| blow dry prices Dubai | P | Section menu + FAQ prix | P2 | Moyenne | idem | Seulement quand les prix sont validés |
| Hollywood waves Dubai | T | Look Marina Waves | P2 | Faible | idem | Description + future page |
| sleek blowout Dubai | T | Look Midnight Sleek | P3 | Faible | idem | Description |
| hair salon open late Dubai | T+L | Section Night | P1 après confirmation des horaires | Moyenne | idem | Ne pas pousser avant confirmation des horaires |
| ladies hair salon Dubai | L | Accueil | P2 | Moyenne | idem | Mention naturelle |
| blow dry near me | L | Fiche Google Business Profile | P1 | Élevée (requête « near me » = Maps) | Statistiques GBP | Se gagne avec la fiche GBP, pas avec la page |

## 3. Mots-clés — arabe (à faire relire par une locutrice des Émirats)
| Mot-clé | Sens | Intention | Page | Priorité | Confiance | Remarque |
|---|---|---|---|---|---|---|
| سشوار دبي | brushing Dubaï | T+L | ar.html | P1 | Moyenne | Forme utilisée sur le site (« سشوار ») |
| استشوار دبي | brushing (variante orthographique) | T+L | ar.html | P1 | Moyenne | Variante très courante dans le Golfe : à intégrer une fois dans le texte arabe après validation linguistique |
| صالون نسائي دبي | salon pour femmes | L | ar.html | P2 | Moyenne | |
| صالون شعر دبي | salon de coiffure | L | ar.html | P2 | Moyenne | Concurrence probablement forte |
| صالون بدون موعد دبي | salon sans rendez-vous | T+L | ar.html | P1 | Faible-moyenne | Différenciant |
| تسريحات شعر دبي | coiffures | I+T | ar.html / futur guide | P3 | Faible | Plutôt inspiration |

Ne pas traduire mécaniquement : la recherche réelle doit être confirmée dans Search Console (requêtes en arabe) après l'ouverture.

## 4. Pages et contenus (sans pages vides)
1. **Maintenant :** accueil EN + AR avec FAQ (fait).
2. **À l'ouverture (adresse, horaires et prix confirmés) :** page « Prices & menu » si les prix sont stables ; page « Visit us » (adresse réelle, accès, parking, horaires).
3. **Pages services (seulement si chacune apporte un vrai contenu) :** « Hollywood waves in Dubai », « Express blow-dry », « Bridal & event hair » (avec vraies photos et conditions de privatisation).
4. **Guide beauté (après l'ouverture, 1 article par mois, relu par une coiffeuse de l'équipe, EN puis AR) :**
   - How to make a blowout last longer in Dubai's humidity
   - Blowout vs. traditional blow-dry: what is the difference?
   - Hollywood waves or sleek straight: which look for your event?
   - How to prepare your hair before a blow-dry
   - Keeping your blowout fresh under a hijab (sujet très spécifique au marché, à valider avec l'équipe)
   Aucune génération automatique d'articles, aucun conseil médical, photos authentiques uniquement.

## 5. SEO local (le plus gros levier pour un salon)
Voir `GOOGLE-BUSINESS-PROFILE.md`. Ordre : adresse réelle → fiche GBP vérifiée → mêmes nom/adresse/téléphone partout (site, Instagram, annuaires) → avis réels sollicités après chaque visite payée → photos réelles hebdomadaires.

Citations légitimes à viser : Google, Apple Plans (Apple Business Connect), Bing Places, Instagram/TikTok/Snapchat, Time Out Dubai, What's On, guides beauté locaux, partenaires réels (hôtels, créatrices d'abayas) **uniquement avec accord**. Jamais d'achat de liens.

## 6. Mesure
Search Console (propriété du domaine définitif) dès la mise en ligne du domaine : déclarer le sitemap, suivre les requêtes EN/AR, les pages indexées, les erreurs hreflang. GA4 seulement après validation du consentement (voir `ANALYTICS.md`).

## Sources officielles consultées
- Google Search Central — Localized versions (hreflang) : https://developers.google.com/search/docs/specialty/international/localized-versions
- Google Search Central — Sitemaps : https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
