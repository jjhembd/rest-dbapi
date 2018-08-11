'use strict';
const util = require('./util');
const checkETag = require('./checkETag');
const checkKeys = require('./checkKeys');
const updateBackLinks = require('./updateBackLinks');

module.exports = handlePut;

function handlePut(request, response, dbCollection, validator, id, 
    locationURL, fKeys) {

  // Check if a document with the given ID and ETag exists in the database
  checkETag(id, request.headers['if-match'], dbCollection, checkCallBack);
  function checkCallBack(chkErr, oldDoc) {
    if (chkErr) return util.httpErr(response, chkErr.code, chkErr.message);

    // Now get the client's updated version from the body of the request
    util.getRequestBodyJSON(request, id, validator, oldDoc, processBody);
  }

  function processBody(getErr, oldDoc, newDoc) {
    if (getErr) return util.httpErr(response, getErr.code, getErr.message);

    // Update timestamps
    newDoc.created = oldDoc.created;
    newDoc.updated = new Date().toISOString();

    // Verify that supplied foreign keys refer to valid existing documents
    checkKeys(oldDoc, newDoc, fKeys, finalizeFKeys);
  }

  function finalizeFKeys(keyErr, oldDoc, newDoc) {
    if (keyErr) return util.httpErr(response, keyErr.code, keyErr.message);

    // Update 'backLinks' in the documents referenced by this document's
    // foreign keys. 'backLinks are key arrays referencing back to this
    // document. We need to add this document's _id to those arrays,
    // AND remove this _id from arrays in documents which are no longer
    // referenced from this document.
    var bfKeys = 
      fKeys.filter( (fKey) => { return fKey.backLinkField !== null; } );
    updateBackLinks(newDoc, bfKeys, addToDatabase);
  }

  function addToDatabase(keyErr, newDoc) {
    if (keyErr) return util.httpErr(response, keyErr.code, keyErr.message);

    // Insert into database
    dbCollection.replaceOne({"_id": id}, newDoc, null, replaceCallBack);

    // replaceCallBack must be nested for access to the newDoc variable
    function replaceCallBack(err, res) {
      if (err) return util.httpErr(response, 500, 'Database error:', err.message);
      return util.reportNewDoc(newDoc, locationURL, response);
    }
  }
}
