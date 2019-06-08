const routes = require('express').Router();
const v1 = require('./v1');

routes.get('/', (req, res) => {
    res.status(200).json({
        message: 'Connected to Home Router'
    });
});

routes.use('/api/v1', v1);

module.exports = routes;