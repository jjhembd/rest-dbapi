'use strict';
const etag = require('etag');

module.exports = checkETag;

// Check if a document with a given ID and ETag exists in the database
function checkETag(id, testTag, dbLink, callBack) {
  let err = {};
  if (!testTag) {
    err.code = 428;
    err.message = 'A correct ETag for the existing resource is required.';
    return callBack(err, null);
  }
  // Retrieve existing version of the document from the database
  dbLink.findOne({"_id": id}, null, computeOldETag);

  function computeOldETag(findErr, oldDoc) {
    if (findErr) {
      err.code = 500;
      err.message = 'Database error:' + '\n' + findErr.message;
      return callBack(err, null);
    }
    // Check ETag consistency
    var oldETag = etag( JSON.stringify(oldDoc, null, 2) + '\n');
    if (oldETag !== testTag) {
      err.code = 409;
      err.message = 'Supplied ETag does not match the document in the database';
      return callBack(err, null);
    }
    return callBack(null, oldDoc);
  }
}
