/**
 * Gemini Developer API route — uses an API key from AI Studio.
 * Endpoint defaults (host, path) come from feature-server / mod_google_s2s.
 */

const {attachHandlers, buildSetup, GREETING} = require('./weather-shared');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-3.1-flash-live-preview';

const service = ({logger: parentLogger, makeService}) => {
  const svc = makeService({path: '/google-s2s'});

  svc.on('session:new', (session, path) => {
    const logger = parentLogger.child({call_sid: session.call_sid});
    logger.info({session, path}, `new incoming call: ${session.call_sid}`);
    session.locals.logger = logger;

    attachHandlers(session);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY env var not set, hanging up');
      session.hangup().send();
      return;
    }

    session
      .answer()
      .pause({length: 1})
      .llm({
        vendor: 'google',
        model: GEMINI_MODEL,
        auth: {apiKey},
        actionHook: '/final',
        eventHook: '/event',
        toolHook: '/toolCall',
        ...(process.env.MCP_SERVER_URL && {
          mcpServers: [{url: process.env.MCP_SERVER_URL}]
        }),
        llmOptions: {
          setup: buildSetup(GEMINI_MODEL),
          greeting: GREETING
        }
      })
      .hangup()
      .send();
  });
};

module.exports = service;
