'use strict';

module.exports = updateBackLinks;

function updateBackLinks(newDoc, bfKeys, callBack) {
  // Quick exit if there are no foreign keys to check
  if (bfKeys.length < 1) return callBack(null, newDoc);

  // Loop over all foreign key arrays included in this document
  var keyErrors = [];
  for (let key of bfKeys) {
    // The foreign keys to be added/removed were appended to the fKeys
    // object in the previous call to checkKeys.
    // 1. Add new foreign keys
    changeIds(newDoc._id, null, key.dbLink, key.keysToAdd, 
        key.backLinkField, trackAddErrs);
    // 2. Remove old foreign keys not retained in the new document
    changeIds(null, newDoc._id, key.dbLink, key.keysToRemove,
        key.backLinkField, trackAddErrs);
  }

  // The previous loop called an asynchronous function repeatedly,
  // so the callback needs to confirm that all calls finished correctly.
  function trackAddErrs(err) {
    keyErrors.push(err);
    if (keyErrors.length < 2 * bfKeys.length) return; // still updating DB
    // Return the first non-null error

    var realErr = keyErrors.find( (error) => { return error !== null; } );
    if (realErr) return callBack(realErr, null);

    return callBack(null, newDoc);
  }
}

// Add or remove a given document _id from the appropriate field in 
// a referenced doc. 
// Call with idToAdd OR idToRemove (not both!). The other should be null.
function changeIds(idToAdd, idToRemove, dbLink, refDocs, refField, callBack) {
  // Quick exit if no referenced docs
  if (!refDocs || refDocs.length < 1) return callBack(null);

  let err = {};

  // Construct the query and update operators
  var filter = {"_id": {$in: refDocs}};
  var timestamp = new Date().toISOString();
  if (idToAdd && !idToRemove) {
    var update = {
      $addToSet: {[refField]: idToAdd},
      $set: {"updated": timestamp}
    };
  } else if (!idToAdd && idToRemove) {
    var update = {
      $pull: {[refField]: idToRemove}, 
      $set: {"updated": timestamp}
    };
  } else {
    err.code = 400;
    err.message = 'changeIds was not called with ONE of ' +
      '[idToAdd, idToRemove] defined';
    return callBack(err);
  }
  
  // Send to database
  dbLink.updateMany(filter, update, null, updateErrCheck);

  // updateErrCheck must be nested to have access to the callBack 
  // that was passed to changeIds
  function updateErrCheck(updateErr, updateResult) {
    if (updateErr) {
      err.code = 500;
      err.message = 'Database error:' + '\n' + updateErr.message;
      return callBack(err);
    }
    if (updateResult.modifiedCount !== updateResult.matchedCount) {
      err.code = 500;
      err.message = 'Only ' + updateResult.modifiedCount + ' of ' + 
        updateResult.matchedCount + ' backLink fields in\n' + 
        'referenced documents were successfully updated.';
      return callBack(err);
    }
    return callBack(null);
  }
}
