import crypto from 'crypto';
import express from 'express';
import { authenticate } from '../auth/middleware.js';
import { supabase } from '../auth/supabase.js';

const router = express.Router();

const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'organizations';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const APP_URL = process.env.APP_URL || 'http://localhost:8787';
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `${APP_URL.replace(/\/$/, '')}/api/microsoft/callback`;
const MICROSOFT_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'User.Read',
  'Calendars.ReadBasic'
];
const AUTH_BASE = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0`;
const connectionStateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function isConfigured() {
  return Boolean(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET);
}

function getCryptoKey() {
  const secret = process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCryptoKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decryptSecret(value) {
  if (!value) return null;
  const [ivBase64, tagBase64, dataBase64] = String(value).split('.');
  if (!ivBase64 || !tagBase64 || !dataBase64) return null;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getCryptoKey(),
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataBase64, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

function getErrorText(error) {
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
}

function isMissingRelation(error, relationName) {
  const errorText = getErrorText(error);
  return new RegExp(`relation ["']?${relationName}["']? does not exist`, 'i').test(errorText)
    || new RegExp(`Could not find the table ['"]${relationName}['"]`, 'i').test(errorText);
}

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, payload] of connectionStateStore.entries()) {
    if (payload.expiresAt <= now) {
      connectionStateStore.delete(state);
    }
  }
}

function createConnectionState(userId) {
  cleanupExpiredStates();
  const state = crypto.randomBytes(24).toString('hex');
  connectionStateStore.set(state, {
    userId,
    expiresAt: Date.now() + STATE_TTL_MS
  });
  return state;
}

function consumeConnectionState(state) {
  cleanupExpiredStates();
  const payload = connectionStateStore.get(state);
  if (!payload) return null;
  connectionStateStore.delete(state);
  if (payload.expiresAt <= Date.now()) return null;
  return payload;
}

function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: MICROSOFT_SCOPES.join(' '),
    state
  });

  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

async function getConnectionRecord(userId) {
  const { data, error } = await supabase
    .from('microsoft_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error, 'microsoft_connections')) {
      return { data: null, migrationRequired: true };
    }
    throw error;
  }

  return { data: data || null, migrationRequired: false };
}

async function saveConnectionRecord(userId, payload) {
  const { data, error } = await supabase
    .from('microsoft_connections')
    .upsert({
      user_id: userId,
      ...payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function exchangeAuthorizationCode(code) {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    client_secret: MICROSOFT_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    scope: MICROSOFT_SCOPES.join(' ')
  });

  const response = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error_description || json.error || 'Failed to exchange Microsoft authorization code.');
  }

  return json;
}

async function refreshAccessToken(connection) {
  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  if (!refreshToken) {
    throw new Error('Microsoft refresh token is unavailable. Please reconnect your Microsoft account.');
  }

  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    client_secret: MICROSOFT_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    scope: MICROSOFT_SCOPES.join(' ')
  });

  const response = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error_description || json.error || 'Failed to refresh Microsoft access token.');
  }

  const expiresAt = new Date(Date.now() + Number(json.expires_in || 3600) * 1000).toISOString();
  const nextConnection = await saveConnectionRecord(connection.user_id, {
    microsoft_user_id: connection.microsoft_user_id,
    tenant_id: connection.tenant_id,
    email: connection.email,
    display_name: connection.display_name,
    scopes: json.scope ? json.scope.split(' ') : connection.scopes,
    access_token_encrypted: encryptSecret(json.access_token),
    refresh_token_encrypted: encryptSecret(json.refresh_token || refreshToken),
    expires_at: expiresAt,
    connected_at: connection.connected_at || new Date().toISOString(),
    last_synced_at: connection.last_synced_at || null
  });

  return {
    connection: nextConnection,
    accessToken: json.access_token
  };
}

async function getValidAccessToken(connection) {
  const expiresAtMs = connection?.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const tokenStillValid = expiresAtMs && expiresAtMs - Date.now() > 2 * 60 * 1000;

  if (tokenStillValid) {
    return {
      connection,
      accessToken: decryptSecret(connection.access_token_encrypted)
    };
  }

  return refreshAccessToken(connection);
}

async function fetchMicrosoftProfile(accessToken) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error?.message || 'Failed to load Microsoft profile.');
  }

  return json;
}

function renderCallbackPage({ title, message, success }) {
  const statusColor = success ? '#24a148' : '#da1e28';
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; background: #161616; color: #f4f4f4; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        .card { width: 100%; max-width: 560px; background: #262626; border: 1px solid #393939; border-radius: 16px; padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
        .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #8d8d8d; margin-bottom: 12px; }
        .status { color: ${statusColor}; font-weight: 700; margin-bottom: 20px; }
        h1 { margin: 0 0 12px 0; font-size: 30px; }
        p { margin: 0 0 24px 0; line-height: 1.6; color: #c6c6c6; }
        a { display: inline-block; background: #0f62fe; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="eyebrow">IBM Recap</div>
        <div class="status">${success ? '✓ Microsoft connected' : '! Connection issue'}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${APP_URL}">Return to IBM Recap</a>
      </div>
    </body>
  </html>`;
}

router.get('/status', authenticate, async (req, res) => {
  try {
    const { data: connection, migrationRequired } = await getConnectionRecord(req.user.id);

    return res.json({
      ok: true,
      configured: isConfigured(),
      migrationRequired,
      connected: Boolean(connection),
      redirectUri: MICROSOFT_REDIRECT_URI,
      scopes: MICROSOFT_SCOPES,
      connection: connection ? {
        email: connection.email,
        displayName: connection.display_name,
        connectedAt: connection.connected_at,
        expiresAt: connection.expires_at,
        lastSyncedAt: connection.last_synced_at
      } : null
    });
  } catch (error) {
    console.error('Microsoft status error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to load Microsoft connection status.' });
  }
});

router.get('/connect-url', authenticate, async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'Microsoft Teams integration is not configured yet.',
      code: 'MICROSOFT_NOT_CONFIGURED'
    });
  }

  const { migrationRequired } = await getConnectionRecord(req.user.id);
  if (migrationRequired) {
    return res.status(503).json({
      ok: false,
      error: 'Microsoft connection storage is not ready yet. Apply the Phase 2B SQL migration first.',
      code: 'MICROSOFT_MIGRATION_REQUIRED'
    });
  }

  const state = createConnectionState(req.user.id);
  return res.json({
    ok: true,
    url: buildAuthorizeUrl(state)
  });
});

router.get('/callback', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res
        .status(503)
        .send(renderCallbackPage({
          title: 'Microsoft integration is not configured',
          message: 'Add the Microsoft client ID and client secret before completing the Teams connection flow.',
          success: false
        }));
    }

    const errorDescription = req.query.error_description || req.query.error;
    if (errorDescription) {
      return res
        .status(400)
        .send(renderCallbackPage({
          title: 'Microsoft connection was not completed',
          message: String(errorDescription),
          success: false
        }));
    }

    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    const statePayload = consumeConnectionState(state);

    if (!statePayload || !code) {
      return res
        .status(400)
        .send(renderCallbackPage({
          title: 'Microsoft connection link is no longer valid',
          message: 'Please return to IBM Recap and reconnect your Microsoft account from the Meetings tab.',
          success: false
        }));
    }

    const { migrationRequired } = await getConnectionRecord(statePayload.userId);
    if (migrationRequired) {
      return res
        .status(503)
        .send(renderCallbackPage({
          title: 'Microsoft connection storage is not ready',
          message: 'Apply the Phase 2B SQL migration first, then reconnect your Microsoft account.',
          success: false
        }));
    }

    const tokenResponse = await exchangeAuthorizationCode(code);
    const profile = await fetchMicrosoftProfile(tokenResponse.access_token);
    const expiresAt = new Date(Date.now() + Number(tokenResponse.expires_in || 3600) * 1000).toISOString();

    await saveConnectionRecord(statePayload.userId, {
      microsoft_user_id: profile.id,
      tenant_id: MICROSOFT_TENANT_ID,
      email: profile.mail || profile.userPrincipalName || null,
      display_name: profile.displayName || null,
      scopes: tokenResponse.scope ? tokenResponse.scope.split(' ') : MICROSOFT_SCOPES,
      access_token_encrypted: encryptSecret(tokenResponse.access_token),
      refresh_token_encrypted: encryptSecret(tokenResponse.refresh_token || null),
      expires_at: expiresAt,
      connected_at: new Date().toISOString()
    });

    return res.send(renderCallbackPage({
      title: 'Your Microsoft calendar is connected',
      message: 'IBM Recap can now begin loading your Teams meeting schedule in the Meetings tab.',
      success: true
    }));
  } catch (error) {
    console.error('Microsoft callback error:', error);
    return res
      .status(500)
      .send(renderCallbackPage({
        title: 'Microsoft connection failed',
        message: error.message || 'Something went wrong while finishing the Microsoft connection.',
        success: false
      }));
  }
});

router.get('/calendar', authenticate, async (req, res) => {
  try {
    const { data: connection, migrationRequired } = await getConnectionRecord(req.user.id);
    if (migrationRequired) {
      return res.status(503).json({ ok: false, error: 'Apply the Microsoft connection migration first.', code: 'MICROSOFT_MIGRATION_REQUIRED' });
    }

    if (!connection) {
      return res.status(400).json({ ok: false, error: 'Microsoft calendar is not connected.', code: 'MICROSOFT_NOT_CONNECTED' });
    }

    const daysPast = Math.min(Math.max(Number(req.query.daysPast || 7), 0), 30);
    const daysFuture = Math.min(Math.max(Number(req.query.daysFuture || 14), 1), 60);
    const startDate = new Date(Date.now() - daysPast * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(Date.now() + daysFuture * 24 * 60 * 60 * 1000).toISOString();
    const { accessToken, connection: refreshedConnection } = await getValidAccessToken(connection);

    const params = new URLSearchParams({
      startDateTime: startDate,
      endDateTime: endDate,
      $top: '50',
      $select: 'id,subject,start,end,organizer,attendees,isOnlineMeeting,onlineMeetingProvider,webLink'
    });

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendar/calendarView?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"'
      }
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error?.message || 'Failed to fetch Microsoft calendar events.');
    }

    await saveConnectionRecord(req.user.id, {
      microsoft_user_id: refreshedConnection.microsoft_user_id,
      tenant_id: refreshedConnection.tenant_id,
      email: refreshedConnection.email,
      display_name: refreshedConnection.display_name,
      scopes: refreshedConnection.scopes,
      access_token_encrypted: refreshedConnection.access_token_encrypted,
      refresh_token_encrypted: refreshedConnection.refresh_token_encrypted,
      expires_at: refreshedConnection.expires_at,
      connected_at: refreshedConnection.connected_at,
      last_synced_at: new Date().toISOString()
    });

    const meetings = (json.value || []).map((event) => ({
      id: event.id,
      title: event.subject || 'Untitled Teams meeting',
      start: event.start?.dateTime || null,
      end: event.end?.dateTime || null,
      organizer: event.organizer?.emailAddress?.name || event.organizer?.emailAddress?.address || 'Unknown organizer',
      organizerEmail: event.organizer?.emailAddress?.address || null,
      attendeeCount: Array.isArray(event.attendees) ? event.attendees.length : 0,
      isOnlineMeeting: Boolean(event.isOnlineMeeting),
      onlineMeetingProvider: event.onlineMeetingProvider || null,
      webLink: event.webLink || null
    }));

    return res.json({
      ok: true,
      meetings
    });
  } catch (error) {
    console.error('Microsoft calendar fetch error:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to fetch Microsoft calendar events.' });
  }
});

router.delete('/connection', authenticate, async (req, res) => {
  try {
    const { error } = await supabase
      .from('microsoft_connections')
      .delete()
      .eq('user_id', req.user.id);

    if (error && !isMissingRelation(error, 'microsoft_connections')) {
      throw error;
    }

    return res.json({ ok: true, message: 'Microsoft calendar disconnected.' });
  } catch (error) {
    console.error('Microsoft disconnect error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to disconnect Microsoft calendar.' });
  }
});

export default router;
