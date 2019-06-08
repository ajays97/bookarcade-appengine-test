const similarity = require('compute-cosine-similarity');

function sortByScore(recommendation) {
  return recommendation.sort((a, b) => b.score - a.score);
}

// X x 1 row vector based on similarities of books
// 1 equals similar, -1 equals not similar, 0 equals orthogonal
// Whole matrix is too computational expensive for 45.000 books
// https://en.wikipedia.org/wiki/Cosine_similarity
function getCosineSimilarityRowVector(matrix, index) {
  return matrix.map((rowRelative, i) => similarity(matrix[index], matrix[i]));
}

function getBookIndexByTitle(BOOKS_IN_LIST, query) {
  const index = BOOKS_IN_LIST.map(book => book.title).indexOf(query);
  console.log('index', index);

  if (!index) {
    throw new Error('Book not found');
  }

  const { title } = BOOKS_IN_LIST[index];
  const bookId = BOOKS_IN_LIST[index]['book_id'];
  return { index, title, bookId };
}

module.exports = { getBookIndexByTitle, getCosineSimilarityRowVector, sortByScore };
