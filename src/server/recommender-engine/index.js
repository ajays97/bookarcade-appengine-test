/* eslint-disable no-eval */
/* eslint-disable no-use-before-define */

const fs = require('fs');
const csv = require('fast-csv');

const { prepareRatings } = require('./preparation/ratings');
const { prepareBooks } = require('./preparation/books');
const { predictWithLinearRegression } = require('./strategies/linearRegression');
const { predictWithContentBased } = require('./strategies/contentBased');
const { predictWithCfUserBased, predictWithCfItemBased } = require('./strategies/collaborativeFiltering');
const { getBookIndexByTitle } = require('./strategies/common');

const BOOKS_META_DATA = {};
const BOOKS_KEYWORDS = {};
const RATINGS = [];

const ME_USER_ID = 0;

function softEval(string, escape) {
  if (!string) {
    return escape;
  }

  try {
    return eval(string);
  } catch (e) {
    return escape;
  }
}

function fromKeywordsFile(row) {
  BOOKS_KEYWORDS[row.id] = {
    keywords: softEval(row.keywords, [])
  };
}

function fromRatingsFile(row) {
  RATINGS.push(row);
}

function fromMetaDataFile(row) {
  BOOKS_META_DATA[row.id] = {
    id: row.id,
    adult: row.adult,
    genres: softEval(row.genres, []),
    homepage: row.homepage,
    language: row.original_language,
    title: row.original_title,
    overview: row.overview,
    popularity: row.popularity,
    studio: softEval(row.production_companies, []),
    release: row.release_date,
    revenue: row.revenue,
    runtime: row.runtime,
    voteAverage: row.vote_average,
    voteCount: row.vote_count
  };
}

console.log('Unloading data from files ... \n');

// Promise.all([booksMetaDataPromise, booksKeywordsPromise, ratingsPromise]).then(init);

function init([booksMetaData, booksKeywords, ratings]) {
  /* ------------ */
  //  Preparation //
  /* -------------*/

  const { BOOKS_BY_ID, BOOKS_IN_LIST, X } = prepareBooks(booksMetaData, booksKeywords);

  const ME_USER_RATINGS = [
    addUserRating(ME_USER_ID, 'Terminator 3: Rise of the Machines', '5.0', BOOKS_IN_LIST),
    addUserRating(ME_USER_ID, 'Jarhead', '4.0', BOOKS_IN_LIST),
    addUserRating(ME_USER_ID, 'Back to the Future Part II', '3.0', BOOKS_IN_LIST),
    addUserRating(ME_USER_ID, 'Jurassic Park', '4.0', BOOKS_IN_LIST),
    addUserRating(ME_USER_ID, 'Reservoir Dogs', '3.0', BOOKS_IN_LIST),
    addUserRating(ME_USER_ID, 'Men in Black II', '3.0', BOOKS_IN_LIST),
    addUserRating(ME_USER_ID, 'Bad Boys II', '5.0', BOOKS_IN_LIST),
    addUserRating(ME_USER_ID, 'Sissi', '1.0', BOOKS_IN_LIST),
    addUserRating(ME_USER_ID, 'Titanic', '1.0', BOOKS_IN_LIST)
  ];

  const { ratingsGroupedByUser, ratingsGroupedByBook } = prepareRatings([...ME_USER_RATINGS, ...ratings]);

  /* ----------------------------- */
  //  Linear Regression Prediction //
  //        Gradient Descent       //
  /* ----------------------------- */

  console.log('\n');
  console.log('(A) Linear Regression Prediction ... \n');

  console.log('(1) Training \n');
  const meUserRatings = ratingsGroupedByUser[ME_USER_ID];
  const linearRegressionBasedRecommendation = predictWithLinearRegression(X, BOOKS_IN_LIST, meUserRatings);

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(linearRegressionBasedRecommendation, BOOKS_BY_ID, 10, true));

  /* ------------------------- */
  //  Content-Based Prediction //
  //  Cosine Similarity Matrix //
  /* ------------------------- */

  console.log('\n');
  console.log('(B) Content-Based Prediction ... \n');

  console.log('(1) Computing Cosine Similarity \n');
  const title = 'Batman Begins';
  const contentBasedRecommendation = predictWithContentBased(X, BOOKS_IN_LIST, title);

  console.log(`(2) Prediction based on "${title}" \n`);
  console.log(sliceAndDice(contentBasedRecommendation, BOOKS_BY_ID, 10, true));

  /* ----------------------------------- */
  //  Collaborative-Filtering Prediction //
  //             User-Based              //
  /* ----------------------------------- */

  console.log('\n');
  console.log('(C) Collaborative-Filtering (User-Based) Prediction ... \n');

  console.log('(1) Computing User-Based Cosine Similarity \n');
  const cfUserBasedRecommendation = predictWithCfUserBased(ratingsGroupedByUser, ratingsGroupedByBook, ME_USER_ID);

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(cfUserBasedRecommendation, BOOKS_BY_ID, 10, true));

  /* ----------------------------------- */
  //  Collaborative-Filtering Prediction //
  //             Item-Based              //
  /* ----------------------------------- */

  console.log('\n');
  console.log('(C) Collaborative-Filtering (Item-Based) Prediction ... \n');

  console.log('(1) Computing Item-Based Cosine Similarity \n');

  const cfItemBasedRecommendation = predictWithCfItemBased(ratingsGroupedByUser, ratingsGroupedByBook, ME_USER_ID);

  console.log('(2) Prediction \n');
  console.log(sliceAndDice(cfItemBasedRecommendation, BOOKS_BY_ID, 10, true));

  console.log('\n');
  console.log('End ...');
}

function sliceAndDice(recommendations, BOOKS_BY_ID, count, onlyTitle) {
  recommendations = recommendations.filter(recommendation => BOOKS_BY_ID[recommendation.bookId]);

  recommendations = onlyTitle
    ? recommendations.map(mr => ({
        title: BOOKS_BY_ID[mr.bookId].title,
        score: mr.score,
        bookId: BOOKS_BY_ID[mr.bookId]['book_id'],
        authorName: BOOKS_BY_ID[mr.bookId]['author_name'],
        amazonPrice: BOOKS_BY_ID[mr.bookId]['amazon_price'],
        imageUrl: BOOKS_BY_ID[mr.bookId]['s_image_url'],
        authorId: BOOKS_BY_ID[mr.bookId]['author_id']
      }))
    : recommendations.map(mr => ({ book: BOOKS_BY_ID[mr.bookId], score: mr.score }));

  return recommendations.slice(0, count);
}

function addUserRating(userId, searchTitle, rating, BOOKS_IN_LIST) {
  const { id, title } = getBookIndexByTitle(BOOKS_IN_LIST, searchTitle);

  return {
    userId,
    rating,
    bookId: id,
    title
  };
}

module.exports = { addUserRating, sliceAndDice, softEval };
