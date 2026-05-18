/**
 * Vertex AI Live API route — uses an OAuth access token minted from a
 * service-account JSON key. mod_google_s2s detects the `ya29.` prefix
 * and sends it as `Authorization: Bearer …` on the WS upgrade.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_KEY_PATH — path to service-account JSON
 *
 * Optional env vars:
 *   VERTEX_PROJECT_ID  — override project from JSON's project_id
 *   VERTEX_LOCATION    — region (default: us-central1)
 *   VERTEX_MODEL       — model name (default: gemini-live-2.5-flash-native-audio)
 *
 * Host auto-derives from VERTEX_LOCATION: {LOCATION}-aiplatform.googleapis.com
 */

const fs = require('fs');
const {JWT} = require('google-auth-library');

const {attachHandlers, buildSetup, GREETING} = require('./weather-shared');

const SA_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const MODEL_NAME = process.env.VERTEX_MODEL || 'gemini-live-2.5-flash-native-audio';

// Lazy-init JWT client + cached project_id from the same JSON.
let jwtClient = null;
let projectIdFromKey = null;
function loadCreds() {
  if (jwtClient) return;
  if (!SA_KEY_PATH) return;
  const saKey = JSON.parse(fs.readFileSync(SA_KEY_PATH, 'utf8'));
  jwtClient = new JWT({
    email: saKey.client_email,
    key: saKey.private_key,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  projectIdFromKey = saKey.project_id;
}

async function getAccessToken() {
  loadCreds();
  if (!jwtClient) return null;
  const {token} = await jwtClient.getAccessToken();
  return token;
}

function getProjectId() {
  loadCreds();
  return process.env.VERTEX_PROJECT_ID || projectIdFromKey;
}

const service = ({logger: parentLogger, makeService}) => {
  const svc = makeService({path: '/vertex-s2s'});

  svc.on('session:new', async (session, path) => {
    const logger = parentLogger.child({call_sid: session.call_sid});
    logger.info({session, path}, `new incoming call: ${session.call_sid}`);
    session.locals.logger = logger;

    attachHandlers(session);

    if (!SA_KEY_PATH) {
      logger.warn('GOOGLE_SERVICE_ACCOUNT_KEY_PATH env var not set, hanging up');
      session.hangup().send();
      return;
    }

    let apiKey;
    try {
      apiKey = await getAccessToken();
    } catch (err) {
      logger.error({err}, 'failed to mint Vertex access token');
    }
    if (!apiKey) {
      session.hangup().send();
      return;
    }

    const projectId = getProjectId();
    if (!projectId) {
      logger.error('no project_id found in service-account JSON and VERTEX_PROJECT_ID not set');
      session.hangup().send();
      return;
    }

    const model = `projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}`;
    const host = `${LOCATION}-aiplatform.googleapis.com`;

    session
      .answer()
      .pause({length: 1})
      .llm({
        vendor: 'google',
        model,
        auth: {apiKey},
        actionHook: '/final',
        eventHook: '/event',
        toolHook: '/toolCall',
        ...(process.env.MCP_SERVER_URL && {
          mcpServers: [{url: process.env.MCP_SERVER_URL}]
        }),
        connectOptions: {
          host,
          path: '/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent'
        },
        llmOptions: {
          setup: buildSetup(model),
          greeting: GREETING
        }
      })
      .hangup()
      .send();
  });
};

module.exports = service;
