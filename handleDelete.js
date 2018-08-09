'use strict';

const util = require('./util');
const checkETag = require('./checkETag');

module.exports = handleDelete;

function handleDelete(request, response, dbCollection, id) {
  // Check if a document with the given ID and ETag exists in the database
  checkETag(id, request.headers['if-match'], dbCollection, checkCallBack);

  function checkCallBack(chkErr, oldDocument) {
    if (chkErr) return util.httpErr(response, chkErr.code, chkErr.message);
    dbCollection.deleteOne({"_id": id}, null, deleteCallBack);
  }

  function deleteCallBack(err, result) {
    if (err) return util.httpErr(response, 500, 'Database error:', err.message);
    response.writeHead(204);
    return response.end();
  }
}
