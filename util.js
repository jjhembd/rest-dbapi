'use strict';
const etag = require('etag');
const httpCodes = require('./httpStatusCodes');

module.exports.parseJSON = parseJSON;
module.exports.httpErr = httpErr;
module.exports.getRequestBodyJSON = getRequestBodyJSON;
module.exports.reportNewDoc = reportNewDoc;

function httpErr(resp, code, ...messages) {
  resp.writeHead(code, {'Content-Type': 'application/json'});
  resp.write(httpCodes[code] + '\n');
  for (var i = 0; i < messages.length; i++) {
    resp.write(messages[i] + '\n');
  }
  return resp.end();
}

function parseJSON(string) {
  // Returns a two-valued array: [ parse result, error message ]
  var json;
  try {
    json = JSON.parse(string);
  } catch (parseError) {
    return [string, 'Not valid JSON data'];
  }
  return [json, null];
}

// Accumulate and parse the body of a supplied request
function getRequestBodyJSON(req, id, validator, callBack) {
  let body = '';
  let err = {};
  req.on('error', passErr);
  function passErr (reqErr) {
    err.code = 500;
    err.message = 'Request emitted error event. Please try again.';
    return req.connection.destroy();
  }
  req.on('data', storeData);
  function storeData(data) {
    // Follows Mahn's answer on
    // https://stackoverflow.com/questions
    // /4295782/how-do-you-extract-post-data-in-node-js
    if (body.length > 1e6) {  // request body is suspiciously large
      err.code = 413;
      err.message = 'The request body is >1MB';
      return req.connection.destroy();
    }
    body += data;
  }
  // For the 'end' event, Node assumes a callback with no parameters?
  // NOTE that we ASSUME req will emit an 'end' after req.connection.destroy()
  req.on('end', sendBody);
  function sendBody() {
    if (err.code) return callBack(err, null);
    var parsedBody, JSONerr;
    [parsedBody, JSONerr] = parseJSON(body);
    if (JSONerr) {
      err.code = 400;
      err.message = JSONerr + '\n' + parsedBody;
      return callBack(err, null);
    }
    // Validate against schema for this collection
    var valid = validator(parsedBody);
    if (!valid) {
      err.code = 400;
      err.message = 'document does not fit the schema' + '\n' +
          JSON.stringify(validator.errors, null, 2);
      return callBack(err, null);
    }
    // Confirm _id in request body matches the one supplied in the URL
    if (parsedBody._id !== id) {
      err.code = 400;
      err.message = '_id in request body does not match URL' + '\n' +
        'URL: ' + id + '  request body: ' + parsedBody._id;
      return callBack(err, null);
    }
    callBack(null, parsedBody);
  }
}

function reportNewDoc (newDoc, locURL, resp) {
  // After creating/updating a document in the database,
  // we return the  document, since we added/changed timestamps. See
  // https://www.vinaysahni.com
  // /best-practices-for-a-pragmatic-restful-api#useful-post-responses
  var body = JSON.stringify(newDoc, null, 2) + '\n';
  var header = {};
  header['Content-Type'] = 'application/json';
  header['Cache-Control'] = 'public';
  header['Location'] = locURL;
  header['Content-Length'] = Buffer.byteLength(body);
  header['ETag'] = etag(body);
  resp.writeHead(200, header);
  return resp.end(body);
}
