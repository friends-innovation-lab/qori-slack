// middleware/cache.js

const redisClient = require("../libs/redis");

module.exports = function(cache, evalString = null) {
  return (req, res, next) => {
    let cacheName = cache;
    if (evalString) {
      // evaluate the expression in the context of req
      cacheName += `:${eval(evalString)}`;
    }

    req.cacheName = cacheName;

    if (redisClient.connected) {
      return redisClient.get(cacheName, (err, data) => {
        if (err) {
          return res.status(500).send(err);
        }
        if (data !== null) {
          const parsedData = JSON.parse(data);
          return res.status(200).send(parsedData);
        }
        return next();
      });
    }

    return next();
  };
};
