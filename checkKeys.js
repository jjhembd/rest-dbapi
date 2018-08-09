'use strict';

module.exports = checkKeys;

function checkKeys(newDoc, fKeys, callBack) {
  // Quick exit if there are no foreign keys to check
  if (fKeys.length < 1) return callBack(null, newDoc);

  // Loop over all foreign key arrays included in this document
  var keyErrors = [];
  for (let fKey of fKeys) {
    checkKeyArray(newDoc[fKey.field], fKey.dbLink, trackKeyErrs);
  }
  // The previous loop called an asynchronous function repeatedly,
  // so the callback needs to confirm that all calls finished correctly.
  function trackKeyErrs(err) {
    keyErrors.push(err);
    if (keyErrors.length < fKeys.length) return; // checkKeys still working
    // Return the first non-null error
    var realErr = keyErrors.find( (error) => { return error !== null; } );
    if (realErr) return callBack(realErr, null);

    return callBack(null, newDoc);
  }
}

// Check if a supplied array of keys is a unique set of valid document IDs
function checkKeyArray(keyArray, dbLink, callBack) {
  // Quick exit if no keys to check
  if (!keyArray) return callBack(null);

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
