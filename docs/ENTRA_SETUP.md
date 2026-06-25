# WashU Entra SSO — quick setup for IT

Use this checklist to turn on auth once OIS registers the app. **Until `AUTH_REQUIRED=true`, the lab app behaves exactly as before.**

## 1. IT ticket (copy/paste)

> **App:** Haptic Sound Visualizer (lab research tool, localhost on study iMac)  
> **Need:** Entra app registration + security groups for RBAC  
> **Redirect URI:** `http://127.0.0.1:8000/auth/callback` (confirm if HTTPS required)  
> **Protocol:** OIDC authorization code, confidential client (client secret)  
> **Scopes:** `openid`, `profile`, `email` only (no Graph)  
> **App roles to create:**
> - `Study.Operator` — run Test sessions  
> - `Study.Analyst` — Analyze corpus  
> - `Study.Coordinator` — enroll participants + Test  
> - `Study.PI` — export / subject access (future)  
> - `Study.Admin` — full access  
> **Groups:** assign each `haptic-study-*` group the matching app role  
> **Token:** include `roles` claim (app roles assigned to groups)

## 2. Lab machine

```bash
cd ~/Documents/haptic-sound-visualizer
pip3 install -r requirements.txt
cp .env.example .env
# Edit .env with tenant ID, client ID, secret, SESSION_SECRET
export AUTH_REQUIRED=true
python3 server.py
```

Open `http://127.0.0.1:8000/` → redirects to WashU login → returns with session cookie.

## 3. Test RBAC before IT (optional)

```bash
export AUTH_REQUIRED=true
export AUTH_DEV_ROLES=Study.Operator   # no Entra vars set
python3 server.py
# Visit http://127.0.0.1:8000/auth/dev-login — grants dev session
```

Try `/analyze.html` — should 403 with Operator-only dev role.

## 4. Role → capability matrix

| Role | Explore | Test | Analyze | New participant |
|------|---------|------|---------|-----------------|
| Study.Operator | ✓ | ✓ | — | — |
| Study.Analyst | ✓ | — | ✓ | — |
| Study.Coordinator | ✓ | ✓ | — | ✓ |
| Study.PI / Admin | ✓ | ✓ | ✓ | ✓ |

## 5. Audit log

When auth is on, sensitive actions append to SQLite `audit_log` (entra oid, email, action, timestamp).

## 6. Open with IT

- Is `http://127.0.0.1:8000` acceptable for redirect URI, or must we use HTTPS / internal DNS?
- Who owns `haptic-study-*` groups — PI or IT?

See also [CYBERSEC_RESPONSE.md](CYBERSEC_RESPONSE.md) §2.
