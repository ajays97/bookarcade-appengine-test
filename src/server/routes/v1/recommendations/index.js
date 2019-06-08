const routes = require('express').Router();
const { sliceAndDice } = require('../../../recommender-engine/index');
const { prepareBooks } = require('../../../recommender-engine/preparation/books');
const { predictWithContentBased } = require('../../../recommender-engine/strategies/contentBased');
const { predictWithLinearRegression } = require('../../../recommender-engine/strategies/linearRegression');
const {
  predictWithCfUserBased,
  predictWithCfItemBased
} = require('../../../recommender-engine/strategies/collaborativeFiltering');
const { prepareRatings } = require('../../../recommender-engine/preparation/ratings');
const { db } = require('../../../../../firebase');

routes.get('/:bookid', (req, res) => {
  res.status(200).send({
    message: `fetching recommendations for book ${req.params.bookid}, please wait...`
  });
});

db.collection('books')
  .get()
  .then(snapshot => {
    let books = [];
    snapshot.forEach(doc => {
      let book = { ...doc.data() };
      books.push(book);
    });

    const { BOOKS_BY_ID, BOOKS_IN_LIST, X } = prepareBooks(books, books);

    routes.post('/', (req, res) => {
      console.log(req.body);
      if (req.body.rectype === 'CB') {
        const contentBasedRecommendation = predictWithContentBased(X, BOOKS_IN_LIST, req.body.title);
        res.status(200).send(sliceAndDice(contentBasedRecommendation, BOOKS_BY_ID, 10, true));
      } else if (req.body.rectype === 'LIN') {
        const ME_USER_ID = req.body.userId;
        const ME_USER_EMAIL = req.body.userEmail;

        // Fetch user submitted book ratings
        db.collection('ratings')
          .get()
          .then(snapshot => {
            let ratings = [];
            snapshot.forEach(doc => {
              let rating = { ...doc.data() };
              ratings.push(rating);
            });

            let ME_USER_RATINGS = ratings.filter(rating => {
              return rating['user_email'] === ME_USER_EMAIL;
            });

            console.log('ME_USER_RATINGS:', ME_USER_RATINGS);

            const { ratingsGroupedByUser, ratingsGroupedByBook } = prepareRatings([...ME_USER_RATINGS, ...ratings]);
            const meUserRatings = ratingsGroupedByUser[ME_USER_ID];
            const linearRegressionBasedRecommendation = predictWithLinearRegression(X, BOOKS_IN_LIST, meUserRatings);
            res.send(sliceAndDice(linearRegressionBasedRecommendation, BOOKS_BY_ID, 10, true));
          });
      } else if (req.body.rectype === 'ICF') {
        const ME_USER_ID = req.body.userId;
        const ME_USER_EMAIL = req.body.userEmail;

        let ratings = [];

        db.collection('ratings')
          .get()
          .then(snapshot => {
            snapshot.forEach(doc => {
              let rating = { ...doc.data() };
              ratings.push(rating);
            });

            let ME_USER_RATINGS = ratings.filter(rating => {
              return rating['user_email'] === ME_USER_EMAIL;
            });

            const { ratingsGroupedByUser, ratingsGroupedByBook } = prepareRatings([...ME_USER_RATINGS, ...ratings]);
            const cfItemBasedRecommendation = predictWithCfItemBased(
              ratingsGroupedByUser,
              ratingsGroupedByBook,
              ME_USER_ID
            );

            res.send(sliceAndDice(cfItemBasedRecommendation, BOOKS_BY_ID, 10, true));
          });
      } else if (req.body.rectype === 'UCF') {
        const ME_USER_ID = req.body.userId;
        const ME_USER_EMAIL = req.body.userEmail;

        let ratings = [];

        db.collection('ratings')
          .get()
          .then(snapshot => {
            snapshot.forEach(doc => {
              let rating = { ...doc.data() };
              ratings.push(rating);
            });

            let ME_USER_RATINGS = ratings.filter(rating => {
              return rating['user_email'] === ME_USER_EMAIL;
            });

            const { ratingsGroupedByUser, ratingsGroupedByBook } = prepareRatings([...ME_USER_RATINGS, ...ratings]);
            console.log('ratingsGroupedByUser:', ratingsGroupedByUser);
            console.log('ratingsGroupedByBook:', ratingsGroupedByBook);
            const cfUserBasedRecommendation = predictWithCfUserBased(
              ratingsGroupedByUser,
              ratingsGroupedByBook,
              ME_USER_ID
            );

            res.send(sliceAndDice(cfUserBasedRecommendation, BOOKS_BY_ID, 10, true));
          });
      }
    });
  });

module.exports = routes;
