'use strict';
const util = require('./util');
const checkKeys = require('./checkKeys');
const addBackLinks = require('./addBackLinks');

module.exports = handlePost;

function handlePost(request, response, dbCollection, validator, id, 
    locationURL, fKeys) {
  // Make sure supplied ID (from URL) is unique
  dbCollection.countDocuments({"_id": id}, {limit: 1}, countCallBack);
  function countCallBack(countErr, count) {
    if (countErr) {
      return util.httpErr(response, 500, 'Database error:', countErr.message);
    } else if (count) {
      return util.httpErr(response, 409, 
          'Document _id ' + id + ' already exists in the collection');
    }
    // Get the document from the body of the request
    util.getRequestBodyJSON(request, id, validator, processBody);
  }

  function processBody(getErr, newDocument) {
    if (getErr) return util.httpErr(response, getErr.code, getErr.message);

    // Add Created, Updated timestamps
    newDocument.created = new Date().toISOString();
    newDocument.updated = newDocument.created;

    // Verify that supplied foreign keys refer to valid existing documents
    checkKeys(newDocument, fKeys, finalizeFKeys);
  }

  function finalizeFKeys(keyErr, newDoc) {
    if (keyErr) return util.httpErr(response, keyErr.code, keyErr.message);

    // Update 'backLinks' in the documents referenced by this document's
    // foreign keys. 'backLinks' are key arrays referring back to this 
    // document. We need to add this document's _id to those arrays.
    var bfKeys = 
      fKeys.filter( (fKey) => { return fKey.backLinkField !== null; } );
    addBackLinks(newDoc, bfKeys, addToDatabase);
  }

  function addToDatabase(keyErr, newDoc) {
    if (keyErr) return util.httpErr(response, keyErr.code, keyErr.message);

    // Insert into database
    dbCollection.insertOne(newDoc, null, insertCallBack);

    // insertCallBack must be nested for access to the newDoc variable
    function insertCallBack(err, res) {
      if (err) return util.httpErr(response, 500, 'Database error:', err.message);
      return util.reportNewDoc(newDoc, locationURL, response);
    }
  }
}
