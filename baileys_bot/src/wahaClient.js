// WAHA HTTP Client - Communicates with WAHA WhatsApp API
// Used by whatsappSender.js and conversationController.js to send messages and manage sessions

const wahaUrl = process.env.WAHA_URL || 'https://vv-ddas.v8b0on.easypanel.host';
const wahaApiKey = process.env.WAHA_API_KEY || '7dcbe043adf54656bd7ac2c3f94c7292';

/**
 * Send a text message via WAHA API
 * @param {string} sessionName - WhatsApp session name (e.g., 'default')
 * @param {string} to - Recipient phone number (with country code, e.g., '5511999999999')
 * @param {string} text - Message text to send
 * @returns {Promise<Object>} WAHA API response
 * @throws {Error} If API request fails
 */
async function sendMessage(sessionName, to, text) {
  try {
    const response = await fetch(`${wahaUrl}/api/${sessionName}/messages/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': wahaApiKey,
      },
      body: JSON.stringify({
        to: to,
        text: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`WAHA API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('[WAHA] sendMessage error:', error);
    throw error;
  }
}

/**
 * Get status of a specific WhatsApp session
 * @param {string} sessionName - WhatsApp session name
 * @returns {Promise<Object>} Session status from WAHA API
 * @throws {Error} If API request fails
 */
async function getSessionStatus(sessionName) {
  try {
    const response = await fetch(`${wahaUrl}/api/${sessionName}`, {
      headers: { 'X-API-Key': wahaApiKey },
    });

    if (!response.ok) {
      throw new Error(`WAHA API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('[WAHA] getSessionStatus error:', error);
    throw error;
  }
}

/**
 * Get all WhatsApp sessions
 * @returns {Promise<Array>} List of sessions from WAHA API
 * @throws {Error} If API request fails
 */
async function getSessions() {
  try {
    const response = await fetch(`${wahaUrl}/api/sessions`, {
      headers: { 'X-API-Key': wahaApiKey },
    });

    if (!response.ok) {
      throw new Error(`WAHA API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('[WAHA] getSessions error:', error);
    throw error;
  }
}

/**
 * Send a message with a file/media
 * @param {string} sessionName - WhatsApp session name
 * @param {string} to - Recipient phone number
 * @param {string} fileUrl - URL of the file to send
 * @param {string} caption - Optional caption for the file
 * @returns {Promise<Object>} WAHA API response
 * @throws {Error} If API request fails
 */
async function sendMedia(sessionName, to, fileUrl, caption = '') {
  try {
    const response = await fetch(`${wahaUrl}/api/${sessionName}/messages/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': wahaApiKey,
      },
      body: JSON.stringify({
        to: to,
        media: {
          url: fileUrl,
        },
        caption: caption,
      }),
    });

    if (!response.ok) {
      throw new Error(`WAHA API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('[WAHA] sendMedia error:', error);
    throw error;
  }
}

module.exports = {
  sendMessage,
  getSessionStatus,
  getSessions,
  sendMedia,
};
