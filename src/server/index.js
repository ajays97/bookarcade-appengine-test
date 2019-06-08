const express = require('express');
const bodyParser = require('body-parser');
const os = require('os');
const routes = require('./routes');

const app = express();

// require('./recommender-engine/index');

// app.use(express.static('dist'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use('/', routes);
// app.get('/', (req, res) => res.send({ username: os.userInfo().username }));

app.listen(process.env.PORT || 8080, () => console.log(`Listening on port ${process.env.PORT || 8080}!`));
