# Data Storage & Backup Plan — Haptic Sound Visualizer Study

**Prepared:** June 11, 2026 (for IRB discussion)
**Scope:** Storage, backup, and de-identification plan for the study's SQLite database (`haptic_research_v2.db`), which holds participant codes, demographics (age, gender), EEG brainwave readings, and subjective survey responses for haptic pattern trials. Planned scale: hundreds of participants, thousands of trials.

**Bottom line:** WashU Box (WUSTL Box) is an institutionally approved service for protected, identifiable human-subjects research data — so using it is defensible. But the **live SQLite database must never sit in a Box-synced folder**. The safe architecture is: live DB stays local on the lab machine, and an automated pipeline pushes encrypted, timestamped, integrity-checked snapshots to Box. A handful of WashU-specific questions (data classification of the EEG + demographics set, Box's "no equipment backups" clause, retention period) should be confirmed with the IRB and the Office of Information Security (OIS) — they are listed in §7.

---

## 1. What WashU policy says (verified, with sources)

All sources accessed June 11, 2026. Where something could not be verified from WashU sources, it is explicitly flagged.

### 1.1 Data classification at WashU

WashU classifies data as **Public, Confidential, Protected, or Controlled Unclassified Information (CUI)** (not "public/internal/confidential/protected" — there is no "internal" tier; the closest equivalent is "Confidential").

- **Protected** = data regulated by federal/state/local law (HIPAA, FERPA, etc.).
- A collection must be classified at the level of its **most restrictive element**.
- Sources:
  - Data Classification (OIS): [https://informationsecurity.wustl.edu/guidance/data-classification/](https://informationsecurity.wustl.edu/guidance/data-classification/)
  - Policy 100, Information Security Program (§100.04): [https://informationsecurity.wustl.edu/items/information-security-program-policy-100/](https://informationsecurity.wustl.edu/items/information-security-program-policy-100/)

This study's dataset (participant codes + demographics + EEG + survey responses) is **identifiable human-subjects data** (coded data with an existing linkage key is still identifiable under the Common Rule until the key is destroyed). Expect it to be classified **Protected** (or at minimum Confidential); the exact call is the PI's responsibility under WashU's Research Data and Materials Policy and should be confirmed with OIS (see §7).

### 1.2 Is WUSTL Box approved for this data? Yes — with caveats

- WUSTL Box is explicitly approved for **"Protected identifiable human subject research data (HIPAA & Common Rule)"**, PHI, and FERPA records.
Source: Box Cloud Service Guidelines (WashU IT): [https://it.wustl.edu/items/box-cloud-service-guidelines/](https://it.wustl.edu/items/box-cloud-service-guidelines/)
- OIS's approved-services matrix lists WUSTL Box with checkmarks for PHI and PII (alongside WashU Research Data Storage, WashU OneDrive, SharePoint, LabArchives). Google Drive, Dropbox, and iCloud are **not** approved for confidential/protected data.
Source: Recommended IT Services for Confidential or Protected Information (OIS): [https://informationsecurity.wustl.edu/guidance/recommended-it-services-for-confidential-or-protected-information/](https://informationsecurity.wustl.edu/guidance/recommended-it-services-for-confidential-or-protected-information/)
- WashU's research office lists WUSTL Box as an approved central storage option for research data ("ePHI, protected, or confidential data; not approved for ITAR, FISMA, or PCI data").
Source: Store Data Centrally via WashU Services: [https://research.washu.edu/store-data-centrally-via-washu-services/](https://research.washu.edu/store-data-centrally-via-washu-services/)
- HRPO guidance on electronic storage of human research study documents names **WUSTL Box, WUSTL OneDrive, REDCap, and the Research Storage Project** as acceptable secure locations, and *recommends against* storing study documents only on local desktops/laptops because they are not backed up by university IT.
Source: Electronic Storage of Human Research Study Documents: [https://research.washu.edu/electronic-storage-research-study-documents/](https://research.washu.edu/electronic-storage-research-study-documents/)

**Caveats that matter for this plan** (from WashU IT's Box Appropriate Use Guidelines, [https://it.wustl.edu/items/box-appropriate-use-guidelines-future-state/](https://it.wustl.edu/items/box-appropriate-use-guidelines-future-state/)):

1. "Sensitive Identifiable Human Subject Research" is in the **"Appropriate With Assistance"** column — meaning the team is expected to consult local IT support about best practices before storing it in Box. Plan to do this; it is an easy box to check before the IRB meeting.
2. The "Not Appropriate" column includes **"Long term 'cold storage'"**, **"Backups from other file servers"**, and **"Backups from laboratory equipment."** A literal reading could cover timestamped snapshots of a lab-machine database. The intent appears aimed at bulk server/instrument dumps rather than a study's primary research dataset (which HRPO explicitly says to keep in Box/OneDrive/etc.), but **this must be confirmed with WashU IT/OIS** — see §7. If OIS says snapshots-to-Box is out of scope, the fallback is **WashU RIS Research Data Storage** (5 TB free, approved for the same data classes, daily backups): [https://research.washu.edu/store-data-centrally-via-washu-services/](https://research.washu.edu/store-data-centrally-via-washu-services/).
3. Default Box quota is **1 TB** (as of Nov 2025). SQLite snapshots of EEG data at the planned scale could approach this over time; rotation (§5.4) keeps this bounded.
4. Box is **not** approved for export-controlled (ITAR/EAR), FISMA, or PCI data — not relevant here, but worth stating in the IRB conversation.

### 1.3 Box platform security mechanics (vendor-level, verified)

- **Encryption:** Box encrypts content at rest (AES 256-bit) and in transit (TLS). WashU IT notes all WUSTL Box data is stored encrypted in U.S. data centers. Sources: [https://it.wustl.edu/items/box-considerations-for-use/](https://it.wustl.edu/items/box-considerations-for-use/), Box security docs.
- **Versioning:** Box automatically keeps version history when a file is overwritten; versions can be listed/restored via UI or API (`GET /files/{id}/versions`). Source: [https://developer.box.com/reference/get-files-id-versions](https://developer.box.com/reference/get-files-id-versions). Note: version history retains a *limited number* of versions per file depending on the enterprise plan — do not rely on it as the rotation mechanism; use distinct timestamped filenames instead (§5.3).
- **Access control:** Box permissions are folder-level via named collaborators with roles (Co-owner, Editor, Viewer Uploader, Previewer Uploader, Viewer, Previewer, Uploader). Shared links should be disabled for the research folder; access should be by invited WashU collaborator accounts only.
- **Clients / transfer paths:**
  - **Box Sync is end-of-life December 2026** — do not build anything on it. Source: [https://support.box.com/hc/en-us/articles/47220952814867-Announcing-end-of-life-for-Box-Sync](https://support.box.com/hc/en-us/articles/47220952814867-Announcing-end-of-life-for-Box-Sync)
  - **Box Drive** is the supported desktop client (streams files on demand; can mark folders for offline).
  - **Box API / Box CLI** support scripted uploads (chunked upload for large files). Source: [https://developer.box.com/guides/cli](https://developer.box.com/guides/cli)
  - **FTPS/SFTP** exist for Business/Enterprise accounts but Box recommends API/CLI/Drive instead; unencrypted FTP was retired Oct 2024. Whether SFTP/FTPS is enabled on WashU's Box tenant is **not verified** — ask WashU IT if that path is preferred. Source: [https://support.box.com/hc/en-us/articles/21886969466259-Unencrypted-FTP-end-of-life-EOL-notice](https://support.box.com/hc/en-us/articles/21886969466259-Unencrypted-FTP-end-of-life-EOL-notice)

---

## 2. Why the live database must NOT live on Box (the critical technical issue)

It is tempting to put `haptic_research_v2.db` inside a Box Drive folder and call it "backed up." **Do not do this.** A live SQLite database in any cloud-synced folder (Box Drive, Dropbox, Google Drive, OneDrive) risks **silent corruption and data loss**:

1. **Sync clients are not database-aware.** SQLite coordinates concurrent access with byte-range file locks on the database and its journal. Sync clients copy files without honoring those locks; SQLite's own documentation lists external programs reading/copying the file mid-transaction and broken file locking as primary corruption causes. Source: "How To Corrupt An SQLite Database File": [https://sqlite.org/howtocorrupt.html](https://sqlite.org/howtocorrupt.html)
2. **The database is not one file.** In WAL mode SQLite maintains `haptic_research_v2.db` + `-wal` + `-shm` companions; in rollback mode, a `-journal` file. These must stay mutually consistent at all times. Sync clients upload them independently and at different moments, so a restored or second-machine copy can easily have a database file newer than its journal (or vice versa) — a corrupt state. Sources: [https://sqlite.org/howtocorrupt.html](https://sqlite.org/howtocorrupt.html) (§ "stray journal files" and hot-journal mismatch); SQLite-users discussion of Dropbox/Box specifically ("Dropbox fails the ACID test for databases. So does its competitor Box"): [https://sqlite-users.sqlite.narkive.com/rZpa3p6c/sqlite-sqlite-dropbox](https://sqlite-users.sqlite.narkive.com/rZpa3p6c/sqlite-sqlite-dropbox)
3. **Torn snapshots.** If the sync client captures the file mid-transaction, the uploaded copy contains a half-applied transaction. The local DB stays fine; the cloud "backup" is garbage — discovered only when a restore is attempted.
4. **Conflict forks.** If the file is ever touched from two machines (or the sync client and the app race), Box/Dropbox-style services create "conflicted copy" files, forking the dataset. For an IRB-governed study, two diverging copies of the research record is itself a data-integrity finding.
5. **SQLite's own guidance on remote/synced filesystems** is blunt: unreliable locking over network filesystems "has led to database corruption," and the recommended pattern is to keep the DB on a local disk and access it only from that machine. Source: "SQLite Over a Network": [https://www.sqlite.org/useovernet.html](https://www.sqlite.org/useovernet.html)
6. **Whole-file re-upload at scale.** Every committed write would re-upload the entire database. At hundreds of participants × thousands of EEG trials the DB will be large; continuous full-file uploads are wasteful and widen the torn-snapshot window.

**Conclusion:** the live DB stays on the lab machine's local disk. Box receives only *closed, consistent, point-in-time snapshot files* produced by SQLite's own backup mechanism.

---

## 3. Recommended architecture

```
┌──────────────────────────── Lab machine (local disk) ───────────────────────────┐
│                                                                                  │
│  server.py (localhost only)  ──►  haptic_research_v2.db   (LIVE — local only,   │
│                                    + -wal/-shm)             FileVault-encrypted  │
│                                                              disk)               │
│                                          │                                       │
│                              nightly backup job (§5)                             │
│                                          ▼                                       │
│   backups/haptic_research_YYYY-MM-DDTHHMMSSZ.db      (sqlite3 .backup output)    │
│                                          │  integrity_check → encrypt (age/gpg)  │
│                                          ▼                                       │
│   backups/outbox/haptic_research_YYYY-MM-DDTHHMMSSZ.db.age                       │
└──────────────────────────────────────────┼───────────────────────────────────────┘
                                           │ upload (Box CLI/API preferred;
                                           │ or Box Drive folder used ONLY
                                           ▼ as a one-way backup destination)
                      ┌────────────────────────────────────────┐
                      │  WUSTL Box: /HapticStudy-Backups/      │
                      │  (invited collaborators only,          │
                      │   no shared links, AES-256 at rest)    │
                      └────────────────────────────────────────┘
```

**In the Box-synced/uploaded set:**

- Encrypted, timestamped snapshot files (`*.db.age` or `*.db.gpg`)
- A small `MANIFEST` per snapshot (timestamp, SHA-256 of plaintext and ciphertext, schema version, row counts) — makes restore verification and audit trivial
- (Optionally) exported de-identified CSV extracts for analysis collaborators

**Never in the synced set:**

- The live `haptic_research_v2.db` and its `-wal`/`-shm`/`-journal` companions
- The legacy `haptic_research.db` while any tool can still write to it
- The identity/linkage key (see §4) — it goes in a *separate* Box folder (or REDCap) with a stricter access list, never alongside trial data
- Code, git repo, OS/server backups (Box appropriate-use guidance excludes server backups; the git repo belongs on GitHub/GitLab anyway)

**Local-disk note:** HRPO recommends against local-only storage precisely because lab machines aren't university-backed-up — this plan addresses that with the automated Box pipeline. The lab machine's disk should have full-disk encryption enabled (FileVault on macOS) and the machine should be physically secured per the IRB protocol.

---

## 4. De-identification: participant codes vs. identity key

**Current state of the schema (`schema_v2.sql`):** the `participants` table stores `participant_code` (an arbitrary code), `age`, and `gender` — no names, emails, or contact info in the database. This is good and should be preserved as a hard rule: **direct identifiers never enter the SQLite database.**

**Recommended structure (standard IRB data-management-plan language):**

1. **Coded dataset (the SQLite DB + its backups):** identified only by `participant_code`. Demographics limited to what the protocol needs (age, gender). Note that coded data is still *identifiable* human-subjects data under the Common Rule for as long as a linkage key exists anywhere — so the DB and backups are handled at the Protected/Confidential tier regardless.
2. **Identity key (linkage file):** a single document mapping `participant_code` → name/contact/consent record. Stored **separately** from the trial data — different Box folder (or REDCap project) with a minimal access list (PI + designated coordinator only). The IRB plan should state: who holds it, who can access it, and that it is never co-located with or transmitted alongside the coded dataset.
3. **Consent forms** live with the identity key tier, not with trial data (HRPO electronic-storage guidance applies: certified electronic copies in an approved system).
4. **Key destruction:** state in the protocol when the linkage key is destroyed (e.g., after data collection completes and any compensation/follow-up obligations end). After destruction, the dataset becomes de-identified, which typically relaxes (but does not eliminate) handling requirements — retention rules in §6 still apply.
5. **Re-identification risk note for the IRB:** with hundreds of participants, `age + gender` granularity is low-risk, but if demographics expand (e.g., exact birthdate, rare conditions, free-text), revisit. EEG waveforms themselves have been discussed in the literature as potentially biometric; the IRB may ask — the honest answer is the data are treated as identifiable-coded regardless, so the protections don't depend on resolving that question.

**Typical DMP sentence the team can adapt:** *"Research data are stored in a coded form on an encrypted, access-restricted lab computer, identified only by participant code. The key linking codes to identities is stored separately in [WUSTL Box folder X / REDCap], accessible only to the PI and study coordinator. Encrypted, timestamped backups of the coded dataset are stored in WUSTL Box, a WashU-approved service for identifiable human-subjects research data, restricted to named study personnel."*

---

## 5. Backup pipeline design (to implement later — not tonight)

### 5.1 Snapshot: use SQLite's online backup, not file copy

`cp` on a live DB has the same torn-copy problem as a sync client. SQLite provides a safe online backup that takes a consistent snapshot while the server keeps running:

```bash
sqlite3 haptic_research_v2.db ".backup 'backups/haptic_research_${TS}.db'"
```

(`VACUUM INTO 'file'` is an equally safe alternative that also compacts.) Then verify before shipping:

```bash
sqlite3 "backups/haptic_research_${TS}.db" "PRAGMA integrity_check;"   # must print "ok"
```

The existing `migrate_to_v2.py` already uses `backups/haptic_research_frozen_<timestamp>.db` naming — keep that convention: **UTC ISO-8601 timestamps in the filename**, e.g. `haptic_research_2026-06-11T230000Z.db`. Distinct filenames (rather than overwriting one file and leaning on Box version history) make retention explicit and restores unambiguous.

### 5.2 Encrypt before upload

Box encrypts at rest, but client-side encryption adds defense-in-depth (protects against misconfigured sharing, over-broad collaborator lists, or account compromise) and is an easy, strong line in the IRB plan:

- **age** (simple, modern): `age -r <recipient-pubkey> -o snapshot.db.age snapshot.db`
- or **gpg**: `gpg --encrypt --recipient <key> snapshot.db`

Key management rule: the decryption private key lives with the PI (and one escrow copy in the lab's password manager / printed in a sealed envelope per lab SOP) — **not** on Box next to the backups. Document this in the DMP. Note: client-side encryption is recommended but, per WashU policy as verified above, not strictly required for Box-approved data classes — present it as an added safeguard, and ask OIS if they require it (§7).

### 5.3 Upload to Box

Preferred order:

1. **Box CLI / Box API** (scripted, no sync client running against the folder at all): `box files:upload backups/outbox/<file> --parent-id <BOX_FOLDER_ID>`. Use a dedicated Box app token or the CLI's user login; chunked upload handles large files. This is the cleanest option because nothing on the lab machine continuously syncs anything.
2. **Box Drive folder used strictly as a one-way backup destination**: the job *moves* the finished, encrypted snapshot into the Box Drive folder and nothing else ever writes there. Acceptable, but inferior — the sync client is still a resident process, and a misplaced live DB in that folder recreates §2.
3. **Box SFTP/FTPS** only if WashU IT says it's enabled and preferred; Box itself recommends API/CLI over FTP.

Never: Box Sync (EOL Dec 2026).

### 5.4 Schedule, retention, rotation

- **Schedule:** nightly at a quiet hour via `launchd` (macOS lab machine) or `cron`; plus an on-demand run after each data-collection session day. Nightly is proportionate to "a handful of sessions per week"; tighten to per-session if collection becomes daily.
- **Rotation (grandfather-father-son):** keep all **dailies for 14 days**, **weeklies (e.g., Sunday) for 8 weeks**, **monthlies for the full retention period** (§6). The rotation script deletes only on Box (or in the outbox) per these rules and never touches the live DB.
- **Local copies:** keep the last ~7 unencrypted snapshots in local `backups/` for fast restores; everything older lives only on Box, encrypted.
- **⚠ Fix before implementing:** the repo's `.gitignore` currently ignores the live DBs but explicitly **un-ignores `backups/`** (`!backups/`, `!backups/**`), so database snapshots containing participant data would be committed to git and pushed to any remote (GitHub etc.) — an unapproved storage location for this data. Change `.gitignore` to exclude `backups/*.db` (and `*.db.age`) before the backup job is built, and confirm no snapshot has already been committed to repo history.
- **Monitoring:** the job writes a one-line result to a log and the MANIFEST; a weekly calendar reminder for the coordinator to eyeball "last successful backup" beats silent failure. (A failed-backup email/Slack hook is a nice later addition.)
- **Restore drill:** once per semester, download the latest snapshot, decrypt, run `PRAGMA integrity_check`, open it against the analyze UI on a scratch machine, and log the result. An untested backup is not a backup, and "we test restores quarterly" reads well in an IRB plan.

### 5.5 Pipeline pseudocode (for the eventual `backup_db.py`)

```text
1. TS = utcnow ISO-8601
2. sqlite3 .backup → backups/haptic_research_{TS}.db
3. PRAGMA integrity_check on the snapshot → abort + alert if not "ok"
4. sha256(snapshot) → MANIFEST line
5. age/gpg encrypt → backups/outbox/haptic_research_{TS}.db.age
6. upload outbox file + MANIFEST via Box CLI → verify upload (size/hash via API)
7. apply rotation policy (local + Box)
8. append result to backup log
```

---

## 6. Retention (WashU rules, verified)

- WashU policy: human-subjects research records, including signed consent forms, must be kept **at least 6 years beyond study close** (close form in myIRB). Sources: [https://research.washu.edu/research-data-and-materials-policy/](https://research.washu.edu/research-data-and-materials-policy/), [https://research.washu.edu/electronic-storage-research-study-documents/](https://research.washu.edu/electronic-storage-research-study-documents/)
- Sponsor/FDA rules can extend this (e.g., HIPAA authorizations 6 years; DHHS grants 3 years post-award; longest applicable period wins). Source: [https://research.washu.edu/research-data-record-retention-requirements/](https://research.washu.edu/research-data-record-retention-requirements/)
- Practical implication: the **monthly** backups (§5.4) are the long-term retention set. Note the tension with Box's "no long-term cold storage" guidance — one more reason to confirm with OIS whether end-of-study archives should land on Box or on RIS Research Data Storage / the Research Storage Project (§7).
- Also note: HRPO guidance says converting study documents to electronic storage and the specific protections used must be reflected in **myIRB section 5.4 (Privacy & Confidentiality)** — this storage plan is exactly what that section should describe.

---

## 7. Open questions for the IRB / OIS / WashU IT (bring these tomorrow)

1. **Data classification:** Does OIS/the IRB classify this dataset (coded participant IDs + age/gender + EEG + survey responses, with a separately stored linkage key) as **Protected** or **Confidential**? (EEG in a non-clinical, non-covered-entity study is presumably not HIPAA PHI — confirm rather than assume.)
2. **Box scope:** WUSTL Box is approved for identifiable human-subjects data, but its appropriate-use guidance excludes "backups from laboratory equipment" and "long-term cold storage." **Do nightly encrypted snapshots of the study database fall under the approved research-data use, or does OIS prefer RIS Research Data Storage / the Research Storage Project for the backup + archive role?**
3. **"Appropriate With Assistance":** Sensitive identifiable human-subjects data in Box requires consulting local IT support — who is the right contact, and do they require client-side encryption or specific folder settings?
4. **Access list:** Exact named personnel for (a) the backup folder and (b) the identity-key folder; process for removing access when someone leaves the study (WashU policy requires removing access when a role ends).
5. **Retention period:** Confirm 6-years-post-close is the binding number for this study (any sponsor/funding overlay?), and where the end-of-study archive should live.
6. **Lab machine:** Does the IRB want specific language about the local machine (full-disk encryption, physical location, who has the login, server bound to localhost)?
7. **myIRB 5.4:** Confirm the wording of the Privacy & Confidentiality section reflecting this plan (coded data, separate key, encrypted Box backups, restore testing).

---

## 8. Source list

**WashU-specific (verified June 11, 2026):**

- OIS Data Classification: [https://informationsecurity.wustl.edu/guidance/data-classification/](https://informationsecurity.wustl.edu/guidance/data-classification/)
- OIS Policy 100 (classification categories): [https://informationsecurity.wustl.edu/items/information-security-program-policy-100/](https://informationsecurity.wustl.edu/items/information-security-program-policy-100/)
- OIS Recommended IT Services for Confidential or Protected Information: [https://informationsecurity.wustl.edu/guidance/recommended-it-services-for-confidential-or-protected-information/](https://informationsecurity.wustl.edu/guidance/recommended-it-services-for-confidential-or-protected-information/)
- WashU IT — Box Cloud Service Guidelines: [https://it.wustl.edu/items/box-cloud-service-guidelines/](https://it.wustl.edu/items/box-cloud-service-guidelines/)
- WashU IT — Box Appropriate Use Guidelines: [https://it.wustl.edu/items/box-appropriate-use-guidelines-future-state/](https://it.wustl.edu/items/box-appropriate-use-guidelines-future-state/)
- WashU IT — Box Considerations for Use: [https://it.wustl.edu/items/box-considerations-for-use/](https://it.wustl.edu/items/box-considerations-for-use/)
- WashU Research — Store Data Centrally (Box vs RIS comparison): [https://research.washu.edu/store-data-centrally-via-washu-services/](https://research.washu.edu/store-data-centrally-via-washu-services/)
- WashU Research — Electronic Storage of Human Research Study Documents: [https://research.washu.edu/electronic-storage-research-study-documents/](https://research.washu.edu/electronic-storage-research-study-documents/)
- WashU Research — Research Data and Materials Policy: [https://research.washu.edu/research-data-and-materials-policy/](https://research.washu.edu/research-data-and-materials-policy/)
- WashU Research — Data/Record Retention Requirements: [https://research.washu.edu/research-data-record-retention-requirements/](https://research.washu.edu/research-data-record-retention-requirements/)

**SQLite / sync-folder hazard:**

- How To Corrupt An SQLite Database File: [https://sqlite.org/howtocorrupt.html](https://sqlite.org/howtocorrupt.html)
- SQLite Over a Network, Caveats and Considerations: [https://www.sqlite.org/useovernet.html](https://www.sqlite.org/useovernet.html)
- SQLite-users discussion, SQLite + Dropbox/Box: [https://sqlite-users.sqlite.narkive.com/rZpa3p6c/sqlite-sqlite-dropbox](https://sqlite-users.sqlite.narkive.com/rZpa3p6c/sqlite-sqlite-dropbox)

**Box mechanics:**

- Box Sync end-of-life (Dec 2026): [https://support.box.com/hc/en-us/articles/47220952814867-Announcing-end-of-life-for-Box-Sync](https://support.box.com/hc/en-us/articles/47220952814867-Announcing-end-of-life-for-Box-Sync)
- Box CLI: [https://developer.box.com/guides/cli](https://developer.box.com/guides/cli)
- Box file versions API: [https://developer.box.com/reference/get-files-id-versions](https://developer.box.com/reference/get-files-id-versions)
- Box unencrypted-FTP EOL / FTPS-SFTP status: [https://support.box.com/hc/en-us/articles/21886969466259-Unencrypted-FTP-end-of-life-EOL-notice](https://support.box.com/hc/en-us/articles/21886969466259-Unencrypted-FTP-end-of-life-EOL-notice)

**Explicitly unverified / to confirm with WashU:** whether SFTP/FTPS is enabled on WashU's Box tenant; whether OIS treats DB snapshots as excluded "equipment backups"; exact data classification of this study's dataset; whether OIS mandates client-side encryption for this data class on Box.