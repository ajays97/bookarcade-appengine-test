const { getCosineSimilarityRowVector, sortByScore, getBookIndexByTitle } = require('./common');

function predictWithContentBased(X, BOOKS_IN_LIST, title) {
  const { index } = getBookIndexByTitle(BOOKS_IN_LIST, title);

  // Compute similarities based on input book
  const cosineSimilarityRowVector = getCosineSimilarityRowVector(X, index);

  // Enrich the vector to convey all information
  // Use references from before which we kept track of
  const contentBasedRecommendation = cosineSimilarityRowVector.map((value, key) => ({
    score: value,
    bookId: BOOKS_IN_LIST[key]['book_id']
  }));

  return sortByScore(contentBasedRecommendation);
}

module.exports = { predictWithContentBased };
