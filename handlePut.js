'use strict';

const util = require('./util');
const checkETag = require('./checkETag');

module.exports = handlePut;

function handlePut(request, response, dbCollection, validator, id, locationURL) {
  let oldCreatedDate = '';

  // Check if a document with the given ID and ETag exists in the database
  checkETag(id, request.headers['if-match'], dbCollection, checkCallBack);
  function checkCallBack(chkErr, oldDocument) {
    if (chkErr) return util.httpErr(response, chkErr.code, chkErr.message);

    // Save Created date from old document
    oldCreatedDate = oldDocument["created"];
    // Now get the client's updated version from the body of the request
    util.getRequestBodyJSON(request, id, validator, processBody);
  }

  function processBody(getErr, newDocument) {
    if (getErr) return util.httpErr(response, getErr.code, getErr.message);

    // Update timestamps
    newDocument.created = oldCreatedDate;
    newDocument.updated = new Date().toISOString();

    // Insert into database
    dbCollection.replaceOne({"_id": id}, newDocument, null, replaceCallBack);
    function replaceCallBack(err, res) {
      if (err) return util.httpErr(response, 500, 'Database error:', err.message);
      return util.reportNewDoc(newDocument, locationURL, response);
    }
  }
}
