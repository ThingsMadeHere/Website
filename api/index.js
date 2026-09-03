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
      `INSERT OR IGNORE INTO site_users (device_id, matrix_id, username, verified)
       VALUES (?, ?, ?, 0)`,
      [device, matrix.user_id, cleaned]
    );

    console.log('User registered:', { device, matrix_id: matrix.user_id, username: cleaned });

    // Auto-join the team room
    const ROOM_ID = process.env.ROOM_ID || '!90VPR3Bd5d7Zi4lF:mchsrobotics.dev';
    try {
      const joinRes = await fetch(`${DENDRITE_URL}/_matrix/client/v3/join/${encodeURIComponent(ROOM_ID)}`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${matrix.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (!joinRes.ok) {
        const joinErr = await joinRes.json();
        console.error('Room join error during registration:', joinErr);
      } else {
        console.log('Successfully joined room during registration:', ROOM_ID);
      }
    } catch (joinErr) {
      console.error('Room join request failed during registration:', joinErr.message);
    }

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
      'SELECT verified, device_id FROM site_users WHERE matrix_id = ?',
      [matrix.user_id]
    );

    const ROOM_ID = process.env.ROOM_ID || '!90VPR3Bd5d7Zi4lF:mchsrobotics.dev';

    // If user exists in Matrix but not in our DB (e.g. admin-created), add them
    if (rows.length === 0) {
      const device = uuidv4();
      await pool.query(
        `INSERT OR IGNORE INTO site_users (device_id, matrix_id, username, verified)
         VALUES (?, ?, ?, 0)`,
        [device, matrix.user_id, username]
      );
      // Join room
      try {
        const joinRes = await fetch(`${DENDRITE_URL}/_matrix/client/v3/join/${encodeURIComponent(ROOM_ID)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${matrix.access_token}` },
          body: JSON.stringify({}),
        });
        if (!joinRes.ok) {
          const joinErr = await joinRes.json();
          console.error('Room join error for new user:', joinErr);
        } else {
          console.log('Successfully joined room for new user:', ROOM_ID);
        }
      } catch (joinErr) {
        console.error('Room join request failed for new user:', joinErr.message);
      }
      return res.json({
        userId:      matrix.user_id,
        accessToken: matrix.access_token,
        deviceId:    device,
        verified:    false,
      });
    }

    // Ensure existing users are in the room too
    try {
      const joinRes = await fetch(`${DENDRITE_URL}/_matrix/client/v3/join/${encodeURIComponent(ROOM_ID)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${matrix.access_token}` },
        body: JSON.stringify({}),
      });
      if (!joinRes.ok) {
        const joinErr = await joinRes.json();
        console.error('Room join error:', joinErr);
      } else {
        console.log('Successfully joined room:', ROOM_ID);
      }
    } catch (joinErr) {
      console.error('Room join request failed:', joinErr.message);
    }

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
    'UPDATE site_users SET verified = 1 WHERE matrix_id = ?',
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

// GET /api/events — returns all calendar events
app.get('/api/events', async (_, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM calendar_events ORDER BY date ASC');
    const events = rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      date: row.date,
      location: row.location || '',
      type: row.type || 'meeting',
      isMeeting: row.type === 'meeting'
    }));
    return res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /api/events — creates a new calendar event
app.post('/api/events', async (req, res) => {
  const { title, description, date, location, type } = req.body;
  
  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date are required' });
  }

  try {
    // Insert the event
    const result = await pool.query(
      `INSERT INTO calendar_events (title, description, date, location, type)
       VALUES (?, ?, ?, ?, ?)`,
      [title, description || '', date, location || '', type || 'meeting']
    );
    
    // Get the last inserted row
    const { rows } = await pool.query(
      'SELECT * FROM calendar_events WHERE id = last_insert_rowid()'
    );
    const event = rows[0];
    return res.json({
      id: event.id,
      title: event.title,
      description: event.description || '',
      date: event.date,
      location: event.location || '',
      type: event.type || 'meeting',
      isMeeting: event.type === 'meeting'
    });
  } catch (err) {
    console.error('Error creating event:', err);
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

// DELETE /api/events/:id — deletes a calendar event
app.delete('/api/events/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM calendar_events WHERE id = ?', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting event:', err);
    return res.status(500).json({ error: 'Failed to delete event' });
  }
});

// GET /api/events/:id/votes — returns votes for an event
app.get('/api/events/:id/votes', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rows } = await pool.query(
      'SELECT matrix_id, vote FROM event_votes WHERE event_id = ?',
      [id]
    );
    const votes = rows.reduce((acc, r) => {
      acc[r.matrix_id] = r.vote;
      return acc;
    }, {});
    return res.json({ votes });
  } catch (err) {
    console.error('Error fetching votes:', err);
    return res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// POST /api/events/:id/vote — votes on an event
app.post('/api/events/:id/vote', async (req, res) => {
  const { id } = req.params;
  const { matrix_id, vote } = req.body;
  
  if (!matrix_id || vote === undefined) {
    return res.status(400).json({ error: 'matrix_id and vote are required' });
  }
  
  try {
    // Insert or update vote
    await pool.query(
      `INSERT INTO event_votes (event_id, matrix_id, vote)
       VALUES (?, ?, ?)
       ON CONFLICT(event_id, matrix_id) DO UPDATE SET vote = ?`,
      [id, matrix_id, vote, vote]
    );
    
    // Calculate totals
    const { rows } = await pool.query(
      `SELECT 
        SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) as yes_votes,
        SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) as no_votes,
        COUNT(*) as total_votes
       FROM event_votes WHERE event_id = ?`,
      [id]
    );
    
    return res.json({ 
      event_id: id,
      yes_votes: rows[0].yes_votes,
      no_votes: rows[0].no_votes,
      total_votes: rows[0].total_votes
    });
  } catch (err) {
    console.error('Error voting on event:', err);
    return res.status(500).json({ error: 'Failed to vote' });
  }
});

// PUT /api/events/:id/approve — approve an event for calendar
app.put('/api/events/:id/approve', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get vote counts
    const { rows } = await pool.query(
      `SELECT 
        SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) as yes_votes,
        SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) as no_votes,
        COUNT(*) as total_votes
       FROM event_votes WHERE event_id = ?`,
      [id]
    );
    
    const eventVotes = rows[0];
    const totalVotes = eventVotes.total_votes;
    const yesVotes = eventVotes.yes_votes;
    const majority = totalVotes > 0 ? Math.floor(totalVotes / 2) + 1 : 0;
    
    // Approve if yes votes >= majority
    if (yesVotes >= majority) {
      await pool.query(
        'UPDATE calendar_events SET status = ? WHERE id = ?',
        ['approved', id]
      );
      return res.json({ success: true, approved: true, message: 'Event approved and added to calendar' });
    } else {
      return res.status(400).json({ 
        success: false, 
        approved: false, 
        message: `Needs ${majority} votes (currently has ${yesVotes})`
      });
    }
  } catch (err) {
    console.error('Error approving event:', err);
    return res.status(500).json({ error: 'Failed to approve event' });
  }
});

// ── Matrix API proxy ─────────────────────────────────────────────────────────
// Proxy Matrix client API calls to Dendrite to avoid external URL issues
app.all('/api/matrix/*', async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.status(200).end();
    return;
  }

  try {
    const matrixPath = req.path.replace('/api/matrix', '');
    const url = `${DENDRITE_URL}${matrixPath}`;
    
    const headers = {};
    // Copy relevant headers from the request
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers['user-agent']) {
      headers['User-Agent'] = req.headers['user-agent'];
    }
    if (req.headers.accept) {
      headers['Accept'] = req.headers.accept;
    }

    // Handle body properly - only stringify if it's an object
    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    console.log('Matrix proxy:', req.method, matrixPath);
    console.log('Matrix proxy URL:', url);
    console.log('Matrix proxy headers:', headers);
    console.log('Matrix proxy body:', body ? (typeof body === 'string' ? body.slice(0, 200) : 'object') : 'undefined');
    console.time('Matrix proxy fetch');
    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
    });
    const fetchTime = console.timeEnd('Matrix proxy fetch');
    console.log('Matrix proxy response status:', response.status);
    console.log('Matrix proxy response headers:', Object.fromEntries(response.headers.entries()));
    console.log('Matrix proxy fetch time:', fetchTime);
    
    const data = await response.text();
    console.log('Matrix proxy response body (first 500 chars):', data.slice(0, 500));
    
    // Copy response headers, but skip problematic ones and add CORS headers
    response.headers.forEach((value, key) => {
      // Skip Transfer-Encoding to avoid conflicts with Content-Length
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    res.status(response.status).send(data);
  } catch (err) {
    console.error('Matrix proxy error:', err.message, 'for path:', req.path);
    res.status(500).json({ error: 'Matrix proxy error' });
  }
});

// ── .well-known proxy ───────────────────────────────────────────────────────
// Proxy .well-known requests for Matrix client discovery
app.all('/.well-known/matrix/client', async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.status(200).end();
    return;
  }

  try {
    // Return Matrix client discovery config pointing to our proxy
    const host = req.headers.host || 'localhost:8888';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${host}/api/matrix`;
    
    const wellKnownConfig = {
      "m.homeserver": {
        "base_url": baseUrl
      }
    };
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Content-Type', 'application/json');
    res.json(wellKnownConfig);
  } catch (err) {
    console.error('Well-known proxy error:', err.message);
    res.status(500).json({ error: 'Well-known proxy error' });
  }
});

// ── start ─────────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
