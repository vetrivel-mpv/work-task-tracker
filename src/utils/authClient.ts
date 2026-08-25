import { AppUser, UserRole, ROLE_CONFIGS } from '../types';

const TOKEN_STORAGE_KEY = 'northstar_delivery_jwt_session_v2';

let cachedToken: string | null = null;

/**
 * Retrieves the active JWT token from memory or localStorage
 */
export function getAuthToken(): string | null {
  if (cachedToken) return cachedToken;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      cachedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // localStorage might be unavailable in restricted iframes
  }
  return cachedToken;
}

/**
 * Stores the active JWT token
 */
export function setAuthToken(token: string | null): void {
  cachedToken = token;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

/**
 * Generates authentication headers for API requests (ADO proxy, AI sync, etc.)
 */
export function getAuthHeaders(userHint?: Partial<AppUser>): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }

  // Also pass explicit user identity hints for backend proxy fallback
  if (userHint) {
    if (userHint.id) headers['X-User-Id'] = userHint.id;
    if (userHint.role) headers['X-User-Role'] = userHint.role;
    if (userHint.name) headers['X-User-Name'] = userHint.name;
    if (userHint.email) headers['X-User-Email'] = userHint.email;
    if (userHint.orgScope) headers['X-User-Org-Scope'] = userHint.orgScope;
    if (userHint.projectScope) headers['X-User-Proj-Scope'] = userHint.projectScope;
  }

  return headers;
}

export interface AuthSessionResponse {
  ok: boolean;
  token?: string;
  authenticated?: boolean;
  session?: {
    userId: string;
    name: string;
    email: string;
    role: UserRole;
    orgScope: string;
    projectScope: string;
    isAdoConnectionOwner: boolean;
    permissions: typeof ROLE_CONFIGS[UserRole];
  };
  error?: string;
}

/**
 * Synchronizes the active user with the backend authentication system,
 * requesting a signed HS256 JWT session token with embedded role and scopes.
 */
export async function syncAuthSession(user: AppUser): Promise<AuthSessionResponse> {
  try {
    const resp = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgScope: user.orgScope || '*',
        projectScope: user.projectScope || '*',
        isAdoConnectionOwner: Boolean(user.isAdoConnectionOwner)
      })
    });

    if (resp.ok) {
      const data = (await resp.json()) as AuthSessionResponse;
      if (data.token) {
        setAuthToken(data.token);
      }
      return data;
    } else {
      const errText = await resp.text();
      return { ok: false, error: errText };
    }
  } catch (err: any) {
    console.warn('[AuthClient] Failed to synchronize token with backend:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Inspects the current authenticated session directly from the backend
 */
export async function fetchCurrentSession(): Promise<AuthSessionResponse> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const resp = await fetch('/api/auth/session', { headers });
    if (resp.ok) {
      return (await resp.json()) as AuthSessionResponse;
    }
    return { ok: false, error: `HTTP ${resp.status}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
