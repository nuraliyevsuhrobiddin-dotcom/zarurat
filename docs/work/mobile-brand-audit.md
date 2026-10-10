# ZARURIYAT mobile route audit — brand revision

Implemented changes below are code inspection findings and fixes. Browser validation uses `artifacts/brand-mobile-fixture.js` with synthetic populated records; no production accounts or customer data are required. Final browser verdict belongs to the evaluator.

## Concrete gaps found

The previous mobile stylesheet left partners, clients, employees and notifications as wide desktop tables. The authentication component still inherited its original purple gradient, dark input backgrounds and star symbol. Body descriptions on case cards were clipped to two lines. Family member tags and long user/partner names could retain desktop spacing. These are addressed with dedicated mobile markup, rather than hiding overflowing tables.

## Route-by-route changes

| Route or section | Change and preserved information |
| --- | --- |
| Home | Actual supplied logo; concise heading and coordinator introduction; controlled hero crop, clear request/tracking actions and separate-page shortcuts. |
| Services | One-column category rows, readable category names, restrained icon surface and full category navigation. |
| Category detail | Blue request action, wrapped explanatory copy, honest individually agreed price/time notice. |
| How | Four real steps, image crop without floating overlay, compact step numerals; corrected earlier shortcut wording from three to four steps. |
| Family | Full-width tiers with real explanatory copy; terms remain individually agreed, no invented prices. |
| Public menu | All routes remain reachable through wrapped 44px+ rows. |
| Request | 16px inputs, 14px labels and complete consent; files, optional scheduling and recording retained. Error and help text wrap. |
| Request receipt | Reference/key remain readable and copyable; secret is never put in the URL. |
| Tracking | Focused form and full result; detail metadata, services, attachments, history and feedback use the same readable detail layout. |
| Login | Supplied 68px logo, concise introduction, navy text, light fields and solid blue submission. |
| Register | Matching light form; wrapping Latin/Cyrillic tabs, 16px name/phone/password inputs, password strength and complete consent retained. |
| Privacy | Complete content retained in the full-page route; notices and body typography readable. |
| Recovery | Honest disabled-provider state remains; enabled recovery form shares light controls and error styling. |
| Director overview | Compact statistics, readable recent case cards and wrapped management tasks. |
| Operator overview | Same statistics and recent cases, authorized coordinator actions retained. |
| Client overview | Personal case cards, real package data and request action. |
| Partner overview | Assigned service cards with real status and detail action. |
| Cases/search | Full case descriptions instead of two-line clipping; case reference/status/name context, filters and paging retained; narrow Cyrillic overdue label wraps. |
| Case detail | Wrapped metadata, description, service titles/actions, notes/history and file buttons. Client feedback preserved. |
| Partners | **Dedicated mobile cards** showing name, category, contract status, region, hours, full address, starting price and phone. Search updates the same card renderer. |
| Clients | **Dedicated mobile cards** showing name, ID, phone, loaded case count, real package tier/remaining balance/expiry/member names or assign-package action. |
| Packages | Real balance, usage, expiry, member names and edit/use actions wrap in full-width cards. |
| Notifications | **Dedicated mobile cards** showing case number, timestamp, real delivery state, event, complete message and recipient phone. Disabled integration notice remains honest. |
| Team | **Dedicated mobile cards** showing name, role, login, ID, phone, assigned partner and allowed password/block actions. Director reset buttons are omitted because the backend only permits operator/partner reset. |
| Cabinet menu | Every authorized section, settings and home remain available; long labels wrap. |
| Settings | Phone/SMS/Telegram state remains accurate; complete disabled-provider explanations retained. |
| Own password | Current/new/confirmation inputs, complete session-revocation guidance and errors retained. |
| Staff password/block | Director confirmation preserved, block action remains feature gated; no provider activation. |
| New partner | All contact/service/contract fields preserved with wrapped labels. |
| New employee | All identity/role/partner/password fields preserved; no unauthorized director creation. |
| Package new/edit/use | Client/tier/expiry/limit/member fields and actual completed-case eligibility retained. |
| Empty/loading/error | Same route, readable state and retry/action controls; no fake populated data or successful-send claims. |

## Shared safety and layout checks

- Actual raster identity uses `/images/zaruriyat-logo-192.png`; root maintains favicon/manifest/startup variants.
- Navy `#071b3b`, blue `#1758ca`, restrained gold `#d9a73a`; light forms and readable dark body text.
- Long names, Cyrillic labels, user descriptions, delivery messages and file names wrap without transliteration.
- Original desktop tables remain in the desktop branches; mobile uses records. Resize re-renders the current route across the mobile breakpoint without backend changes.
- Existing Back/Forward, deep links, refresh, async route-version guards and RAM-only tracking prefill remain.
- 44px interaction targets, safe-area padding and reduced-motion behavior retained.
- Service, client and team values are escaped before insertion; no backend permissions, credentials or business rules changed.

## Limits to report honestly

The synthetic fixture can verify layout and interaction but does not prove provider delivery, business prices or native iPhone behavior. No physical iPhone is available. A real case count loaded through pagination remains a loaded count, not an invented all-time total. SMS/Telegram/payment activation is outside this design revision.
