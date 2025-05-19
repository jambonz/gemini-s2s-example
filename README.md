# Google Speech-to-Speech Example

This is an example jambonz application that connects to Google's Gemini API and illustrates how to build a Voice-AI application using jambonz and Google's speech services.

## Authentication
You must have a Google API key that has access to the Gemini API. Specify it as an environment variable when starting the application.

```bash
GOOGLE_API_KEY="GEMINI LIVE API KEY" npm start
```

## Prerequisites
- Node.js (v14 or later)
- A Jambonz account
- Google Cloud Platform account with Gemini API access enabled

## How It Works
This application establishes a WebSocket connection between jambonz and Google's speech services. When a call comes in, the application:
1. Answers the call
2. Connects to Google's Gemini API 

## Configuration
All of the configuration can be found in the WebSocket handler file. This is where you'll want to make changes as you experiment with this example.

The application uses jambonz's WebSocket capabilities to create a bidirectional stream with Google's speech services. We specify the language model, voice parameters, and other Gemini-specific settings in the configuration.

## Function Calling
The example demonstrates how to implement custom functions that the AI can call during conversation. These functions can access external services, databases, or APIs to retrieve information requested by the user.

## Interruption Handling
When a user speaks while the assistant is talking (barge-in), the application detects this and can cancel the current response, allowing for more natural conversation flow.

## Events
The application handles various events from both jambonz and Google's API, including:
- Speech recognition events
- Text generation events
- Audio playback events
- Error handling events

## WebSocket Endpoint
When configuring your Jambonz application, point the WebSocket URL to:
```
wss://your-server-address/google-s2s
```

## Testing with MCP Server Tools

If you want to test with MCP server tools, you need to open two terminals:

In the first terminal, run:
```sh
MCP_SERVER_PORT=3001 npm run mcp-server
```

In the second terminal, run:
```sh
GOOGLE_API_KEY=<your key> MCP_SERVER_URL='http://<your server address>:3001/sse' node app.js
```

## Additional Resources
- [Jambonz Documentation](https://docs.jambonz.org/)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
