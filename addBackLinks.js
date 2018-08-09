'use strict';

module.exports = addBackLinks;

function addBackLinks(newDoc, bfKeys, callBack) {
  // Quick exit if there are no foreign keys to check
  if (bfKeys.length < 1) return callBack(null, newDoc);

  // Loop over all foreign key arrays included in this document
  var keyErrors = [];
  for (let key of bfKeys) {
    var refDocIds = newDoc[key.field];
    addId(newDoc._id, key.dbLink, refDocIds, key.backLinkField, trackAddErrs);
  }
  // The previous loop called an asynchronous function repeatedly,
  // so the callback needs to confirm that all calls finished correctly.
  function trackAddErrs(err) {
    keyErrors.push(err);
    if (keyErrors.length < bfKeys.length) return; // checkKeys still working
    // Return the first non-null error
    var realErr = keyErrors.find( (error) => { return error !== null; } );
    if (realErr) return callBack(realErr, null);

    return callBack(null, newDoc);
  }
}

// Add a given document _id to the appropriate field in a referenced doc.
function addId(idToAdd, dbLink, refDocs, refField, callBack) {
  // Queck exit if no referenced docs
  if (!refDocs) return callBack(null);

  // Construct the query and update operators
  var filter = {"_id": {$in: refDocs}};
  var timestamp = new Date().toISOString();
  var update = {
    $addToSet: {[refField]: idToAdd}, 
    $set: {"updated": timestamp}
  };
  
  // Send to database
  dbLink.updateMany(filter, update, null, updateCallBack);

  function updateCallBack(updateErr, updateResult) {
    let err = {};
    if (updateErr) {
      err.code = 500;
      err.message = 'Database error:' + '\n' + updateErr.message;
      return callBack(err);
    }
    if (updateResult.modifiedCount !== refDocs.length) {
      err.code = 500;
      err.message = 'Only ' + updateResult.modifiedCount + ' of ' + 
        refDocs.length + ' backLink fields in referenced documents\n' +
        'were successfully updated.';
      return callBack(err);
    }
    return callBack(null);
  }
}
