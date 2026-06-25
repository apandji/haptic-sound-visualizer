"""
WashU Entra OIDC + session auth and audit logging.

Set AUTH_REQUIRED=true and Entra env vars to enable. Default: auth off (lab dev).
"""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Any, FrozenSet, Optional

from flask import Blueprint, Flask, jsonify, redirect, request, session, url_for

from auth_config import (
    ALL_ROLES,
    API_GET_ROLES,
    API_POST_ROLES,
    PAGE_ROLES,
    PUBLIC_EXACT,
    PUBLIC_PREFIXES,
    ROLES_COORDINATOR,
    auth_required,
)

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

_AUDIT_INITIALIZED = False


class AuthUser:
    __slots__ = ('oid', 'email', 'name', 'roles')

    def __init__(self, oid: str, email: str, name: str, roles: frozenset[str]):
        self.oid = oid
        self.email = email
        self.name = name
        self.roles = roles

    def has_any(self, allowed: FrozenSet[str]) -> bool:
        return bool(self.roles & allowed)

    def to_dict(self) -> dict[str, Any]:
        return {
            'oid': self.oid,
            'email': self.email,
            'name': self.name,
            'roles': sorted(self.roles),
        }


def _env(name: str, default: str = '') -> str:
    return (os.environ.get(name) or default).strip()


def entra_configured() -> bool:
    return bool(_env('ENTRA_TENANT_ID') and _env('ENTRA_CLIENT_ID') and _env('ENTRA_CLIENT_SECRET'))


def _authority() -> str:
    tenant = _env('ENTRA_TENANT_ID')
    return f'https://login.microsoftonline.com/{tenant}'


def _redirect_uri() -> str:
    explicit = _env('ENTRA_REDIRECT_URI')
    if explicit:
        return explicit
    port = _env('PORT', '8000')
    host = _env('HOST', '127.0.0.1')
    return f'http://{host}:{port}/auth/callback'


def _msal_app():
    try:
        import msal
    except ImportError as exc:
        raise RuntimeError(
            'msal is required for Entra login. Run: pip3 install -r requirements.txt'
        ) from exc

    return msal.ConfidentialClientApplication(
        _env('ENTRA_CLIENT_ID'),
        authority=_authority(),
        client_credential=_env('ENTRA_CLIENT_SECRET'),
    )


def _roles_from_claims(claims: dict[str, Any]) -> frozenset[str]:
    raw_roles = claims.get('roles') or []
    roles = {r for r in raw_roles if r in ALL_ROLES}
    if roles:
        return frozenset(roles)

    # Optional JSON map: {"group-guid": "Study.Analyst", ...}
    group_map_raw = _env('ENTRA_GROUP_ROLE_MAP')
    if group_map_raw and claims.get('groups'):
        try:
            group_map = json.loads(group_map_raw)
            for gid in claims.get('groups') or []:
                mapped = group_map.get(gid)
                if mapped in ALL_ROLES:
                    roles.add(mapped)
        except json.JSONDecodeError:
            pass

    return frozenset(roles)


def _dev_roles() -> frozenset[str]:
    raw = _env('AUTH_DEV_ROLES', 'Study.Admin')
    picked = {r.strip() for r in raw.split(',') if r.strip() in ALL_ROLES}
    return frozenset(picked or {'Study.Admin'})


def get_current_user() -> Optional[AuthUser]:
    if not auth_required():
        return None
    data = session.get('user')
    if not data:
        return None
    return AuthUser(
        oid=data['oid'],
        email=data.get('email', ''),
        name=data.get('name', ''),
        roles=frozenset(data.get('roles') or []),
    )


def user_has_roles(user: Optional[AuthUser], allowed: FrozenSet[str]) -> bool:
    if not auth_required():
        return True
    if user is None:
        return False
    return user.has_any(allowed)


def _ensure_audit_table(conn: sqlite3.Connection) -> None:
    global _AUDIT_INITIALIZED
    if _AUDIT_INITIALIZED:
        return
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS audit_log (
            audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
            at TEXT NOT NULL,
            entra_oid TEXT NOT NULL,
            email TEXT,
            action TEXT NOT NULL,
            resource TEXT,
            ip TEXT
        )
        '''
    )
    conn.execute('CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at)')
    conn.commit()
    _AUDIT_INITIALIZED = True


def log_audit(action: str, resource: str | None = None) -> None:
    if not auth_required():
        return
    user = get_current_user()
    if not user:
        return
    try:
        from db_handler import get_connection

        conn = get_connection()
        _ensure_audit_table(conn)
        conn.execute(
            '''
            INSERT INTO audit_log (at, entra_oid, email, action, resource, ip)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (
                datetime.now(timezone.utc).isoformat(),
                user.oid,
                user.email,
                action,
                resource,
                request.remote_addr,
            ),
        )
        conn.commit()
    except Exception:
        pass


def init_auth(app: Flask) -> None:
    secret = _env('SESSION_SECRET')
    if not secret:
        secret = secrets.token_hex(32)
        if auth_required():
            print('Warning: SESSION_SECRET not set — using ephemeral secret (sessions reset on restart)')
    app.secret_key = secret
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.register_blueprint(auth_bp)


def _login_redirect(next_path: str | None = None):
    target = next_path or request.path
    if entra_configured():
        return redirect(url_for('auth.login', next=target))
    return redirect(url_for('auth.dev_login', next=target))


def enforce_request_auth() -> Optional[tuple]:
    """Return Flask response if request should be blocked."""
    if not auth_required():
        return None

    path = request.path
    if path.startswith(PUBLIC_PREFIXES) or path in PUBLIC_EXACT:
        return None

    user = get_current_user()
    if user is None:
        if path.startswith('/api/'):
            return jsonify({'error': 'Unauthorized', 'login': '/auth/login'}), 401
        return _login_redirect(path)

    if path.startswith('/api/'):
        if path == '/api/status' or path == '/api/me':
            return None
        allowed = None
        if request.method == 'GET':
            allowed = API_GET_ROLES.get(path)
        elif request.method == 'POST':
            allowed = API_POST_ROLES.get(path)
        if allowed is not None and not user.has_any(allowed):
            return jsonify({
                'error': 'Forbidden',
                'required_roles': sorted(allowed),
            }), 403
        return None

    if path in PAGE_ROLES and not user.has_any(PAGE_ROLES[path]):
        if request.accept_mimetypes.best == 'application/json':
            return jsonify({'error': 'Forbidden', 'page': path}), 403
        return (
            '<!DOCTYPE html><html><body><h1>Access denied</h1>'
            f'<p>Your account cannot open {path}. Contact the study PI.</p>'
            '<p><a href="/">Home</a></p></body></html>',
            403,
            {'Content-Type': 'text/html; charset=utf-8'},
        )

    return None


def require_coordinator_for_new_participant(data: dict) -> Optional[tuple]:
    if not auth_required():
        return None
    if data.get('require_existing'):
        return None
    user = get_current_user()
    if user and user.has_any(ROLES_COORDINATOR):
        return None
    return jsonify({
        'success': False,
        'error': 'Forbidden: registering new participants requires Study.Coordinator role',
    }), 403


@auth_bp.route('/login')
def login():
    if not auth_required():
        return redirect('/')
    if not entra_configured():
        return redirect(url_for('auth.dev_login', next=request.args.get('next', '/')))

    state = secrets.token_urlsafe(16)
    session['oauth_state'] = state
    session['oauth_next'] = request.args.get('next') or '/'

    msal_app = _msal_app()
    auth_url = msal_app.get_authorization_request_url(
        scopes=['openid', 'profile', 'email'],
        state=state,
        redirect_uri=_redirect_uri(),
        prompt='select_account',
    )
    return redirect(auth_url)


@auth_bp.route('/callback')
def callback():
    if not auth_required():
        return redirect('/')

    if request.args.get('state') != session.pop('oauth_state', None):
        return jsonify({'error': 'Invalid OAuth state'}), 400

    code = request.args.get('code')
    if not code:
        err = request.args.get('error_description') or request.args.get('error') or 'No authorization code'
        return jsonify({'error': err}), 400

    result = _msal_app().acquire_token_by_authorization_code(
        code,
        scopes=['openid', 'profile', 'email'],
        redirect_uri=_redirect_uri(),
    )
    if 'error' in result:
        return jsonify({'error': result.get('error_description', result['error'])}), 400

    claims = result.get('id_token_claims') or {}
    roles = _roles_from_claims(claims)
    if not roles:
        return (
            '<!DOCTYPE html><html><body><h1>No study access</h1>'
            '<p>Signed in with WashU Entra, but no study role was assigned.</p>'
            '<p>Ask the PI to add you to a haptic-study-* security group.</p>'
            '</body></html>',
            403,
            {'Content-Type': 'text/html; charset=utf-8'},
        )

    session['user'] = {
        'oid': claims.get('oid') or claims.get('sub') or '',
        'email': claims.get('preferred_username') or claims.get('email') or '',
        'name': claims.get('name') or claims.get('preferred_username') or '',
        'roles': sorted(roles),
    }
    log_audit('auth.login')
    return redirect(session.pop('oauth_next', '/') or '/')


@auth_bp.route('/dev-login')
def dev_login():
    """Local RBAC testing without Entra — only when Entra is not configured."""
    if not auth_required():
        return redirect('/')
    if entra_configured():
        return redirect(url_for('auth.login', next=request.args.get('next', '/')))

    roles = sorted(_dev_roles())
    session['user'] = {
        'oid': 'dev-local',
        'email': _env('AUTH_DEV_EMAIL', 'dev@localhost'),
        'name': 'Dev User',
        'roles': roles,
    }
    log_audit('auth.dev_login')
    return redirect(request.args.get('next') or '/')


@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect('/')


@auth_bp.route('/session')
def session_info():
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False}), 401
    return jsonify({'authenticated': True, 'user': user.to_dict()})


def api_me():
    if not auth_required():
        return jsonify({'authenticated': False, 'auth_required': False})
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False, 'auth_required': True}), 401
    return jsonify({
        'authenticated': True,
        'auth_required': True,
        'user': user.to_dict(),
        'pages': {
            'test': user.has_any(PAGE_ROLES['/test.html']),
            'analyze': user.has_any(PAGE_ROLES['/analyze.html']),
        },
    })
