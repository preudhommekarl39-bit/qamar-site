// QAMAR : réglages des projets natifs générés en CI (android/ et ios/ ne sont pas dans le dépôt : `npx cap add` les recrée).
//   node scripts/patch-native.mjs            (après `npx cap add android|ios` et `npx capacitor-assets generate`)
// Variables d'environnement (toutes facultatives) :
//   VERSION_NAME      version visible (défaut : package.json → version)
//   BUILD_NUMBER      numéro de build entier croissant (défaut 1) : versionCode Android, CFBundleVersion iOS
//   APPLE_TEAM_ID     équipe Apple (signature automatique) ; absent = projet non signé (build simulateur)
//   QAMAR_PUSH=1      ajoute la capacité Push (iOS) ; laisser vide tant que push.enabled = false dans assets/config.js
//   QAMAR_APP_LINKS=1 ajoute « Associated Domains » (iOS) quand /.well-known/apple-app-site-association est publié
// Les fonctions sont pures (texte → texte) pour être testées par scripts/run-tests.mjs sans Android SDK ni Xcode.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MIN_TARGET_SDK = 36;          // Google Play : nouvelles apps et mises à jour, API 36 depuis le 31/08/2026
export const DEEP_LINK_HOST = 'qamarlounge.com';
const MARK = 'QAMAR patch-native';

/* ---------- Android ---------- */
export function patchVariablesGradle(src) {
  const sdk = Number((src.match(/targetSdkVersion\s*=\s*(\d+)/) || [])[1]);
  if (!(sdk >= MIN_TARGET_SDK)) throw new Error(`targetSdkVersion ${sdk || '?'} < ${MIN_TARGET_SDK} : Google Play refusera l'app (passer à une version de Capacitor qui cible l'API ${MIN_TARGET_SDK}).`);
  return src;
}
export function patchAppGradle(src, { versionCode = 1, versionName = '1.0.0' } = {}) {
  if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error('versionCode invalide');
  let s = src.replace(/versionCode \d+/, `versionCode ${versionCode}`).replace(/versionName "[^"]*"/, `versionName "${versionName}"`);
  if (!s.includes(MARK)) s += `
// ${MARK} : signature de la version Play avec la clé d'envoi (upload key). Les chemins et mots de passe viennent
// uniquement de variables d'environnement posées par .github/workflows/release-apps.yml (secrets GitHub), jamais du dépôt.
def qamarKeystore = System.getenv("QAMAR_KEYSTORE_FILE")
android {
    signingConfigs {
        release {
            if (qamarKeystore) {
                storeFile file(qamarKeystore)
                storePassword System.getenv("QAMAR_KEYSTORE_PASSWORD")
                keyAlias System.getenv("QAMAR_KEY_ALIAS")
                keyPassword System.getenv("QAMAR_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            if (qamarKeystore) signingConfig signingConfigs.release
        }
    }
}
`;
  return s;
}
export function patchManifest(src) {
  if (src.includes(MARK)) return src;
  // Lien profond https://qamarlounge.com/go (QR du salon) : ouvre l'app si elle est installée, une fois assetlinks.json publié
  const filter = `
            <!-- ${MARK} : QR du salon → file d'attente dans l'app (vérifié par /.well-known/assetlinks.json) -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${DEEP_LINK_HOST}" android:path="/go" />
                <data android:scheme="https" android:host="${DEEP_LINK_HOST}" android:path="/go/" />
                <data android:scheme="https" android:host="${DEEP_LINK_HOST}" android:path="/go.html" />
            </intent-filter>
`;
  const i = src.indexOf('</activity>');
  if (i < 0) throw new Error('AndroidManifest.xml : <activity> introuvable');
  let s = src.slice(0, i) + filter.trimStart() + '        ' + src.slice(i);
  // pas de sauvegarde cloud des données de l'app (ticket, langue) : rien ne quitte le téléphone sans raison
  s = s.replace('android:allowBackup="true"', 'android:allowBackup="false"');
  return s;
}
// Petite icône de notification (silhouette blanche du croissant, exigée par Android pour la barre d'état)
export const NOTIF_ICON = `<?xml version="1.0" encoding="utf-8"?>
<!-- ${MARK} : icône de notification (croissant QAMAR) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M20,14.5A8.5,8.5 0,1 1,9.5 4a7,7 0,0 0,10.5 10.5z" />
</vector>
`;

/* ---------- iOS ---------- */
const plistKey = (s, key) => new RegExp(`<key>${key}</key>\\s*(<(true|false)/>|<string>[^<]*</string>|<array>[\\s\\S]*?</array>)`);
function setPlist(s, key, valueXml) {
  const re = plistKey(s, key);
  if (re.test(s)) return s.replace(re, `<key>${key}</key>\n\t${valueXml}`);
  const end = s.lastIndexOf('</dict>');
  return s.slice(0, end) + `\t<key>${key}</key>\n\t${valueXml}\n` + s.slice(end);
}
export function patchInfoPlist(src, { push = false } = {}) {
  let s = src;
  s = setPlist(s, 'CFBundleDisplayName', '<string>QAMAR</string>');
  s = setPlist(s, 'ITSAppUsesNonExemptEncryption', '<false/>');     // uniquement HTTPS du système : exemptée (pas de formulaire d'export)
  s = setPlist(s, 'CFBundleLocalizations', '<array>\n\t\t<string>en</string>\n\t\t<string>ar</string>\n\t</array>');
  s = setPlist(s, 'UIRequiredDeviceCapabilities', '<array>\n\t\t<string>arm64</string>\n\t</array>');
  // iPhone seulement, portrait : l'interface est pensée pour le téléphone (pas de captures iPad à fournir)
  s = setPlist(s, 'UISupportedInterfaceOrientations', '<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>');
  s = s.replace(/\s*<key>UISupportedInterfaceOrientations~ipad<\/key>\s*<array>[\s\S]*?<\/array>/, '');
  if (push) s = setPlist(s, 'UIBackgroundModes', '<array>\n\t\t<string>remote-notification</string>\n\t</array>');
  return s;
}
export function patchPbxproj(src, { versionName = '1.0.0', buildNumber = 1, teamId = '', entitlements = false } = {}) {
  if (teamId && !/^[A-Z0-9]{10}$/.test(teamId)) throw new Error('APPLE_TEAM_ID invalide (10 caractères A-Z / 0-9)');
  let s = src
    .replace(/TARGETED_DEVICE_FAMILY = "?[0-9,]+"?;/g, 'TARGETED_DEVICE_FAMILY = 1;')
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${versionName};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);
  s = s.replace(/\t*DEVELOPMENT_TEAM = [^;]*;\n/g, '').replace(/\t*CODE_SIGN_ENTITLEMENTS = [^;]*;\n/g, '');
  const extra = (teamId ? `DEVELOPMENT_TEAM = ${teamId};\n` : '') + (entitlements ? 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n' : '');
  if (extra) s = s.replace(/(\t+)CODE_SIGN_STYLE = Automatic;\n/g, (m, tab) => m + extra.split('\n').filter(Boolean).map(l => tab + l + '\n').join(''));
  return s;
}
export function entitlementsPlist({ push = false, appLinks = false } = {}) {
  const keys = [];
  if (push) keys.push('\t<key>aps-environment</key>\n\t<string>production</string>');
  if (appLinks) keys.push(`\t<key>com.apple.developer.associated-domains</key>\n\t<array>\n\t\t<string>applinks:${DEEP_LINK_HOST}</string>\n\t</array>`);
  if (!keys.length) return null;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${keys.join('\n')}\n</dict>\n</plist>\n`;
}
// Push iOS : transmettre le jeton APNs au plugin (méthodes exigées par @capacitor/push-notifications)
export function patchAppDelegate(src, { push = false } = {}) {
  if (!push || src.includes('capacitorDidRegisterForRemoteNotifications')) return src;
  const add = `
    // ${MARK} : jeton des notifications push transmis à @capacitor/push-notifications
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
`;
  const i = src.lastIndexOf('}');
  return src.slice(0, i) + add + src.slice(i);
}

/* ---------- Application aux fichiers générés ---------- */
function edit(path, fn) { if (!existsSync(path)) return false; const a = readFileSync(path, 'utf8'), b = fn(a); if (a !== b) writeFileSync(path, b); return true; }
export function run(env = process.env) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const versionName = env.VERSION_NAME || pkg.version;
  const buildNumber = Number(env.BUILD_NUMBER || 1);
  const push = env.QAMAR_PUSH === '1', appLinks = env.QAMAR_APP_LINKS === '1';
  const done = [];
  if (existsSync('android')) {
    edit('android/variables.gradle', patchVariablesGradle);
    edit('android/app/build.gradle', s => patchAppGradle(s, { versionCode: buildNumber, versionName }));
    edit('android/app/src/main/AndroidManifest.xml', patchManifest);
    mkdirSync('android/app/src/main/res/drawable', { recursive: true });
    writeFileSync('android/app/src/main/res/drawable/ic_stat_qamar.xml', NOTIF_ICON);
    done.push(`android (versionCode ${buildNumber}, versionName ${versionName})`);
  }
  if (existsSync('ios/App')) {
    const ent = entitlementsPlist({ push, appLinks });
    if (ent) writeFileSync('ios/App/App/App.entitlements', ent);
    edit('ios/App/App/Info.plist', s => patchInfoPlist(s, { push }));
    edit('ios/App/App.xcodeproj/project.pbxproj', s => patchPbxproj(s, { versionName, buildNumber, teamId: env.APPLE_TEAM_ID || '', entitlements: !!ent }));
    edit('ios/App/App/AppDelegate.swift', s => patchAppDelegate(s, { push }));
    done.push(`ios (build ${buildNumber}, version ${versionName}${env.APPLE_TEAM_ID ? ', équipe signée' : ', non signé'}${push ? ', push' : ''}${appLinks ? ', liens universels' : ''})`);
  }
  console.log('patch-native :', done.join(' · ') || 'aucun projet natif trouvé');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
