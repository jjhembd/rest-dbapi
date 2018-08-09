'use strict';
const MongoClient = require('mongodb').MongoClient;
const http = require('http');

const util = require('./util');
const databaseURL = require('./databaseConfig').url;
const fKeys = require('./databaseConfig').fKeys;
const handleGet = require('./handleGet');
const handlePost = require('./handlePost');
const handlePut = require('./handlePut');
const handleDelete = require('./handleDelete');

// ajv validators have an attached error object, which will update
// based on the validation results. Hence we cannot import them to a const.
var validators = require('./databaseConfig').validators;

var dbHandle;

// Connect to the database. This can be slow...
// Everything else in this file will be called from mdbCallBack.
MongoClient.connect(databaseURL, {useNewUrlParser: true}, mdbCallBack);
function mdbCallBack(dbErr, db) {
  if (dbErr) throw dbErr;

  // Add dbLinks to the foreign keys object
  for (let dbname in fKeys) {
    for (let collname in fKeys[dbname]) {
      for (let fKey of fKeys[dbname][collname]) {
        fKey.dbLink = db.db(fKey.refDatabase).collection(fKey.refCollection);
      }
    }
  }

  dbHandle = db; // Save to global variable for access in other functions

  // Start server, listening on port 8080
  http.createServer( requestListener ).listen(8080);
}

function requestListener(request, response) {
   // request.url is missing some info for the WHATWG URL API to work
  var baseURL = 'http://' + request.headers.host + '/';
  var fullURL = new URL(request.url, baseURL);
  var locURL = fullURL.origin + fullURL.pathname;
  // Valid URLs could be either of the form 
  //      /db/collection?query=<query>&options=<options>
  //   OR /db/collection/id?query=<query>&options=<options>  
  // where query or options could be missing in either case.
  var pathArray = fullURL.pathname.split('/');
  var database = pathArray[1];
  var collection = pathArray[2];
  var id = pathArray[3];
  // Check if path is valid
  if ( Object.keys(validators).indexOf(database) < 0 || 
       Object.keys(validators[database]).indexOf(collection) < 0 ||
       pathArray.length > 4 ) {
    return util.httpErr(response, 404);
  }
  // Store quick links to the collection and its validator
  var dbCollection = dbHandle.db(database).collection(collection);
  var validator = validators[database][collection];
  // Except for GET requests, all others require an ID of the resource
  if (!id && request.method !== 'GET') {
    return util.httpErr(response, 400,
        request.method + ' requests require an ID for the target resource');
  }
  // Make sure query and options are valid JSON
  var query, options, parseErr;
  [query, parseErr] = util.parseJSON( fullURL.searchParams.get("query") );
  if (parseErr) { return util.httpErr(response, 400, parseErr, query); }
  [options, parseErr] = util.parseJSON( fullURL.searchParams.get("options") );
  if (parseErr) { return util.httpErr(response, 400, parseErr, options); }
  // queries and options are only for GET requests
  if ( (query || options) && request.method !== 'GET') {
    return util.httpErr(response, 400, 
        'query and options only allowed for GET requests',
        'query=' + JSON.stringify(query, null, 2),
        'options=' + JSON.stringify(options, null, 2)
        );
  }

  // Now handle the request appropriately depending on the method
  switch (request.method) {
    case 'GET':
      return handleGet(request, response, dbCollection, id, query, options);
    case 'POST':
      return handlePost(request, response, dbCollection, validator, id, locURL,
          fKeys[database][collection]);
    case 'PUT':
      return handlePut(request, response, dbCollection, validator, id, locURL);
    case 'PATCH':
      return handlePatch(request, response, dbCollection, id, locURL);
    case 'DELETE':
      return handleDelete(request, response, dbCollection, id);
    default:
      return util.httpErr(response, 400,
          'Unknown request method ' + request.method,
          'This API only understands GET, POST, PUT, PATCH, or DELETE');
  }
}

function handlePatch(request, response, dbCollection, id, locationURL) {
  return util.httpErr(response, 501, 'PATCH requests not implemented yet');
}
