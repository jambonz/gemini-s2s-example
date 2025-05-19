const { text } = require("express");
const { getWeather } = require("../utils");

const service = ({logger: parrentLogger, makeService}) => {
  const svc = makeService({path: '/google-s2s'});

  svc.on('session:new', (session, path) => {
    const logger = parrentLogger.child({call_sid: session.call_sid});
    logger.info({session, path}, `new incoming call: ${session.call_sid}`);
    session.locals.logger = logger;

    const apiKey = process.env.GOOGLE_API_KEY;

    session
      .on('/event', onEvent.bind(null, session))
      .on('/toolCall', onToolCall.bind(null, session))
      .on('/final', onFinal.bind(null, session))
      .on('close', onClose.bind(null, session))
      .on('error', onError.bind(null, session));


      if (!apiKey) {
        session.locals.logger.info('missing env GOOGLE_API_KEY, hanging up');
        session
          .hangup()
          .send();

        return;
      }

      session
        .answer()
        .pause({length: 1})
        .llm({
          vendor: 'google',
          model: 'models/gemini-2.0-flash-live-001',
          auth: {
            apiKey
          },
          actionHook: '/final',
          eventHook: '/event',
          toolHook: '/toolCall',
          ...(process.env.MCP_SERVER_URL && {
            mcpServers: [
              {
                url: process.env.MCP_SERVER_URL,
              }
            ]
          }),
          llmOptions: {
            setup: {
              generationConfig: {
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: 'Aoede'
                    }
                  }
                }
              },
              systemInstruction: {
                parts: [
                  {
                    text: 'You are a helpful agent named Barbara that can only provide weather information. Help the user with their query.',
                  }
                ]
              },
              ...(!process.env.MCP_SERVER_URL && {
                tools: [
                  {
                    functionDeclarations: [
                      {
                        name: 'get_weather',
                        description: 'Get the weather for a location',
                        parameters: {
                          type: 'object',
                          properties: {
                            location: {
                              type: 'string',
                              description: 'The location to get the weather for'
                            },
                            scale: {
                              type: 'string',
                              enum: ['celsius', 'fahrenheit'],
                              description: 'The scale to use for the temperature'
                            }
                          },
                          required: ['location']
                        }
                      }
                    ]
                  }
                ]
              })
            }
          }
        })
        .hangup()
        .send();
  });
}

const onToolCall = async(session, evt) => {
  const {logger} = session.locals;

  logger.info({evt}, `got toolHook `);
  const {function_calls, tool_call_id} = evt;
  
  const functionResponses = [];
  for (const functionCall of function_calls) {
    const {name, args, id} = functionCall;
    if (name === 'get_weather') {
      try {
        const {location, scale = 'celsius'} = args;
        const weather = await getWeather(location, scale, logger);
        logger.info({weather}, 'got response from weather API');
        functionResponses.push({
          response: {
            output: weather,
          },
          id,
        });
      } catch (err) {
        functionResponses.push( {
          response: {
            output: {
              text: `Failed to get the weather for ${location}. Please try again later.`,
            },
          },
          id,
        });
      }
    } else {
      functionResponses.push( {
        response: {
          text: 'ok',
        },
        id,
      });
    }
  }

  session.sendToolOutput(tool_call_id, {
    toolResponse: {
      functionResponses,
  }});
};

const onFinal = async(session, evt) => {
  const {logger} = session.locals;
  logger.info(`got actionHook: ${JSON.stringify(evt)}`);
   
  session
    .say({text: 'Sorry, your session has ended.'})
    .hangup()
    .reply();
};

const onEvent = async(session, evt) => {
  const {logger} = session.locals;
  logger.info(`got eventHook: ${JSON.stringify(evt)}`);
};

const onClose = (session, code, reason) => {
  const {logger} = session.locals;
  logger.info({code, reason}, `session ${session.call_sid} closed`);
};

const onError = (session, err) => {
  const {logger} = session.locals;
  logger.error({err}, `session ${session.call_sid} received error`);
};


module.exports = service;