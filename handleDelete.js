'use strict';
const util = require('./util');
const checkETag = require('./checkETag');
const checkKeys = require('./checkKeys');
const updateBackLinks = require('./updateBackLinks');

module.exports = handleDelete;

function handleDelete(request, response, dbCollection, id, fKeys) {
  // Check if a document with the given ID and ETag exists in the database
  checkETag(id, request.headers['if-match'], dbCollection, checkCallBack);

  function checkCallBack(chkErr, oldDoc) {
    if (chkErr) return util.httpErr(response, chkErr.code, chkErr.message);

    // Check documents referenced by this document's foreign keys,
    // and flag any keys referring back to this document for deletion
    checkKeys(oldDoc, null, fKeys, removeFKeys);
  }

  function removeFKeys(keyErr, oldDoc, newDoc) { // newDoc is a null placeholder
    if (keyErr) return util.httpErr(response, keyErr.code, keyErr.message);

    // Update 'backLinks' -- this will remove the links to this document
    // from other documents.
    var bfKeys = 
      fKeys.filter( (fKey) => { return fKey.backLinkField !== null } );
    updateBackLinks(oldDoc, bfKeys, removeFromDatabase);
  }

  function removeFromDatabase(keyErr, oldDoc) {
    if (keyErr) return util.httpErr(response, keyErr.code, keyErr.message);

    // Delete from database
    dbCollection.deleteOne({"_id": id}, null, deleteReport);
  }

  function deleteReport(err, result) {
    if (err) return util.httpErr(response, 500, 'Database error:', err.message);
    response.writeHead(204);
    return response.end();
  }
}
