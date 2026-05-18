module.exports = ({logger, makeService}) => {
  require('./weather-agent')({logger, makeService});
  require('./weather-agent-vertex')({logger, makeService});
};
