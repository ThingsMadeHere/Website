const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const { pool, initDb } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

// Dendrite internal URL (container-to-container)
const DENDRITE_URL     = process.env.DENDRITE_URL     || 'http://mchs-dendrite:8008';
const SHARED_SECRET = process.env.SHARED_SECRET || 'mchs_robotics_registration_secret';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── helpers ──────────────────────────────────────────────────────────────────

// Dendrite shared-secret registration (nonce-based HMAC)
async function dendriteRegister(username, password) {
  // Step 1: get nonce
  const nonceRes = await fetch(`${DENDRITE_URL}/_synapse/admin/v1/register`);
  const { nonce } = await nonceRes.json();

  // Step 2: compute HMAC-SHA1
  const crypto = require('crypto');
  const mac = crypto
    .createHmac('sha1', SHARED_SECRET)
    .update(`${nonce}\0${username}\0${password}\0notadmin`)
    .digest('hex');

  // Step 3: register
  const regRes = await fetch(`${DENDRITE_URL}/_synapse/admin/v1/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nonce, username, password, admin: false, mac }),
  });

  const data = await regRes.json();
  if (!regRes.ok) throw new Error(data.error || 'Registration failed');
  return data; // { user_id, access_token, device_id }
}

// Matrix password login
async function dendriteLogin(username, password) {
  const res = await fetch(`${DENDRITE_URL}/_matrix/client/v3/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type:       'm.login.password',
      identifier: { type: 'm.id.user', user: username },
      password,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data; // { user_id, access_token, device_id }
}

// ── routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

// POST /api/register
// Body: { username, password, deviceId? }
app.post('/api/register', async (req, res) => {
  const { username, password, deviceId } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });

  // Matrix spec: 1–255 chars, only a-z 0-9 . _ - /
  // We enforce lowercase and reasonable length
  const cleaned = username.toLowerCase().trim();
  if (!/^[a-z0-9._\-/]{1,64}$/.test(cleaned))
    return res.status(400).json({ error: 'Username may only contain letters, numbers, and . _ - characters' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    // Register on Dendrite
    const matrix = await dendriteRegister(cleaned, password);

    // Store in our DB
    const device = deviceId || uuidv4();
    await pool.query(
      `INSERT INTO site_users (device_id, matrix_id, username, verified)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (matrix_id) DO NOTHING`,
      [device, matrix.user_id, cleaned]
    );

    // Auto-join the team room
    const ROOM_ID = process.env.ROOM_ID || '!90VPR3Bd5d7Zi4lF:mchsrobotics.dev';
    await fetch(`${DENDRITE_URL}/_matrix/client/v3/join/${encodeURIComponent(ROOM_ID)}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${matrix.access_token}`,
      },
      body: JSON.stringify({}),
    });

    return res.json({
      userId:      matrix.user_id,
      accessToken: matrix.access_token,
      deviceId:    device,
      verified:    false,
    });
  } catch (err) {
    console.error('Register error:', err.message);
    // If Matrix user already exists, try login path
    if (err.message.includes('already exists') || err.message.includes('M_USER_IN_USE')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/login
// Body: { username, password }
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username and password required' });

  try {
    const matrix = await dendriteLogin(username, password);

    // Look up verified status
    const { rows } = await pool.query(
      'SELECT verified, device_id FROM site_users WHERE matrix_id = $1',
      [matrix.user_id]
    );

    const ROOM_ID = process.env.ROOM_ID || '!90VPR3Bd5d7Zi4lF:mchsrobotics.dev';

    // If user exists in Matrix but not in our DB (e.g. admin-created), add them
    if (rows.length === 0) {
      const device = uuidv4();
      await pool.query(
        `INSERT INTO site_users (device_id, matrix_id, username, verified)
         VALUES ($1, $2, $3, FALSE) ON CONFLICT DO NOTHING`,
        [device, matrix.user_id, username]
      );
      // Join room
      await fetch(`${DENDRITE_URL}/_matrix/client/v3/join/${encodeURIComponent(ROOM_ID)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${matrix.access_token}` },
        body: JSON.stringify({}),
      });
      return res.json({
        userId:      matrix.user_id,
        accessToken: matrix.access_token,
        deviceId:    device,
        verified:    false,
      });
    }

    // Ensure existing users are in the room too
    await fetch(`${DENDRITE_URL}/_matrix/client/v3/join/${encodeURIComponent(ROOM_ID)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${matrix.access_token}` },
      body: JSON.stringify({}),
    });

    return res.json({
      userId:      matrix.user_id,
      accessToken: matrix.access_token,
      deviceId:    rows[0].device_id,
      verified:    rows[0].verified,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    if (err.message.includes('M_FORBIDDEN') || err.message.includes('Invalid')) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/verify
// Body: { userId } — called after photo upload succeeds
app.post('/api/verify', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  await pool.query(
    'UPDATE site_users SET verified = TRUE WHERE matrix_id = $1',
    [userId]
  );
  return res.json({ ok: true, verified: true });
});

// GET /api/users/verified — returns map of userId → verified for chat badges
app.get('/api/users/verified', async (_, res) => {
  const { rows } = await pool.query('SELECT matrix_id, verified FROM site_users');
  const map = {};
  rows.forEach(r => { map[r.matrix_id] = r.verified; });
  return res.json(map);
});

// ── start ─────────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
