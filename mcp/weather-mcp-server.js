const {McpServer} = require('@modelcontextprotocol/sdk/server/mcp.js');
const {SSEServerTransport} = require('@modelcontextprotocol/sdk/server/sse.js');
const {z} = require('zod');
const { getWeather } = require('../lib/utils/index.js');
const logger = require('pino')({level: process.env.LOGLEVEL || 'info'});
const express = require('express');

const port = process.env.MCP_SERVER_PORT || 3001;


// Create server instance
const server = new McpServer({
  name: "weather",
  version: "1.0.0",
});


server.tool(
  "get_weather",
  "Get weather data for a location",
  {
    location: z.string().describe("Location to get weather data for"),
  },
  async({location}) => {
    logger.info(`Getting weather for location: ${location}`);
    const resp = await getWeather(location, 'celsius', logger);
    const {current_units, current} = resp;
    return {
      content: [
        {
          type: "text",
          text: `The current temperature in ${location} is ${current.temperature_2m} ${current_units.temperature_2m} wind is ${current.wind_speed_10m} ${current_units.wind_speed_10m}.`,
        }
      ]
    }
  }
)

const app = express();
let transport;
app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

app.listen(port).on('listening', () => {
  logger.info(`Server listening on port ${port}`);
}
);
