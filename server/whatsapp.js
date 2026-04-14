const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const pino = require('pino');
const db = require('./db');
const QRCode = require('qrcode');

// Map of academyId => socket instance
const sessions = new Map();
// Map of academyId => current QR code (data url)
const qrs = new Map();

/**
 * Custom Auth State for PostgreSQL (JSONB format)
 * This solves the Render FileSystem loss issue perfectly.
 */
async function usePostgresAuthState(academyId) {
  const { rows } = await db.query(`SELECT session_data FROM whatsapp_sessions WHERE academy_id=$1`, [academyId]);
  let data;
  if (rows[0] && rows[0].session_data) {
    // Re-stringify and parse to apply reviver perfectly
    data = JSON.parse(JSON.stringify(rows[0].session_data), BufferJSON.reviver);
  } else {
    data = { creds: initAuthCreds(), keys: {} };
  }

  // Throttled save function
  let saveTimeout;
  const saveToDbDelayed = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        const str = JSON.stringify(data, BufferJSON.replacer);
        await db.query(
          `INSERT INTO whatsapp_sessions (academy_id, session_data) VALUES ($1, $2::jsonb)
           ON CONFLICT (academy_id) DO UPDATE SET session_data=$2::jsonb, updated_at=NOW()`,
          [academyId, str]
        );
      } catch (e) {
        console.error(`[WA-${academyId}] DB Save Error:`, e.message);
      }
    }, 2000);
  };

  return {
    state: {
      creds: data.creds,
      keys: {
        get: (type, ids) => {
          const res = {};
          for (let id of ids) {
            let val = data.keys[`${type}-${id}`];
            if (val) {
              if (type === 'app-state-sync-key' && val) {
                // BufferJSON revives standard buffers, but app-state-sync-key needs special proto
                val = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(val);
              }
              res[id] = val;
            }
          }
          return res;
        },
        set: (keys) => {
          for (let type in keys) {
            for (let id in keys[type]) {
              let val = keys[type][id];
              if (val) data.keys[`${type}-${id}`] = val;
              else delete data.keys[`${type}-${id}`];
            }
          }
          saveToDbDelayed();
        }
      }
    },
    saveCreds: () => {
      saveToDbDelayed();
    }
  };
}

/**
 * Start or Retrieve a WhatsApp Session for an Academy
 */
async function startSession(academyId) {
  if (sessions.has(academyId)) return sessions.get(academyId);

  const { state, saveCreds } = await usePostgresAuthState(academyId);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }), // Set to info for debugging
    browser: ['Exponent Platform', 'Chrome', '1.0.0']
  });

  sessions.set(academyId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrs.set(academyId, await QRCode.toDataURL(qr));
    }

    if (connection === 'close') {
      qrs.delete(academyId);
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`[WA-${academyId}] Connection closed. Reconnecting:`, shouldReconnect);
      if (shouldReconnect) {
        sessions.delete(academyId);
        setTimeout(() => startSession(academyId), 3000);
      } else {
        // Logged out permanently
        sessions.delete(academyId);
        await db.query(`DELETE FROM whatsapp_sessions WHERE academy_id=$1`, [academyId]);
        console.log(`[WA-${academyId}] Logged out heavily, DB records wiped.`);
      }
    } else if (connection === 'open') {
      qrs.delete(academyId); // QR solved
      console.log(`[WA-${academyId}] Connection opened! Fully authenticated.`);
    }
  });

  return sock;
}

/**
 * Attempt to boot all existing authenticated academies on server start
 */
async function bootSavedSessions() {
  try {
    const { rows } = await db.query(`SELECT academy_id FROM whatsapp_sessions`);
    for (const r of rows) {
      console.log(`[WA-Boot] Initializing session for academy:`, r.academy_id);
      await startSession(r.academy_id);
    }
  } catch (e) {
    console.error("Failed to boot saved sessions:", e.message);
  }
}

/**
 * Triggered generic message sender wrapper
 */
async function sendWhatsAppMessage(academyId, phoneRaw, text) {
  try {
    const sock = await startSession(academyId);
    if (!sock?.user) throw new Error("Socket not authenticated");

    // Clean phone number (Indian format helper)
    let digits = phoneRaw.replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits; // Standardize India +91

    const jid = digits + '@s.whatsapp.net';
    const [result] = await sock.onWhatsApp(jid);
    
    if (result?.exists) {
      await sock.sendMessage(jid, { text });
      return true;
    }
    return false; // not on WA
  } catch (e) {
    console.error(`[WA-${academyId}] Failed to send message to ${phoneRaw}:`, e.message);
    return false;
  }
}

module.exports = {
  startSession,
  bootSavedSessions,
  sendWhatsAppMessage,
  sessions,
  qrs
};
