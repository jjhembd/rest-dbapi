'use strict';

module.exports = checkKeys;

function checkKeys(oldDoc, newDoc, fKeys, callBack) {
  // Quick exit if there are no foreign keys to check
  if (fKeys.length < 1) return callBack(null, oldDoc, newDoc);

  // Loop over all foreign key arrays included in this document
  var keyErrors = [];
  for (let fKey of fKeys) {
    // Compare old and new keys, find added and removed sets
    var oldKeys = (oldDoc)
      ? oldDoc[fKey.field]
      : null;
    var newKeys = (newDoc)
      ? newDoc[fKey.field]
      : null;
    if (oldKeys && newKeys) {
      // 1. Add keys in newDoc that are not in oldDoc
      fKey.keysToAdd = 
        newKeys.filter( (a) => { return oldKeys.indexOf(a) < 0; } );
      // 2. Remove keys in oldDoc that are not in newDoc
      fKey.keysToRemove = 
        oldKeys.filter( (a) => { return newKeys.indexOf(a) < 0; } );
    } else if (newKeys) { 
      // No old document available--perhaps we are creating a new
      // resource with a POST request?
      fKey.keysToAdd = newKeys;
      fKey.keysToRemove = [];
    } else if (oldKeys) { 
      // No keys in new document--perhaps we are deleting the old
      // document and didn't supply any new document?
      fKey.keysToAdd = [];
      fKey.keysToRemove = oldKeys;
    } else { 
      // No keys at all... This could be anything. We will be done shortly.
      fKey.keysToAdd = [];
      fKey.keysToRemove = [];
    }
    // Check the new keys
    checkKeyArray(fKey.keysToAdd, fKey.dbLink, trackKeyErrs);
  }

  // The previous loop called an asynchronous function repeatedly,
  // so the callback needs to confirm that all calls finished correctly.
  function trackKeyErrs(err) {
    keyErrors.push(err);
    if (keyErrors.length < fKeys.length) return; // checkKeys still working
    // Return the first non-null error
    var realErr = keyErrors.find( (error) => { return error !== null; } );
    if (realErr) return callBack(realErr, null, null);

    return callBack(null, oldDoc, newDoc);
  }
}

// Check if a supplied array of keys is a unique set of valid document IDs
function checkKeyArray(keyArray, dbLink, callBack) {
  // Quick exit if no keys to check
  if (!keyArray || keyArray.length < 1) return callBack(null);

  let err = {};

  // Make sure supplied list of keys is unique
  if (keyArray.length !== Array.from( new Set(keyArray) ).length) {
    err.code = 400;
    err.message = 'A supplied foreign key list contains duplicates';
    return callBack(err);
  }

  // Get a list of the IDs in keyArray that exist in the database
  dbLink.find({"_id": {$in: keyArray}}, {"_id": 1}).toArray(compareLists);

  function compareLists(findErr, idList) {
    if (findErr) {
      err.code = 500;
      err.message = 'Database error:' + '\n' + findErr.message;
      return callBack(err);
    }
    if (idList.length !== keyArray.length) { // Did not find them all !
      let found = idList.map( function (u) { return u._id } );
      let missing = keyArray.filter( (key) => { return !found.includes(key) } );
      err.code = 400;
      err.message = 'The following IDs do not exist in the database\n';
      err.message += missing.toString();
      return callBack(err);
    }
    return callBack(null);
  }
}
