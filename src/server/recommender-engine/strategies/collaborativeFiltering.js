/* eslint-disable max-len */
// Read https://buildingrecommenders.wordpress.com/2015/11/18/overview-of-recommender-algorithms-part-2/
// Watch https://www.youtube.com/watch?v=h9gpufJFF-0
// Read https://datascience.stackexchange.com/questions/2598/item-based-and-user-based-recommendation-difference-in-mahout

const math = require('mathjs');

const { getCosineSimilarityRowVector, sortByScore } = require('./common');

function getConditionalRating(value, primaryKey, secondaryKey) {
  if (!value[primaryKey]) {
    return 0;
  }

  if (!value[primaryKey][secondaryKey]) {
    return 0;
  }

  return value[primaryKey][secondaryKey].rating;
}

function getMatrices(ratingsGroupedByUser, ratingsGroupedByBook, uId) {
  const itemUser = Object.keys(ratingsGroupedByBook).reduce(
    (result, bookId) => {
      const rowVector = Object.keys(ratingsGroupedByUser).map((userId, userIndex) => {
        if (userId == uId) {
          result.userIndex = userIndex;
        }

        return getConditionalRating(ratingsGroupedByBook, bookId, userId);
      });

      result.matrix.push(rowVector);
      result.bookIds.push(bookId);

      return result;
    },
    { matrix: [], bookIds: [], userIndex: null }
  );

  const userItem = Object.keys(ratingsGroupedByUser).reduce(
    (result, userId, userIndex) => {
      const rowVector = Object.keys(ratingsGroupedByBook).map(bookId => getConditionalRating(ratingsGroupedByUser, userId, bookId));

      result.matrix.push(rowVector);

      if (userId == uId) {
        result.userIndex = userIndex;
      }

      return result;
    },
    { matrix: [], bookIds: Object.keys(ratingsGroupedByBook), userIndex: null }
  );

  return { itemUser, userItem };
}

function getMean(rowVector) {
  const valuesWithoutZeroes = rowVector.filter(cell => cell !== 0);
  return valuesWithoutZeroes.length ? math.mean(valuesWithoutZeroes) : 0;
}

function meanNormalizeByRowVector(matrix) {
  return matrix.map(rowVector => rowVector.map(cell => (cell !== 0 ? cell - getMean(rowVector) : cell)));
}

function getBookRatingsRowVector(userBasedMatrix, bookIndex) {
  return userBasedMatrix.map(userRatings => userRatings[bookIndex]);
}

function getPredictedRating(ratingsRowVector, cosineSimilarityRowVector) {
  const N = 5;
  const neighborSelection = cosineSimilarityRowVector
    // keep track of rating and similarity
    .map((similarity, index) => ({ similarity, rating: ratingsRowVector[index] }))
    // only neighbors with a rating
    .filter(value => value.rating !== 0)
    // most similar neighbors on top
    .sort((a, b) => b.similarity - a.similarity)
    // N neighbors
    .slice(0, N);

  const numerator = neighborSelection.reduce(
    (result, value) => result + value.similarity * value.rating,
    0
  );

  const denominator = neighborSelection.reduce(
    (result, value) => result + math.pow(value.similarity, 2),
    0
  );

  return numerator / math.sqrt(denominator);
}

function getUserRatingsRowVector(itemBasedMatrix, userIndex) {
  return itemBasedMatrix.map(itemRatings => itemRatings[userIndex]);
}

function predictWithCfUserBased(ratingsGroupedByUser, ratingsGroupedByBook, userId) {
  const { userItem } = getMatrices(ratingsGroupedByUser, ratingsGroupedByBook, userId);

  const { matrix, bookIds, userIndex } = userItem;

  const matrixNormalized = meanNormalizeByRowVector(matrix);
  const userRatingsRowVector = matrixNormalized[userIndex];

  const cosineSimilarityRowVector = getCosineSimilarityRowVector(matrixNormalized, userIndex);

  const predictedRatings = userRatingsRowVector.map((rating, bookIndex) => {
    const bookId = bookIds[bookIndex];

    const bookRatingsRowVector = getBookRatingsRowVector(matrixNormalized, bookIndex);

    let score;
    if (rating === 0) {
      score = getPredictedRating(bookRatingsRowVector, cosineSimilarityRowVector);
    } else {
      score = rating;
    }

    return { score, bookId };
  });

  return sortByScore(predictedRatings);
}

function predictWithCfItemBased(ratingsGroupedByUser, ratingsGroupedByBook, userId) {
  const { itemUser } = getMatrices(ratingsGroupedByUser, ratingsGroupedByBook, userId);
  const { matrix, bookIds, userIndex } = itemUser;

  const matrixNormalized = meanNormalizeByRowVector(matrix);
  const userRatingsRowVector = getUserRatingsRowVector(matrixNormalized, userIndex);

  const predictedRatings = userRatingsRowVector.map((rating, bookIndex) => {
    const bookId = bookIds[bookIndex];

    const cosineSimilarityRowVector = getCosineSimilarityRowVector(matrixNormalized, bookIndex);

    let score;
    if (rating === 0) {
      score = getPredictedRating(userRatingsRowVector, cosineSimilarityRowVector);
    } else {
      score = rating;
    }

    return { score, bookId };
  });

  return sortByScore(predictedRatings);
}

module.exports = { predictWithCfItemBased, predictWithCfUserBased, getMatrices };
