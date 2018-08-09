'use strict';
const Ajv = require('ajv');
const dbSchema = require('./dbSchema');

// Prepare ajv compiler
const ajv = new Ajv( {allErrors: true} );

// Read schema dependencies and pre-load them into the compiler
var valid = true;
for (let dependencyFile of dbSchema.schemaDependencies) {
  valid = ajv.addSchema( [ require(dependencyFile) ] );
  if (!valid) throw ajv.errorsText();
}

// Construct 2D object with (key,key):value pairs, where
// the keys are database and collection names, and
// the value is the validator function
var validators = {};
for (let database of dbSchema.databases) {
  validators[database.name] = {};
  for (let collection of database.collections) {
    validators[database.name][collection.name] = 
      ajv.compile( require(collection.schema) );
  }
}

// Construct 2D object with (key,key):value pairs, where
// the keys are database and collection names, and
// the value is an array of foreign key objects, containing all information
// needed to validate foreign keys in a document of this collection, 
// and ensure referential integrity between this and any referenced collections

// Step 1: Collect supplied foreign key info into a 2D object
//         (for easier lookup by database & collection name)
var fKeys = {};
for (let database of dbSchema.databases) {
  fKeys[database.name] = {};
  for (let collection of database.collections) {
    fKeys[database.name][collection.name] = [];
    for (let fKey of collection.foreignKeys) {
      // Each fKey describes an array of _id's referencing documents in the 
      // fKey.refCollection from the fKey.refDatabase.
      var tempObject = {};
      // We copy fKey property by property, to make sure we are getting a copy
      // of the values and not just a reference to the same object.
      tempObject.field = fKey.field;
      tempObject.refDatabase = fKey.refDatabase;
      tempObject.refCollection = fKey.refCollection;
      tempObject.backLinkField = null; // Placeholder, to be updated in step 2
      fKeys[database.name][collection.name].push(tempObject);
    }
  }
}
// field, refDatabase, and refCollection are enough information to verify
// that the foreign keys in "field" refer to documents that actually exist
// in refDatabase/refCollection.
// But what if the documents in refDatabase/refCollection have foreign keys
// referring back to the current collection? In that case, we need to make sure
// the current document's ID is correctly referenced in those documents.
// To do so, we need to know the name of the relevant field 
// (the 'backLinkField') in the other collection.

// Step 2: Add backlink info
for (let dbname in fKeys) {
  for (let collname in fKeys[dbname]) {
    for (let fKey of fKeys[dbname][collname]) {
      // Check refCollection for foreign keys referencing back to collname
      var backRefs = 
        fKeys[fKey.refDatabase][fKey.refCollection].filter(isBackRef);
      function isBackRef( key ) {
        return (key.refDatabase === dbname && key.refCollection === collname);
      }
      if (backRefs.length > 1) {
        let err = 'Unsupported foreign key setup:\n';
        err += 'Collection ' + collname + ' in database ' + dbname + '\n';
        err += 'contains a foreign key referencing collection ' +
          fKey.refCollection + ' in database ' + fKey.refDatabase + '.\n';
        err += 'This referenced collection has multiple fields containing\n';
        err += 'foreign keys referring back to ' + collname + ' in ' +
          dbname + '\n';
        throw(err);
      } else if (backRefs.length > 0) {
        // Note: fKey is not a mere iteration variable!
        // It is a reference to an actual object in fKeys
        // Changing fKey changes the element in fKeys!
        fKey.backLinkField = backRefs[0].field;
      }
    }
  }
}

module.exports.url = dbSchema.url;
module.exports.validators = validators;
module.exports.fKeys = fKeys;
