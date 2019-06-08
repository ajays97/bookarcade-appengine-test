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
const { WebhookClient } = require('dialogflow-fulfillment');

const { db } = require('../../../../../firebase');

routes.get('/', (req, res) => {
  res.status(200).send('hi from webhook...');
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
      const agent = new WebhookClient({ request: req, response: res });

      function similarBooks() {
        const contextParams = agent.context.get('book_description').parameters;
        const bookTitle = contextParams.bookTitle;
        const contentBasedRecommendation = predictWithContentBased(X, BOOKS_IN_LIST, bookTitle);
        agent.context.set({
          name: 'book_recommendations',
          lifespan: 1,
          parameters: {
            mode: 'CB',
            book: req.body.queryResult.parameters.book,
            bookTitle: contextParams.bookTitle,
            bookRating: contextParams.bookRating,
            books: sliceAndDice(contentBasedRecommendation, BOOKS_BY_ID, 10, true)
          }
        });
        agent.add(`Here are some books similar to ${agent.context.get('book_description').parameters.bookTitle}`);
      }

      function describeBook() {
        return db
          .collection('books')
          .doc(req.body.queryResult.parameters.book)
          .get()
          .then(doc => {
            if (!doc.exists) {
              agent.add("Sorry, we don't have that book in our library. Try looking for something else :)");
            } else {
              agent.context.set({
                name: 'book_description',
                lifespan: 5,
                parameters: {
                  book: req.body.queryResult.parameters.book,
                  bookTitle: doc.data()['title'],
                  bookRating: doc.data()['goodreads_rating']
                }
              });
              agent.add(`${doc.data()['short_description']}`);
            }
          })
          .catch(err => {
            agent.add('some error in the server');
            console.log(err);
          });
      }

      console.log(req.body);
      if (req.body.rectype === 'CB') {
        const contentBasedRecommendation = predictWithContentBased(X, BOOKS_IN_LIST, bookTitle);
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
      let intentMap = new Map();
      intentMap.set('describe_book', describeBook);
      intentMap.set('similar_books', similarBooks);

      agent.handleRequest(intentMap);
    });
  });

// routes.post('/', (req, res) => {
//   const agent = new WebhookClient({ request: req, response: res });
//   function describeBook() {
//     return db
//       .collection('books')
//       .doc(req.body.queryResult.parameters.book)
//       .get()
//       .then(doc => {
//         if (!doc.exists) {
//           agent.add("Sorry, we don't have that book in our library. Try looking for something else :)");
//         } else {
//           agent.context.set({
//             name: 'book_description',
//             lifespan: 5,
//             parameters: {
//               book: req.body.queryResult.parameters.book,
//               bookTitle: doc.data()['title'],
//               bookRating: doc.data()['goodreads_rating']
//             }
//           });
//           agent.add(`${doc.data()['short_description']}`);
//         }
//       })
//       .catch(err => {
//         agent.add('some error in the server');
//         console.log(err);
//       });
//   }

//   let intentMap = new Map();
//   intentMap.set('describe_book', describeBook);
//   agent.handleRequest(intentMap);
// });

module.exports = routes;
