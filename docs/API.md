# ZARURIYAT local MVP API contract

Node 24 server at http://127.0.0.1:3000. Vanilla JS ES modules in public/. All JSON responses except downloads. Errors `{error: string}` with appropriate HTTP status. Cookie session, same-origin requests, no bearer token required. Request bodies JSON. Dates ISO, amounts integer UZS. All data is persisted in SQLite.

## Public
- GET /api/config → `{categories: [{id,name}], regions: string[], statuses: string[], demo: boolean}`. Statuses (ordered): `received`, `reviewing`, `searching`, `arranging`, `contacted`, `completed`; also `cancelled`.
- POST /api/requests `{name,phone,region,category,description,preferredTime,consent:true,attachments?:[{name,type,data:base64}]}` → 201 `{case: Case, trackingToken}`. Max 3 files, 5 MB each, image/jpeg,png,webp, application/pdf, audio/webm,ogg,mp4,mpeg,wav. Voice recording is optional attachment. Public creation supported; if logged in as client links to account. Tracking token is confidential, show once and persist in sessionStorage if useful.
- POST /api/track `{number,token}` → `{case: Case}` (private customer view; no internal notes).
- POST /api/feedback `{number,token,rating:1..5,comment}` → `{ok:true}` only completed case, one feedback.
- GET /api/auth/me → `{user: User|null}`
- POST /api/auth/login `{login,password}` → `{user}`
- POST /api/auth/register `{name,phone,password,consent:true}` → `{user}` (client)
- POST /api/auth/logout `{}` → `{ok:true}`

## Authenticated
- GET /api/cases → `{cases: Case[]}` scoped to role (client own; partner assigned; operator/director all). Client cases carry trackingToken for their own tracking and review actions.
- GET /api/cases/:id → `{case: Case}`
- GET /api/files/:id → attachment download, role scoped. Public tracking view does not expose download links.
- GET /api/packages → `{packages: Package[]}` (client only own; staff all). Package `{id,clientId,clientName,tier,expiresAt,limit,used,remaining,members:string[]}`.

## Staff: operator/director
- GET /api/team → `{users: [{id,name,role}]}` operators/director only
- GET /api/partners → `{partners: Partner[]}`
- POST /api/partners `{name,phone,address,category,hours,region,price,contractStatus}` → 201 `{partner}` (directory entry; account provisioning is separate, seeded partner has account)
- PATCH /api/cases/:id `{status?,coordinatorId?,priority?:'normal'|'urgent',dueAt?,note?}` → `{case}`. Notes internal. Completion blocked until all non-cancelled services complete. Forward status steps may be skipped by staff; terminal cases cannot reopen.
- POST /api/cases/:id/services `{title,partnerId?:number,price?:number}` → `{case}`
- PATCH /api/services/:id `{partnerId?,status?:'pending'|'accepted'|'contacted'|'delivered'|'completed'|'cancelled'}` → `{case}`. partnerId staff only; partner can only update assigned service, in order (pending→accepted→contacted→delivered→completed). Parent terminal case immutable.
- POST /api/packages `{clientId,tier:'Start'|'Komfort'|'Premium',expiresAt,limit,members:string[]}` → `{package}`. Operator/director. One package per client in MVP.
- GET /api/clients → `{clients:[{id,name,phone}]}`
- POST /api/packages/:id/use `{caseId}` → `{package}`. Completed case must belong to client, active package, available limit; case counted once (idempotent). Manual explicit usage registration; one completed case = one unit, no automatic billing.
- GET /api/stats → `{total,today,open,completed,overdue,partners,clients,averageRating,categories:[{name,count}],recent:Case[]}` (staff)
- GET /api/notifications → `{notifications:[{id,caseNumber,event,channel,status,createdAt}]}` (staff). Outbox only: notification architecture ready; Telegram not configured and nothing is sent. Status queued.

## Objects
User `{id,name,role:'client'|'operator'|'director'|'partner',phone,partnerId?}`.
Case `{id,number,name,phone,region,category,description,preferredTime,status,priority,coordinatorId,coordinatorName,dueAt,createdAt,updatedAt,clientId,services:Service[],history:Event[],attachments:Attachment[],feedback?:{rating,comment},trackingToken?}`.
Service `{id,caseId,title,partnerId,partnerName,status,price}`.
Event `{id,kind,message,createdAt,actorName}` (internal notes omitted for clients/partners; partner gets assigned service only, no unneeded client data).
Attachment `{id,name,type,size}`.
Partner `{id,name,phone,address,category,hours,region,price,contractStatus:'active'|'pending'|'expired'}`.

## Local demo accounts
Only loopback binding by default, demo mode enabled. Each password `Zaruriyat2026!`:
- operator / operator
- director / director
- partner / partner
- client / client
UI must clearly indicate demo mode/data without claiming real verified professionals or real outcomes. No external Telegram messages in this build.
