(function (global) {
  const API_BASE = 'http://localhost:8000';
  const STORAGE_KEYS = {
    token: 'nexora_token',
    role: 'nexora_role',
    user: 'nexora_user',
    loginError: 'nexora_login_error',
  };

  function getStorageValue(storage, key) {
    if (!storage || typeof storage.getItem !== 'function') {
      return null;
    }
    return storage.getItem(key);
  }

  function setStorageValue(storage, key, value) {
    if (storage && typeof storage.setItem === 'function') {
      storage.setItem(key, value);
    }
  }

  function removeStorageValue(storage, key) {
    if (storage && typeof storage.removeItem === 'function') {
      storage.removeItem(key);
    }
  }

  function getToken() {
    return getStorageValue(global.localStorage, STORAGE_KEYS.token);
  }

  function setSession(session) {
    setStorageValue(global.localStorage, STORAGE_KEYS.token, session.access_token);
    setStorageValue(global.localStorage, STORAGE_KEYS.role, session.role);
    setStorageValue(global.localStorage, STORAGE_KEYS.user, session.display_name);
  }

  function clearSession() {
    removeStorageValue(global.localStorage, STORAGE_KEYS.token);
    removeStorageValue(global.localStorage, STORAGE_KEYS.role);
    removeStorageValue(global.localStorage, STORAGE_KEYS.user);
  }

  function getLandingPage(role) {
    if (role === 'admin') {
      return 'admin.html';
    }
    if (role === 'sam_user') {
      return 'index.html';
    }
    return 'login.html';
  }

  function redirectTo(path) {
    if (global.location) {
      global.location.href = path;
    }
  }

  function redirectByRole(role) {
    redirectTo(getLandingPage(role));
  }

  function redirectToLogin(message) {
    if (message) {
      setStorageValue(global.sessionStorage, STORAGE_KEYS.loginError, message);
    }
    redirectTo('login.html');
  }

  async function parseJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  async function login(username, password) {
    const response = await global.fetch(API_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.detail || 'Authentication failed.');
    }
    setSession(payload);
    return payload;
  }

  async function fetchCurrentUser(token) {
    const activeToken = token || getToken();
    if (!activeToken) {
      throw new Error('Not authenticated');
    }

    const response = await global.fetch(API_BASE + '/auth/me', {
      headers: { Authorization: 'Bearer ' + activeToken },
    });
    const payload = await parseJson(response);
    if (!response.ok) {
      throw new Error(payload.detail || 'Session expired.');
    }

    if (payload.role) {
      setStorageValue(global.localStorage, STORAGE_KEYS.role, payload.role);
    }
    if (payload.display_name) {
      setStorageValue(global.localStorage, STORAGE_KEYS.user, payload.display_name);
    }

    return payload;
  }

  async function resumeSession() {
    if (!getToken()) {
      return null;
    }

    try {
      return await fetchCurrentUser();
    } catch (error) {
      clearSession();
      return null;
    }
  }

  async function requireRole(expectedRole) {
    if (!getToken()) {
      redirectToLogin();
      return null;
    }

    try {
      const user = await fetchCurrentUser();
      if (user.role !== expectedRole) {
        redirectByRole(user.role);
        return null;
      }
      return user;
    } catch (error) {
      clearSession();
      redirectToLogin(error.message || 'Session expired.');
      return null;
    }
  }

  function authHeaders(extraHeaders) {
    const token = getToken();
    return {
      ...(extraHeaders || {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    };
  }

  function consumeLoginError() {
    const message = getStorageValue(global.sessionStorage, STORAGE_KEYS.loginError);
    if (message) {
      removeStorageValue(global.sessionStorage, STORAGE_KEYS.loginError);
    }
    return message;
  }

  global.nexoraAuth = {
    API_BASE,
    authHeaders,
    clearSession,
    consumeLoginError,
    fetchCurrentUser,
    getLandingPage,
    login,
    redirectByRole,
    requireRole,
    resumeSession,
    setSession,
  };
})(typeof window !== 'undefined' ? window : globalThis);
