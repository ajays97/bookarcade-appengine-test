const natural = require('natural');

natural.PorterStemmer.attach();

function zip(books, keywords) {
  return Object.keys(books).map(bookId => ({
    ...books[bookId],
    ...keywords[bookId]
  }));
}

function fromArrayToMap(array, property) {
  return array.map(value => {
    const transformed = value[property].map(val => ({
      id: val,
      name: val
    }));

    return { ...value, [property]: transformed };
  });
}

function withTokenizedAndStemmed(array, property) {
  return array.map(value => ({
    ...value,
    [property]: value[property].tokenizeAndStem()
  }));
}

function byId(booksById, book) {
  booksById[book['book_id']] = book;
  return booksById;
}

function toDictionary(array, property) {
  const dictionary = {};

  array.forEach(value => {
    // Fallback for null value after refactoring
    (value[property] || []).forEach(innerValue => {
      if (!dictionary[innerValue.id]) {
        dictionary[innerValue.id] = {
          ...innerValue,
          count: 1
        };
      } else {
        dictionary[innerValue.id] = {
          ...dictionary[innerValue.id],
          count: dictionary[innerValue.id].count + 1
        };
      }
    });
  });

  return dictionary;
}

function filterByThreshold(dictionary, threshold) {
  return Object.keys(dictionary)
    .filter(key => dictionary[key].count > threshold)
    .map(key => dictionary[key]);
}

function prepareDictionaries(books) {
  let genresDictionary = toDictionary(books, 'genres');
  // let keywordsDictionary = toDictionary(books, 'keywords');
  let overviewDictionary = toDictionary(books, 'short_description');

  // Customize the threshold to your own needs
  // Depending on threshold you get a different size of a feature vector for a book
  // The following case attempts to keep feature vector small for computational efficiency
  genresDictionary = filterByThreshold(genresDictionary, 1);
  // keywordsDictionary = filterByThreshold(keywordsDictionary, 150);
  overviewDictionary = filterByThreshold(overviewDictionary, 750);

  return {
    genresDictionary,
    // keywordsDictionary,
    overviewDictionary
  };
}

function toFeaturizedNumber(book, property) {
  const number = Number(book[property]);

  // Fallback for NaN
  if (number > 0 || number === 0) {
    return number;
  }
  return 'undefined';
}

function toFeaturizedRelease(book) {
  return book['amazon_price'] ? book['amazon_price'] : 'undefined';
}

function toFeaturizedAdult(book) {
  return book.adult === false ? 0 : 1;
}

function toFeaturizedLanguage(book) {
  return book['original_language'] === 'English' ? 1 : 0;
}

function toFeaturizedFromDictionary(book, dictionary, property) {
  // Fallback, because not all books have associated keywords
  const propertyIds = (book[property] || []).map(value => value.id);
  const isIncluded = value => (propertyIds.includes(value['book_id']) ? 1 : 0);
  return dictionary.map(isIncluded);
}

function toFeaturizedBooks(dictionaries) {
  return function toFeatureVector(book) {
    const featureVector = [];

    featureVector.push(toFeaturizedNumber(book, 'popularity')); // TODO: Change popularity to pages (integer - number of pages in the book)
    featureVector.push(toFeaturizedNumber(book, 'goodreads_rating')); // TODO: Change voteAverage to ratingAverage, here and in database
    featureVector.push(toFeaturizedNumber(book, 'rating_count')); // TODO: Change voteCount to ratingCount, here and in database
    featureVector.push(toFeaturizedRelease(book));

    featureVector.push(toFeaturizedAdult(book));
    featureVector.push(toFeaturizedLanguage(book));

    featureVector.push(...toFeaturizedFromDictionary(book, dictionaries.genresDictionary, 'genres'));
    featureVector.push(...toFeaturizedFromDictionary(book, dictionaries.overviewDictionary, 'short_description'));
    // featureVector.push(
    //   ...toFeaturizedFromDictionary(book, dictionaries.keywordsDictionary, 'keywords')
    // );

    return featureVector;
  };
}

function getCoefficients(X) {
  const M = X.length;

  const initC = {
    sums: [],
    mins: [],
    maxs: []
  };

  const helperC = X.reduce((result, row) => {
    if (row.includes('undefined')) {
      return result;
    }

    return {
      sums: row.map((feature, key) => {
        if (result.sums[key]) {
          return result.sums[key] + feature;
        }
        return feature;
      }),
      mins: row.map((feature, key) => {
        if (result.mins[key] === 'undefined') {
          return result.mins[key];
        }

        if (result.mins[key] <= feature) {
          return result.mins[key];
        }
        return feature;
      }),
      maxs: row.map((feature, key) => {
        if (result.maxs[key] === 'undefined') {
          return result.maxs[key];
        }

        if (result.maxs[key] >= feature) {
          return result.maxs[key];
        }
        return feature;
      })
    };
  }, initC);

  const means = helperC.sums.map(value => value / M);
  const ranges = helperC.mins.map((value, key) => helperC.maxs[key] - value);

  return { ranges, means };
}

function synthesizeFeatures(X, means, featureIndexes) {
  return X.map(row =>
    row.map((feature, key) => {
      if (featureIndexes.includes(key) && feature === 'undefined') {
        return means[key];
      }
      return feature;
    })
  );
}

function scaleFeatures(X, means, ranges) {
  return X.map(row => row.map((feature, key) => (feature - means[key]) / ranges[key]));
}

const prepareBooks = (booksMetaData, booksKeywords) => {
  console.log('Preparing Books... \n');

  // Pre-processing books for unified data structure
  // E.g. get overview property into same shape as studio property
  console.log('(1) Zipping Books');
  let BOOKS_IN_LIST = zip(booksMetaData, booksKeywords);
  BOOKS_IN_LIST = withTokenizedAndStemmed(BOOKS_IN_LIST, 'short_description');
  BOOKS_IN_LIST = fromArrayToMap(BOOKS_IN_LIST, 'short_description');

  // Keep a map of books for later reference
  const BOOKS_BY_ID = BOOKS_IN_LIST.reduce(byId, {});

  console.log('(2) Creating Dictionaries');
  // Preparing dictionaries for feature extraction
  const DICTIONARIES = prepareDictionaries(BOOKS_IN_LIST);

  // Feature Extraction:
  // Map different types to numerical values (e.g. adult to 0 or 1)
  // Map dictionaries to partial feature vectors
  console.log('(3) Extracting Features');
  let X = BOOKS_IN_LIST.map(toFeaturizedBooks(DICTIONARIES));

  // Extract a couple of valuable coefficients
  // Can be used in a later stage (e.g. feature scaling)
  console.log('(4) Calculating Coefficients');
  const { means, ranges } = getCoefficients(X);

  // Synthesize Features:
  // Missing features (such as budget, release, revenue)
  // can be synthesized with the mean of the features
  console.log('(5) Synthesizing Features');
  X = synthesizeFeatures(X, means, [0, 1, 2, 3, 4, 5, 6]);

  // Feature Scaling:
  // Normalize features based on mean and range vectors
  console.log('(6) Scaling Features \n');
  // X = scaleFeatures(X, means, ranges);

  console.log('All set and ready for recommendations :)');
  return {
    BOOKS_BY_ID,
    BOOKS_IN_LIST,
    X
  };
};

module.exports = {
  prepareBooks,
  scaleFeatures,
  synthesizeFeatures,
  getCoefficients,
  toFeaturizedBooks,
  toFeaturizedFromDictionary,
  toFeaturizedNumber,
  toFeaturizedRelease,
  toFeaturizedAdult,
  toFeaturizedLanguage,
  prepareDictionaries,
  filterByThreshold,
  toDictionary,
  withTokenizedAndStemmed,
  fromArrayToMap,
  byId,
  zip
};
