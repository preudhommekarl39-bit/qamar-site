# QAMAR — Plan référencement (12/11/2026)

## Déjà en place sur le site (branche refonte-pro)
- Titres / descriptions EN + AR orientés recherches réelles (blow-dry, Dubai, women only, Sheikh Zayed Road, 45 min, walk-in).
- Page arabe indexable `ar.html` + hreflang + canonical (build).
- `sitemap.xml`, `robots.txt` (build), `llms.txt` (résumé pour ChatGPT / Perplexity / Gemini).
- Données structurées : `HairSalon` (sans infos non confirmées) + `FAQPage` (6 questions).
- Page légère et rapide (images WebP, vidéo différée, peu de JS).
- Mesure prête mais coupée : `assets/track.js` + `data-track` sur les boutons (cta_click, whatsapp_click, film_click, film_sound_on).

## À faire dès la mise en ligne validée
1. **Google Search Console** (Karl se connecte avec son compte Google) : ajouter la propriété `qamarlounge.com` (vérification DNS chez le registrar, ou fichier HTML que Claude ajoute au site) → envoyer `sitemap.xml` → « Inspecter l'URL » sur `/` et `/ar.html` → « Demander l'indexation ».
2. **Bing Webmaster Tools** : importer depuis Search Console (1 clic).
3. **GA4** : créer la propriété, bandeau de consentement, puis `config.js → analytics.enabled = true, ga4Id` (voir `ANALYTICS.md`). Marquer `whatsapp_click` comme conversion → utile pour Google Ads.
4. Vérifier : test des résultats enrichis (FAQ, HairSalon), PageSpeed Insights mobile ≥ 90.

## Dès le bail signé (le plus important pour Maps)
1. Fiche Google Business Profile (voir `GOOGLE-BUSINESS-PROFILE.md`), Apple Business Connect, Bing Places.
2. Ajouter adresse, `geo`, horaires, téléphone dans `assets/data.js` (drapeaux `address`, `hoursConfirmed`, `phoneConfirmed`) → le build les ajoute aux données structurées.
3. Même nom / adresse / téléphone partout : Fresha, Instagram, TikTok, Snapchat, Facebook, annuaires Dubaï.
4. Système d'avis dès la première cliente.

## Contenus qui font monter (1 par mois, utiles et vrais)
- « Where to get ready after work near Sheikh Zayed Road » (guide).
- « How to keep a blow-dry in Dubai humidity » (conseils).
- « Abaya and hijab care: steaming vs ironing » (conseils).
Pages courtes, une intention chacune, liées depuis l'accueil, en EN + AR.

## Liens vers le site
Presse locale beauté (Harper's Bazaar Arabia, Time Out Dubai, What's On), blogs/influenceuses de la pré-ouverture, annuaires de salons. Jamais d'achat de liens.
