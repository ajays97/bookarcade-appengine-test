/* eslint-disable no-plusplus */
/* eslint-disable no-unused-vars */

function getRatingCountsByBook(ratings) {
  return ratings.reduce((result, value) => {
    // const { bookId, rating } = value;
    const bookId = value['book_id'];
    const rating = value['rating'];

    if (!result[bookId]) {
      result[bookId] = 0;
    }

    result[bookId]++;

    return result;
  }, {});
}

function getRatingCountsByUser(ratings) {
  return ratings.reduce((result, value) => {
    const { userId, rating } = value;

    if (!result[userId]) {
      result[userId] = 0;
    }

    result[userId]++;

    return result;
  }, {});
}

function getRatingsGroupedByBook(ratings, ratingCountsByBook, ratingCountsByUser, popularityThreshold) {
  const { bookRatings, userRatings } = popularityThreshold;

  return ratings.reduce((result, value) => {
    // const { userId, bookId, rating, timestamp } = value;
    const userId = value['user_id'];
    const bookId = value['book_id'];
    const rating = value['rating'];
    const timestamp = value['timestamp'];

    if (ratingCountsByBook[bookId] < bookRatings || ratingCountsByUser[userId] < userRatings) {
      return result;
    }

    if (!result[bookId]) {
      result[bookId] = {};
    }

    result[bookId][userId] = { rating: Number(rating), timestamp };

    return result;
  }, {});
}

function getRatingsGroupedByUser(ratings, ratingCounts, popularity) {
  return ratings.reduce((result, value) => {
    // const { userId, bookId, rating } = value;
    const userId = value['user_id'];
    const bookId = value['book_id'];
    const rating = value['rating'];

    if (ratingCounts[bookId] < popularity) {
      return result;
    }

    if (!result[userId]) {
      result[userId] = {};
    }

    result[userId][bookId] = { rating: Number(rating) };

    return result;
  }, {});
}

function prepareRatings(ratings) {
  console.log('Preparing Ratings ... \n');

  const ratingCountsByBook = getRatingCountsByBook(ratings);
  const ratingCountsByUser = getRatingCountsByUser(ratings);

  const POPULARITY_THRESHOLD = {
    bookRatings: 0, // be careful not to exclude the books of your focused user
    userRatings: 0 // be careful not to exclude your focused user
  };

  console.log('(1) Group ratings by user');
  const ratingsGroupedByUser = getRatingsGroupedByUser(
    ratings,
    ratingCountsByBook,
    ratingCountsByUser,
    POPULARITY_THRESHOLD
  );

  console.log('(2) Group ratings by book \n');
  const ratingsGroupedByBook = getRatingsGroupedByBook(
    ratings,
    ratingCountsByBook,
    ratingCountsByUser,
    POPULARITY_THRESHOLD
  );

  return { ratingsGroupedByUser, ratingsGroupedByBook };
}

module.exports = {
  prepareRatings,
  getRatingsGroupedByUser,
  getRatingsGroupedByBook,
  getRatingCountsByUser,
  getRatingCountsByBook
};
