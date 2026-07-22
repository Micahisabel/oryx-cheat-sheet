const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

const SLACK_WEBHOOK_URL = defineSecret('SLACK_WEBHOOK_URL');

exports.notifySlackOnSuggestion = onDocumentCreated(
  { document: 'suggestions/{suggestionId}', secrets: [SLACK_WEBHOOK_URL] },
  async (event) => {
    const s = event.data.data();

    const payload = {
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*New request — pending review*\n*${s.title || 'Untitled'}*` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Requested by:*\n${s.name || 'Anonymous'}` },
          { type: 'mrkdwn', text: `*Platform:*\n${s.platform || 'n/a'}` },
          { type: 'mrkdwn', text: `*Type:*\n${s.type || 'n/a'}` }
        ]},
        { type: 'section', text: { type: 'mrkdwn', text: s.text || '' } }
      ]
    };

    try {
      const res = await fetch(SLACK_WEBHOOK_URL.value(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        logger.error('Slack webhook responded with an error', res.status, await res.text());
      }
    } catch (err) {
      logger.error('Failed to notify Slack', err);
    }
  }
);
