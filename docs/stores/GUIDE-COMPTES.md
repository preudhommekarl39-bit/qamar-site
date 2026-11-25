# Publier l'app QAMAR sur l'App Store et Google Play : le guide des comptes

Ce guide est pour toi, Karl. Tout le technique est déjà prêt dans le dépôt : l'app, les captures d'écran, les textes des fiches,
et un bouton « Release apps » dans GitHub qui fabrique et envoie les versions signées. Il manque seulement les comptes de la
société QAMAR chez Apple et Google, que toi seul peux ouvrir et payer.

Règle d'or : **tu ne m'envoies jamais une clé, un mot de passe ou un fichier .p8 / .json / .jks dans la conversation.**
Tu les colles toi-même dans GitHub (étape 6). Je n'en ai pas besoin pour lancer la publication.

## Résumé : coûts et délais réalistes

| Étape | Coût | Délai habituel |
| --- | --- | --- |
| 1. Licence commerciale (trade licence) | déjà prévue avec le bail | après signature du bail |
| 2. Numéro D-U-N-S | gratuit | 5 jours ouvrés, parfois jusqu'à 2 semaines |
| 3. Apple Developer Program (organisation) | 99 USD par an | 2 jours à 2 semaines (vérification, parfois un appel d'Apple) |
| 4. Google Play Console (organisation) | 25 USD une seule fois | 2 à 7 jours (vérification de l'identité et de la société) |
| 5. Clés techniques (Apple + Google) | gratuit | 30 minutes |
| 6. Coller les clés dans GitHub | gratuit | 15 minutes |
| 7. Première publication (je m'en occupe) | gratuit | test interne le jour même ; examen public Apple 1 à 3 jours, Google 1 à 7 jours |

Compte au total **3 à 5 semaines** entre la licence et l'app visible dans les stores. Les étapes 3 et 4 peuvent se faire en même temps.

## 1. Licence prête

Il faut la licence au nom exact de la société (le nom juridique, pas seulement « QAMAR »). Garde sous la main :
le PDF de la licence, l'adresse officielle, un numéro de téléphone de la société, et une adresse e-mail **sur le domaine du site**
(par exemple `karl@qamarlounge.com`) : Apple refuse souvent les adresses Gmail pour les comptes de société.
Le site `qamarlounge.com` doit être en ligne (c'est déjà le cas).

## 2. Numéro D-U-N-S (gratuit)

C'est un identifiant international d'entreprise (Dun & Bradstreet). Apple et Google l'exigent pour un compte de société.

1. Va sur `developer.apple.com/enroll/duns-lookup` (outil officiel d'Apple, gratuit).
2. Cherche la société : si elle existe déjà, note le numéro (9 chiffres).
3. Sinon, remplis la demande avec **exactement** les informations de la licence (nom juridique, adresse). Ne paie rien : par l'outil d'Apple c'est gratuit.
4. Attends l'e-mail de Dun & Bradstreet avec le numéro. Ensuite Apple met encore 1 à 2 jours à le « voir ».

## 3. Apple Developer Program, en tant qu'organisation (99 USD par an)

1. Crée (ou utilise) un identifiant Apple à l'adresse e-mail de la société, avec la double authentification activée.
2. Installe l'app **Apple Developer** sur ton iPhone, connecte-toi, puis « Enroll now » → **Organization**.
3. Donne le nom juridique, le D-U-N-S, le site `https://qamarlounge.com` et confirme que tu peux engager la société.
4. Paie les 99 USD (renouvellement chaque année : si tu oublies de payer, l'app disparaît de l'App Store).
5. Apple peut t'appeler pour vérifier. Réponds, c'est normal.
6. Une fois accepté, note le **Team ID** (10 caractères, dans developer.apple.com → Account → Membership details).
7. developer.apple.com → **Certificates, IDs & Profiles** → **Identifiers** → « + » → App IDs → App : description `QAMAR`,
   Bundle ID « Explicit » `com.qamarlounge.app`, ne coche aucune capacité pour l'instant → Register.
8. Dans **App Store Connect** (`appstoreconnect.apple.com`) → Apps → « + » → New App : plateforme iOS, nom `QAMAR Blowdry Lounge`,
   langue principale English, identifiant de bundle `com.qamarlounge.app`, SKU `qamar-ios`, accès complet.

## 4. Google Play Console, en tant qu'organisation (25 USD une fois)

1. Va sur `play.google.com/console/signup` avec un compte Google de la société.
2. Choisis **Organisation** (et pas « personnel » : les comptes personnels doivent faire tester l'app par 12 personnes pendant 14 jours avant de publier ; les comptes d'organisation non).
3. Donne le D-U-N-S, le nom juridique, l'adresse, le site et un téléphone. Paie les 25 USD.
4. Vérification de l'identité (pièce d'identité) et de la société : quelques jours.
5. Une fois accepté : « Créer une application » → nom `QAMAR Blowdry Lounge`, langue English, Application, Gratuite.
   Le nom du paquet sera `com.qamarlounge.app` (il est fixé par la première version envoyée).

## 5. Les clés techniques

### Apple : clé API App Store Connect (permet à GitHub de signer et d'envoyer l'app)

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → « + ».
2. Nom : `GitHub QAMAR`. Rôle : **Admin** (nécessaire pour que GitHub crée lui-même les certificats de signature).
3. Télécharge le fichier `AuthKey_XXXXXXXXXX.p8` (**une seule fois possible**, range-le dans ton gestionnaire de mots de passe).
4. Note le **Key ID** (à côté de la clé) et l'**Issuer ID** (en haut de la page).

### Google : clé d'envoi Android (upload key)

C'est la clé qui prouve que les versions viennent de toi. Sur ton Mac, dans le Terminal, une seule commande
(si le Mac propose d'installer Java, accepte ou installe « Temurin 21 » depuis adoptium.net) :

```text
keytool -genkeypair -v -keystore qamar-upload.jks -alias qamar -keyalg RSA -keysize 2048 -validity 10000
```

Choisis un mot de passe solide (le même pour les deux questions), réponds aux questions (nom, société, pays AE).
Range `qamar-upload.jks` et le mot de passe dans ton gestionnaire de mots de passe. Google gardera la vraie clé de signature
(« Play App Signing ») : si un jour cette clé d'envoi est perdue, Google permet de la remplacer.

### Google : compte de service (permet à GitHub d'envoyer l'app dans la Play Console)

1. `console.cloud.google.com` → crée un projet `qamar-play` → **IAM et administration** → **Comptes de service** → Créer : `github-play`.
2. Sur ce compte de service → **Clés** → Ajouter une clé → JSON → un fichier `.json` est téléchargé (range-le).
3. Active l'API « Google Play Android Developer API » dans ce projet (menu API et services → Bibliothèque).
4. Play Console → **Utilisateurs et autorisations** → Inviter l'adresse e-mail du compte de service (finit par `iam.gserviceaccount.com`)
   avec les droits sur l'app QAMAR : « Publier sur les canaux de test » et « Gérer les versions de test ».

## 6. Coller les clés dans GitHub (toi seul)

GitHub → dépôt `qamar-site` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
Pour transformer un fichier en texte (base64) sur Mac, dans le Terminal : `base64 -i NOM_DU_FICHIER | pbcopy` puis colle.

| Nom du secret | Ce que tu colles |
| --- | --- |
| `APPLE_TEAM_ID` | le Team ID Apple (10 caractères) |
| `ASC_KEY_ID` | le Key ID de la clé API |
| `ASC_ISSUER_ID` | l'Issuer ID |
| `ASC_KEY_P8_BASE64` | `base64 -i AuthKey_XXXXXXXXXX.p8 \| pbcopy` puis coller |
| `ANDROID_KEYSTORE_BASE64` | `base64 -i qamar-upload.jks \| pbcopy` puis coller |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `qamar` |
| `ANDROID_KEY_PASSWORD` | le même mot de passe (si tu as mis le même) |
| `PLAY_SERVICE_ACCOUNT_JSON` | le **contenu** du fichier .json du compte de service (ouvre-le, copie tout) |

Ensuite tu me dis seulement : « les secrets sont dans GitHub ». Rien d'autre.

## 7. Ce que je fais ensuite (Claude)

1. Je lance le workflow **Release apps** (onglet Actions). S'il manque un secret, il s'arrête proprement et le dit.
2. **iPhone** : la version arrive dans **TestFlight** (App Store Connect). Tu l'installes avec l'app TestFlight pour l'essayer.
3. **Android** : la toute première version doit être envoyée à la main (règle de Google pour une app jamais publiée) :
   je te donne le fichier `.aab` fabriqué par GitHub, tu le déposes dans Play Console → Tester → **Test interne**. Les suivantes partent toutes seules.
4. Je remplis avec toi les fiches (textes prêts dans `docs/stores/listing-en.md` et `listing-ar.md`, captures dans
   `docs/stores/screenshots/`, réponses confidentialité et âge dans `docs/stores/REVIEW-AND-PRIVACY.md`).
5. **Examen public seulement quand le salon est ouvert** et que la file passe sur le vrai serveur : Apple et Google refusent les apps « démo ».
   Avant l'ouverture, on reste en TestFlight et en test interne.
6. Quand les apps sont publiées : je mets les liens dans `assets/config.js` (`appStore.ios` et `appStore.android`). Dès ce moment,
   le QR du salon propose « Ouvrir dans l'app QAMAR », **sans réimprimer le QR**.
7. Je publie `/.well-known/apple-app-site-association` (avec le Team ID) et `/.well-known/assetlinks.json` (avec l'empreinte SHA-256
   de Play Console → Intégrité de l'application) pour que le QR ouvre directement l'app quand elle est installée.

**Ne jamais supprimer ni renommer `go.html`** (et le dossier `go/`) : c'est l'adresse imprimée dans le QR du salon. On change ce que fait
la page, jamais son adresse.

## À savoir

- L'abonnement Apple (99 USD) se renouvelle chaque année ; Google, c'est une fois pour toutes.
- Pas de paiement dans l'app : les clientes paient au salon. Donc pas de commission Apple ou Google.
- Si Apple ou Google pose une question pendant l'examen, transfère-moi le message (sans clé ni mot de passe) et je prépare la réponse.
