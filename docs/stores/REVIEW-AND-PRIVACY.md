# App review, age rating, privacy answers

Answers for App Store Connect and the Google Play Console, matching what the app really does.
Two cases, because what the app sends off the phone depends on `assets/config.js`:

- **Build A, today** (`backend: 'demo'`, `push.enabled: false`): nothing leaves the phone. Tickets live in the phone's local storage.
- **Build B, salon open** (`backend: 'supabase'`, later `push.enabled: true`): the ticket (first name, WhatsApp number) is sent to QAMAR's Supabase server.

Analytics: `assets/track.js` is switched off inside the native app (code check), and off on the website until GA4 and the consent banner exist. The app never loads Google Analytics. No advertising SDK, no IDFA, no App Tracking Transparency prompt needed.

> Important (Apple guideline 2.2, Google Play "minimum functionality"): a store app must be a finished product, not a demo.
> Use **TestFlight** and the Play **internal testing** track while the salon is not open (Build A).
> Submit for public review only with Build B, once the salon takes real walk-ins.

## Apple: App Privacy ("nutrition label")

**Build A:** "Data Not Collected".

**Build B:**

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
| --- | --- | --- | --- | --- |
| Contact Info: Name (first name) | Yes | Yes (ticket) | No | App Functionality |
| Contact Info: Phone Number | Yes | Yes (ticket) | No | App Functionality |
| User Content: Other User Content (optional rating comment to the salon) | Yes | Yes | No | App Functionality |
| Purchases: Purchase History (look and drinks on the ticket, paid at the lounge) | Yes | Yes | No | App Functionality |
| Identifiers: Device ID (push token, only once push is on) | Yes | Yes | No | App Functionality |

Everything else: not collected (no location, no contacts, no photos, no browsing, no diagnostics, no usage data).

## Google Play: Data safety

**Build A:** "No data collected", "No data shared".

**Build B:**

- Data collected: Personal info > Name (required), Phone number (required); App activity > Other user-generated content (optional rating comment); Financial info > Purchase history (look and drinks on the ticket); Device or other IDs (only once push is on).
- Purpose for all: App functionality. Shared with third parties: No (Supabase is a service provider acting for QAMAR, which Google does not count as sharing).
- Encrypted in transit: Yes (HTTPS). Users can request deletion: Yes (WhatsApp or at the lounge, see privacy policy). No account in the app, so no account-deletion URL is required.

## Age rating

Apple (2025 questionnaire): answer **None / No** to every item: no violence, no sexual content, no profanity, no drugs or alcohol, no gambling or contests, no horror, no medical or treatment information, no user-generated content shown to others, no messaging or chat, no unrestricted web access (external links open the system browser), no advertising. Result: **4+**.

Google Play (IARC questionnaire): category **Reference, news or educational? No: "All other app types"**; answer No to violence, sexuality, language, controlled substances, gambling, user interaction (users cannot talk to each other), sharing of location, digital purchases. Result: **Everyone / PEGI 3 / 3+**.

Target audience (Google Play): 18 and over (adult customers book for themselves; mini looks are booked by the parent). Not designed for children.

## Notes for Apple App Review (paste in "Notes")

```text
QAMAR is a walk-in blow-dry lounge in Dubai. There are no appointments and no accounts: customers open the app, see how busy the lounge is, choose a look and join the queue with a first name and WhatsApp number. The ticket screen shows their place in line and turns into a "your wait is over" screen with the seat number when a stylist calls them.

Native features: tab bar navigation (Home, Queue, Looks, Me), local notifications when the customer is called and for reminders the customer sets on the home screen, haptic feedback, Android back button handling, and deep links from the QR code at the lounge (qamarlounge.com/go) straight to the queue.

No login is needed. There are no payments in the app: customers pay at the counter after the service, by card or cash. Links to WhatsApp, Instagram and the website open outside the app.

To see the whole flow without visiting the lounge: Home > Join the queue > pick any look > Continue > First available > Continue > type any first name and a phone number such as 50 123 4567 > Join the queue. [Only if the build still runs in demo mode: the ticket screen then shows "Demo: simulate the next step", which plays the lounge's part (call, service, checkout).]
```

Contact for App Review: owner's name, phone and e-mail (to fill in App Store Connect, not here).
