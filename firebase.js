const admin = require('firebase-admin');

var firebaseApp = admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

module.exports = {
  firebaseApp,
  db
};
