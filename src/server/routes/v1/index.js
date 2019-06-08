const routes = require('express').Router();
const recommendations = require('./recommendations');
const webhooks = require('./webhooks');

routes.use('/recommendations', recommendations);
routes.use('/webhooks', webhooks);

routes.get('/', (req, res) => {
  res.status(200).send({
    msg: 'Hi from v1 API'
  });
});

module.exports = routes;
