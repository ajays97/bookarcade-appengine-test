/* eslint-disable no-plusplus */
/* eslint-disable no-unused-vars */

const math = require('mathjs');

const { sortByScore } = require('./common');

const LEARNING_RATE = 0.03;
const LEARNING_ITERATIONS = 750;

function computeCost(X, y, theta) {
  const m = y.length;

  const predictions = math.eval('X * theta', {
    X,
    theta
  });

  const sqrErrors = math.eval('(predictions - y).^2', {
    predictions,
    y
  });

  const J = math.eval('1 / (2 * m) * sum(sqrErrors)', {
    m,
    sqrErrors
  });

  return J;
}

function gradientDescent(X, y, theta, ALPHA, ITERATIONS) {
  const m = y.length;

  for (let i = 0; i < ITERATIONS; i++) {
    theta = math.eval("theta - ALPHA / m * ((X * theta - y)' * X)'", {
      theta,
      ALPHA,
      m,
      X,
      y
    });

    if (i % 50 === 0) {
      const cost = computeCost(X, y, theta);
      console.log(`Cost after ${i} of trained ${ITERATIONS}: ${cost}`);
    }
  }
  console.log('\n');

  return theta;
}

function getPredictedRatings(theta, X) {
  return math.eval('X * theta', {
    theta,
    X
  });
}

function predictWithLinearRegression(X, BOOKS_IN_LIST, ratings) {
  // Add intercept term
  const ones = Array(X.length)
    .fill()
    .map((v, i) => [1]);
  X = math.concat(ones, X);

  const init = {
    training: {
      X: [],
      y: []
    },
    // Not a real test set
    // Because of missing labels
    test: {
      X: [],
      references: []
    }
  };

  // Prepare training and test set
  const { training, test } = BOOKS_IN_LIST.reduce((result, book, key) => {
    console.log('Ratings:', ratings);
    const hasRatedBook = !!ratings[book['book_id']];
    if (hasRatedBook) {
      result.training.X.push(X[key]);
      result.training.y.push([ratings[book['book_id']].rating]);
    } else {
      result.test.X.push(X[key]);
      // Keep a reference to map the predictions later to books
      result.test.references.push(book.id);
    }

    return result;
  }, init);

  // Train theta paramaters
  const m = training.X[0].length;
  let theta = Array(m)
    .fill()
    .map((v, i) => [0]);
  theta = gradientDescent(training.X, training.y, theta, LEARNING_RATE, LEARNING_ITERATIONS);

  // Predict all ratings
  let predictedRatings = getPredictedRatings(theta, test.X);

  // Enrich the vector to convey all information
  // Use references from before which we kept track of
  predictedRatings = predictedRatings.map((rating, key) => ({
    score: rating[0],
    bookId: test.references[key]
  }));

  return sortByScore(predictedRatings);
}

module.exports = {
  predictWithLinearRegression,
  getPredictedRatings,
  gradientDescent,
  computeCost
};
