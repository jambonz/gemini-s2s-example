/**
 * Shared bits between the Gemini Developer and Vertex AI Live API routes:
 * tool definition, tool-call handler, session lifecycle handlers, and the
 * `llmOptions.setup` builder.
 *
 * Routes differ only in vendor endpoint + auth — everything below is identical.
 */

const { getWeather } = require("../utils");

const SYSTEM_INSTRUCTION =
  'You are a helpful agent named Barbara that can only provide weather information. ' +
  'Help the user with their query.';

const GREETING = 'Greet the caller warmly and ask how you can help.';

const WEATHER_TOOL = {
  functionDeclarations: [{
    name: 'get_weather',
    description: 'Get the weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {type: 'string', description: 'The location to get the weather for'},
        scale: {type: 'string', enum: ['celsius', 'fahrenheit'], description: 'The scale to use for the temperature'}
      },
      required: ['location']
    }
  }]
};

function buildSetup(model) {
  return {
    model,
    generationConfig: {
      speechConfig: {
        voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Aoede'}}
      }
    },
    systemInstruction: {parts: [{text: SYSTEM_INSTRUCTION}]},
    ...(!process.env.MCP_SERVER_URL && {tools: [WEATHER_TOOL]})
  };
}

async function onToolCall(session, evt) {
  const {logger} = session.locals;
  logger.info({evt}, 'got toolHook');
  const {function_calls, tool_call_id} = evt;

  const functionResponses = [];
  for (const fn of function_calls) {
    const {name, args, id} = fn;
    if (name === 'get_weather') {
      try {
        const {location, scale = 'celsius'} = args;
        const weather = await getWeather(location, scale, logger);
        logger.info({weather}, 'got response from weather API');
        functionResponses.push({response: {output: weather}, id});
      } catch (err) {
        functionResponses.push({
          response: {output: {text: `Failed to get the weather for ${args.location}. Please try again later.`}},
          id
        });
      }
    } else {
      functionResponses.push({response: {text: 'ok'}, id});
    }
  }

  session.sendToolOutput(tool_call_id, {toolResponse: {functionResponses}});
}

async function onFinal(session, evt) {
  const {logger} = session.locals;
  logger.info(`got actionHook: ${JSON.stringify(evt)}`);
  session.say({text: 'Sorry, your session has ended.'}).hangup().reply();
}

async function onEvent(session, evt) {
  const {logger} = session.locals;
  logger.info(`got eventHook: ${JSON.stringify(evt)}`);
}

function onClose(session, code, reason) {
  const {logger} = session.locals;
  logger.info({code, reason}, `session ${session.call_sid} closed`);
}

function onError(session, err) {
  const {logger} = session.locals;
  logger.error({err}, `session ${session.call_sid} received error`);
}

function attachHandlers(session) {
  session
    .on('/event', onEvent.bind(null, session))
    .on('/toolCall', onToolCall.bind(null, session))
    .on('/final', onFinal.bind(null, session))
    .on('close', onClose.bind(null, session))
    .on('error', onError.bind(null, session));
}

module.exports = {
  buildSetup,
  attachHandlers,
  GREETING,
  WEATHER_TOOL,
};
