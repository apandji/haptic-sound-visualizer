"""
Entra RBAC configuration — roles and route permissions.

Role names must match Entra app registration role values exactly.
"""

from __future__ import annotations

import os
from typing import FrozenSet

# Entra app role identifiers (assign to WashU security groups in Entra)
ROLE_OPERATOR = 'Study.Operator'
ROLE_ANALYST = 'Study.Analyst'
ROLE_COORDINATOR = 'Study.Coordinator'
ROLE_PI = 'Study.PI'
ROLE_ADMIN = 'Study.Admin'

ALL_ROLES = frozenset({
    ROLE_OPERATOR,
    ROLE_ANALYST,
    ROLE_COORDINATOR,
    ROLE_PI,
    ROLE_ADMIN,
})

# Anyone signed in (any study role)
ROLE_ANY = frozenset(ALL_ROLES)

# Test session + audio + lookup existing participant
ROLES_OPERATOR: FrozenSet[str] = frozenset({
    ROLE_OPERATOR,
    ROLE_COORDINATOR,
    ROLE_PI,
    ROLE_ADMIN,
})

# Analyze corpus read/write
ROLES_ANALYST: FrozenSet[str] = frozenset({
    ROLE_ANALYST,
    ROLE_PI,
    ROLE_ADMIN,
})

# Register new participants (POST /api/participants/resolve without require_existing)
ROLES_COORDINATOR: FrozenSet[str] = frozenset({
    ROLE_COORDINATOR,
    ROLE_PI,
    ROLE_ADMIN,
})

ROLES_PI: FrozenSet[str] = frozenset({ROLE_PI, ROLE_ADMIN})

# Explore index — any authenticated study member
ROLES_INDEX: FrozenSet[str] = ROLE_ANY

# GET /api/* path → allowed roles (exact path match)
API_GET_ROLES: dict[str, FrozenSet[str]] = {
    '/api/list-audio-files': ROLES_OPERATOR,
    '/api/tags': ROLES_OPERATOR,
    '/api/locations': ROLES_OPERATOR,
    '/api/participants': ROLES_OPERATOR | ROLES_ANALYST | ROLES_COORDINATOR,
    '/api/survey/custom-actions': ROLES_OPERATOR,
    '/api/analysis/pattern-metadata': ROLES_ANALYST,
    '/api/analysis/sessions': ROLES_ANALYST,
    '/api/analysis/tags': ROLES_ANALYST,
    '/api/analysis/pattern-tags': ROLES_ANALYST,
    '/api/timing-stats': ROLES_OPERATOR,
    '/api/pattern-stats': ROLES_OPERATOR,
}

# POST /api/* path → allowed roles (special cases handled in server)
API_POST_ROLES: dict[str, FrozenSet[str]] = {
    '/api/session': ROLES_OPERATOR,
    '/api/sessions/bulk': ROLES_OPERATOR,
    '/api/analysis/trials/exclude': ROLES_ANALYST,
    '/api/analysis/tags': ROLES_ANALYST,
    '/api/analysis/pattern-tags': ROLES_ANALYST,
    '/api/analysis/trials/notes': ROLES_ANALYST,
    '/api/participants/resolve': ROLES_OPERATOR,  # tightened per-request for new enrollment
}

PAGE_ROLES: dict[str, FrozenSet[str]] = {
    '/index.html': ROLES_INDEX,
    '/': ROLES_INDEX,
    '/test.html': ROLES_OPERATOR,
    '/analyze.html': ROLES_ANALYST,
}

PUBLIC_PREFIXES = (
    '/auth/',
    '/css/',
    '/js/',
    '/audio_files/',
    '/favicon.ico',
)

PUBLIC_EXACT = frozenset({'/api/status', '/api/me'})


def auth_required() -> bool:
    return os.environ.get('AUTH_REQUIRED', '').lower() in ('1', 'true', 'yes')
