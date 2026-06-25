# Cybersecurity & Privacy Response — Haptic Sound Visualizer Study

**Prepared:** June 2026 (follow-up to cybersec review)  
**Audience:** WashU cybersec, OIS, IRB, study team  
**Related docs:** [DATA_STORAGE_PLAN.md](DATA_STORAGE_PLAN.md), [AUDIT_2026-06-11.md](AUDIT_2026-06-11.md)

This document answers questions raised in the cybersec conversation: securing the lab iMac, Entra (Microsoft) SSO with role-based access, participant identifier strategy, and fulfilling participant data-access requests.

---

## Current state (honest baseline)


| Control                    | Today                                                                     | Gap                                                 |
| -------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| Live database location     | Local iMac disk (`haptic_research_v2.db`)                                 | No automated encrypted off-site backup wired up yet |
| Server exposure            | `127.0.0.1` only (localhost)                                              | No authentication on API                            |
| Access to participant data | Anyone who can run the app + has the `.db` file                           | No SSO, no roles                                    |
| Participant identifiers    | `participant_code` stored as plain text (often first initial + last name) | Quasi-identifier in the research database           |
| Encryption at rest (disk)  | Depends on iMac FileVault setting                                         | Must be verified and documented                     |
| Encryption in backups      | Designed (`age`/GPG in storage plan)                                      | Not automated yet                                   |


The app is a **lab tool**, not a multi-tenant web service. Cybersec’s direction (encrypted device + Entra RBAC + better identifiers) is the right upgrade path before wider deployment or IRB scale-up.

---

## 1. Securing the testing-bed iMac

### 1.1 Full-disk encryption (FileVault)

**Yes — the drive can and should stay encrypted.**

On macOS, **FileVault** encrypts the entire startup volume at rest. When the Mac is off or locked, data on disk (including `haptic_research_v2.db`) is not readable without the user’s login password (and FileVault recovery key / institutional escrow if configured).

**Verify on the lab iMac:**

1. **System Settings → Privacy & Security → FileVault** — status should be **On**.
2. Confirm WashU IT policy: many university-managed Macs use **FileVault with institutional recovery key escrow** (IT can recover if needed; document this in the IRB plan).
3. Require **strong login password** + **automatic screen lock** (e.g. 5–10 minutes idle) + **Require password after sleep**.

FileVault protects **at-rest** data if the machine is stolen or disk is removed. It does **not** protect data while someone is logged in and the server is running — that is where SSO/RBAC (§2) and physical access matter.

### 1.2 Other iMac controls (recommended for IRB / cybersec checklist)


| Control                                                | Purpose                                            |
| ------------------------------------------------------ | -------------------------------------------------- |
| Dedicated study user account (non-admin for daily use) | Limits accidental installs / malware               |
| No shared “lab” login                                  | Accountability                                     |
| Firewall on; only localhost for the research server    | Already binding to `127.0.0.1`                     |
| Automatic macOS security updates                       | Patch vulnerabilities                              |
| Physical access: locked lab / cable lock               | Device theft                                       |
| No live DB in Box Drive sync folder                    | Avoid SQLite corruption (see DATA_STORAGE_PLAN §2) |
| Nightly encrypted snapshots to approved Box folder     | Recovery if disk fails                             |


**For cybersec:** “Research data at rest on the testing iMac is protected by FileVault full-disk encryption. The application binds to localhost only. Backups are encrypted snapshots uploaded to WUSTL Box, not continuous sync of the live database.”

---

## 2. Entra (Microsoft) SSO and role-based access

Cybersec’s requirement: **admins (and ideally all users who see participant data) authenticate via WashU Entra ID**, with **role-based access** to participant-level data.

### 2.1 Why the current app doesn’t meet this yet

Today:

- `server.py` is a single-threaded `http.server` with **no auth**.
- Analyze/Test pages load data via `/api/participants`, `/api/analysis/sessions`, etc. with no session check.
- Copying `haptic_research_v2.db` to another machine bypasses any future UI login unless the **API** enforces auth.

RBAC must be enforced **on the server**, not only in the browser.

### 2.2 Recommended architecture (Entra OIDC)

WashU SSO typically means **OpenID Connect (OIDC)** against **Microsoft Entra ID** (Azure AD). High-level target:

```
Browser → Login via WashU Entra (OIDC authorization code flow)
       → Server validates JWT (issuer, audience, signature, expiry)
       → Server maps identity to app roles
       → API returns data allowed for that role
```

**Concrete steps (with WashU IT / cybersec):**

1. **Register an application** in Entra (or use an existing WashU research app registration pattern).
  - Redirect URI: `https://localhost:8000/auth/callback` or a proper lab hostname if IT provides one.
  - For localhost-only dev, IT may require a **reverse proxy** or **certificate + internal DNS** — ask cybersec which pattern WashU prefers for lab apps.
2. **Define app roles** in Entra (or map from Entra **groups**):
  - `Study.Admin` — full access: all participants, export, analyst tools, Test session save.
  - `Study.Analyst` — read Analyze data, add analyst notes/tags, exclude trials; no raw export of full corpus (optional split).
  - `Study.Operator` — run Test sessions, see participant **codes** needed for session setup but not Analyze corpus (optional).
  - `Study.PI` — same as Admin + export for subject-access requests.
   Map WashU groups (e.g. `haptic-study-admins`) to roles via token `**groups`** or `**roles**` claims.
3. **Replace or wrap `http.server`** with a stack that supports middleware:
  - **Pragmatic path:** Flask or FastAPI + `msal` / `authlib` for OIDC + session cookies or Bearer tokens.
  - Keep static file serving for HTML/JS/CSS; protect `/api/*` routes.
4. **Enforce on every sensitive route:**

  | Endpoint class                                        | Minimum role     |
  | ----------------------------------------------------- | ---------------- |
  | `GET /api/analysis/sessions`, participants in Analyze | Analyst+         |
  | `POST /api/session`, Test save                        | Operator+        |
  | `POST /api/analysis/*`, trial notes, tags             | Analyst+         |
  | Export / subject-access bundle                        | PI or Admin only |

5. **Audit logging:** Log authenticated `oid` / `email`, action, timestamp, resource id (trial_id, participant_id) to an append-only table or file — required for cybersec and subject-access accountability.
6. **Localhost vs network:** If the app must stay localhost-only, SSO still works in the browser on that machine; users RDP/physical to the iMac. If remote access is needed, use **WashU VPN + SSO** — do not expose the raw Python server to the public internet.

### 2.3 What “RBAC” means for participant data in *this* app

Minimum viable policy:

- **No anonymous API access** — every `/api/*` call requires valid Entra session.
- **Participant list** visible only to roles that need to run or analyze sessions.
- **Export endpoints** (future) restricted to PI/Admin.
- **Database file on disk** still contains all data — disk encryption + physical security remain necessary; SSO protects the **application layer**.

Copying the `.db` file off the machine remains a bypass until backups are encrypted and access-controlled (Box permissions). Cybersec should treat **Box collaborator list** as part of the access-control boundary.

### 2.4 Implementation phasing (suggested)


| Phase | Deliverable                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------- |
| **A** | Entra app registration + login page + protect `/api/analysis/sessions` and `/api/participants`                        |
| **B** | Role claims → route matrix; audit log table                                                                           |
| **C** | Per-participant export API for subject-access requests (§4)                                                           |
| **D** | Optional: migrate from `http.server` to production ASGI with TLS termination if IT requires HTTPS even on lab network |


---

## 3. Participant codes: de-identify vs anonymize

### 3.1 Problem with today’s convention

Storing `**participant_code` = first initial + last name** (e.g. `jsmith`, `APANDJI`) in SQLite is **not de-identified** in a meaningful sense:

- It is a **quasi-identifier** (often unique in a cohort).
- It appears in the UI, exports, and backups.
- Combined with age/gender and session dates, re-identification risk is material at “hundreds of participants” scale.

For IRB/cybersec language: treat current codes as **identifiable** unless and until you stop using name-derived codes and separate the linkage key (§3.4).

### 3.2 Terminology (use precisely with IRB)


| Term                      | Meaning                                                        | Can link returning participant?                 |
| ------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| **Identified**            | Name/ID in the dataset                                         | Yes                                             |
| **Coded / pseudonymized** | Random or opaque ID in dataset; **linkage key elsewhere**      | Yes, via codebook                               |
| **De-identified**         | HIPAA Safe Harbor or expert determination; no reasonable re-id | Usually no new linkage without key              |
| **Anonymized**            | Key destroyed; **cannot** re-link                              | **No** — returning participant cannot be merged |


**One-way hash alone does not solve “returning participant”** unless the hash is **deterministic** from a secret + stable input (see HMAC below). Pure SHA-256(name) without a secret is reversible by guessing names in a small cohort.

### 3.3 Recommended approach: study pseudonym + separate codebook

**Best fit for your study** (returning participants, IRB, cybersec):

1. **Inside SQLite (research database):** store only an opaque `**study_participant_id`**, e.g.:
  - `HSV-000042` (random, assigned at enrollment), or
  - `HMAC-SHA256(study_secret, washu_unique_id)` truncated — deterministic pseudonym.
2. **Outside SQLite (codebook / linkage file):** a separate, tighter-access store mapping:
  ```
   washu_id / name / contact  →  study_participant_id  →  consent form ID
  ```
  - Stored in **separate Box folder** (or REDCap), **not** in git, **not** in the same folder as trial backups.
  - Access: PI + coordinator only (stricter than general study analysts).
3. **Enrollment workflow:**
  - Coordinator looks up person in codebook (or creates row after consent).
  - Assigns or looks up opaque `study_participant_id`.
  - Test UI uses **only** the opaque id (dropdown/search by opaque id, not by name).
4. **Stop using name-derived codes in the database going forward.** Legacy rows can be migrated: generate new opaque ids, update codebook once, retire old codes.

### 3.4 HMAC / salt — when to use what


| Technique                                | Use case                                                             | In research DB?                    |
| ---------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| **Random ID** (`HSV-000042`)             | Simplest; enrollment assigns next id                                 | Store opaque id only               |
| **HMAC(study_pepper, institutional_id)** | Same person always maps to same pseudonym without storing name in DB | Store HMAC output or truncated hex |
| **Salted hash without secret**           | Weak — rainbow tables / guessing                                     | Not recommended                    |
| **One-way hash, key destroyed**          | True anonymization after study end                                   | No return visits                   |


**HMAC properties cybersec cares about:**

- **Pepper / study secret** stored in HSM, password manager, or sealed config — **not** in git, not in the same Box folder as backups.
- Rotating the pepper **breaks** linkage to old pseudonyms — plan rotation only at study boundary.
- HMAC is **pseudonymization**, not anonymization, as long as the codebook or pepper exists.

**Implementation sketch (future migration):**

```text
At enrollment (coordinator tool, not in public repo):
  pseudonym = "HSV-" + first_available_sequence
  OR
  pseudonym = base32(HMAC-SHA256(STUDY_PEPPER, washu_employee_id))[:8]

SQLite participants.participant_code ← pseudonym only
Codebook (separate): washu_id, legal_name, pseudonym, consent_id
```

### 3.5 What we should **not** claim

- Do not claim “anonymized” while a codebook exists or codes are name-derived.
- Do not put the codebook in the same encrypted backup bundle as trial data without an extra access tier (cybersec may want **two keys / two folders**).

---

## 4. Participant requests for access to their data

Participants may ask **what data you hold about them** (access) or **correction/deletion** (jurisdiction-dependent; research retention often limits deletion — IRB/legal counsel decides).

### 4.1 What “their data” includes in this system

Per participant (by opaque id or via codebook lookup):


| Category      | Source tables / UI                                                   |
| ------------- | -------------------------------------------------------------------- |
| Demographics  | `participants` (age, gender, handedness, notes)                      |
| Sessions      | `sessions` (dates, experimenter, location, equipment, session notes) |
| Trials        | `trials` (pattern, times, exclusion flag, analyst notes)             |
| Survey        | `trial_survey_responses` + related tag tables                        |
| EEG           | `brainwave_readings` (time series — large)                           |
| Tester events | `trial_events` if present                                            |


### 4.2 Recommended workflow

1. **Intake** — Participant contacts PI/coordinator (email/in person). Verify identity **outside** the app (WashU ID, consent record) using the **codebook**, not the research DB alone.
2. **Authorization** — PI confirms request is valid; IRB/consent language may describe scope and timeline (e.g. 30 days).
3. **Export** — Authorized `Study.PI` user runs a **subject-access export** (to be built):
  - Filter all rows for `participant_id` / opaque code.
  - Produce **human-readable PDF or JSON** + optional CSV summaries.
  - Exclude other participants’ data entirely.
  - Include metadata: export date, who ran it (Entra identity), study title.
4. **Delivery** — Encrypted channel (Box link with WashU account only, or encrypted zip + separate password via phone).
5. **Audit** — Log request date, fulfiller, export hash, delivery method in a **subject access log** (separate from SQLite or append-only table).

### 4.3 Technical work (backlog)

- `GET /api/participants/{id}/export` or CLI `export_participant_data.py --participant HSV-000042` (PI role only).
- Redact other participants if generating aggregate context.
- Document in consent: *what* will be provided and *retention* if they request deletion (often “cannot delete until retention period ends” with legal review).

### 4.4 Team members with a copy of the database

If collaborators hold `haptic_research_v2.db` locally, they can see all participants today — **subject-access process must not add new copies** without tracking. Prefer: only PI machine holds full DB; analysts use SSO to localhost or a future centralized service.

---

## 5. Encryption summary (cybersec one-pager)


| Layer                  | Mechanism                                         | Status                                      |
| ---------------------- | ------------------------------------------------- | ------------------------------------------- |
| **Device at rest**     | FileVault on iMac                                 | Verify On; document in IRB                  |
| **Backups at rest**    | Client-side encrypt (`age`/GPG) before Box upload | Planned — see DATA_STORAGE_PLAN §5          |
| **Box at rest**        | AES-256 (vendor) + access controls                | Use dedicated study folder, no shared links |
| **In transit**         | TLS for Box; localhost HTTP for app today         | If SSO adds HTTPS, use IT cert              |
| **Application access** | Entra SSO + RBAC                                  | **To implement**                            |
| **Identifiers**        | Opaque study IDs + separate codebook              | **To implement / migrate**                  |


---

## 6. Open questions for cybersec / IT (next meeting)

1. Preferred pattern for Entra OIDC on a **localhost lab app** — app registration template, redirect URIs, group → role mapping.
2. Is **client-side encryption of Box backups** required or is Box + collaborator ACL sufficient for this data class?
3. Approval to use **deterministic HMAC pseudonyms** vs sequential random ids — any WashU key-management requirement for the study pepper?
4. Should **analysts** ever receive a full `.db` copy, or only query via authenticated app?
5. **Subject-access export** — acceptable deliverable format and retention of export logs?
6. **FileVault recovery** — is institutional escrow in place on the lab iMac?

---

## 7. Suggested implementation priority

1. **Verify FileVault + screen lock** on lab iMac (same day, no code).
2. **Stop new name-derived codes**; adopt opaque IDs + codebook process (process + small UI change).
3. **Entra SSO + RBAC on API** (largest engineering; blocks unauthorized app access).
4. **Automated encrypted backups** to study Box folder.
5. **Participant export tool** + audit log for access requests.
6. **Migrate legacy `participant_code` values** if old name-based codes exist in production DB.

---

## 8. References

- [DATA_STORAGE_PLAN.md](DATA_STORAGE_PLAN.md) — Box, backups, SQLite sync hazards, codebook separation
- [AUDIT_2026-06-11.md](AUDIT_2026-06-11.md) — localhost bind, XSS fixes, scale notes
- WashU OIS data classification: [https://informationsecurity.wustl.edu/guidance/data-classification/](https://informationsecurity.wustl.edu/guidance/data-classification/)
- Microsoft Entra OIDC: [https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
- HIPAA de-identification (if applicable): [https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html](https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html)

