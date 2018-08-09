'use strict';
const etag = require('etag');

const util = require('./util');
const checkETag = require('./checkETag');

module.exports = handleGet;

function handleGet(request, response, dbCollection, id, query, options) {
  // Initialize the query if missing (as in a GET by ID)
  if (!query) {
    query = {};
  }
  if (id) { // Add the _id to the query and find that one document
    query["_id"] = id;
    dbCollection.findOne(query, options, findCallBack);
  } else { // Perform a general search, which may return multiple documents
    dbCollection.find(query, options).toArray(findCallBack);
  }

  function findCallBack(findErr, data) {
    if (findErr) { 
      return util.httpErr(response, 500, 'Database error:', err.message);
    }
    var body = JSON.stringify(data, null, 2) + '\n';

    // Client may already have a copy, and is just checking if it is up-to-date
    var oldETag = request.headers['if-none-match'];
    var newETag = etag(body);
    if (newETag === oldETag) {
      response.writeHead(304); // Client already has the latest version
      return response.end();
    }

    var header = {};
    header['Content-Type'] = 'application/json';
    header['Cache-Control'] = 'public';
    header['Content-Length'] = Buffer.byteLength(body);
    header['ETag'] = newETag;
    response.writeHead(200, header);
    return response.end(body);
  }
}
