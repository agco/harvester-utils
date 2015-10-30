/**
 * A test utilities module for HarvesterJS apps.
 *
 */
'use strict';

// dependencies
var _ = require('lodash'),
var chai = require('chai'),
var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');


// This doesn't appear to be used...
// var request = require('request');

// private variables
var expect = chai.expect;


var chaiExpress = function (app) {
    return app.then(function (harvestApp) {
        return chai.request(harvestApp.router);
    });
};

function dropDb(app) {
    return app
        .then(function (harvestApp) {
            return harvestApp.adapter.awaitConnection().then(function () {
                return new Promise(function (resolve, reject) {
                    harvestApp.adapter.db.db.dropDatabase(function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(harvestApp);
                        }
                    });
                });
            });
        }).then(function (harvestApp) {
            var promises = _.map(harvestApp.adapter._models, function (model) {
                return Promise.promisify(model.ensureIndexes, model)();
            });
            return Promise.all(promises).then(function () {
                return harvestApp;
            });
        });
}

function seed(app, resource, collection) {
    return app.then(function (harvestApp) {
        return Promise.all(_.map(_.cloneDeep(collection), function (item) {
            return harvestApp.adapter.create(resource, item);
        }));
    });
}

function resourceGet(app, endpoint) {
    return chaiExpress(app)
        .then(function (chaiExpress) {
            return chaiExpress
                .get(endpoint)
                .then(function (res) {
                    expect(res).to.have.status(200);
                    return res;
                });
        });

}

function resourcePut(app, endpoint, body) {
    return chaiExpress(app)
        .then(function (chaiExpress) {
            return chaiExpress
                .put(endpoint)
                .send(body)
                .then(function (res) {
                    expect(res).to.have.status(200);
                    return res;
                });
        });
}

function immutablePut(app, endpoint, body) {
    return chaiExpress(app)
        .then(function (chaiExpress) {
            return chaiExpress
                .put(endpoint)
                .send(body)
                .then(function (res) {
                    expect(res).to.have.status(400);
                    return res;
                });
        });
}

function resourceDelete(app, endpoint) {
    return chaiExpress(app)
        .then(function (chaiExpress) {
            return chaiExpress
                .delete(endpoint)
                .then(function (res) {
                    expect(res).to.have.status(204);
                    return res;
                });
        });
}

function immutableDelete(app, endpoint) {
    return chaiExpress(app)
        .then(function (chaiExpress) {
            return chaiExpress
                .delete(endpoint)
                .then(function (res) {
                    expect(res).to.have.status(500);
                    return res;
                });
        });
}

function resourcePost(app, endpoint, body) {
    return chaiExpress(app)
        .then(function (chaiExpress) {
            return chaiExpress
                .post(endpoint)
                .send(body)
                .then(function (res) {
                    expect(res).to.have.status(201);
                    return res;
                });
        });
}

function immutablePost(app, endpoint, body) {
    return chaiExpress(app)
        .then(function (chaiExpress) {
            return chaiExpress
                .post(endpoint)
                .send(body)
                .then(function (res) {
                    expect(res).to.have.status(405);
                    return res;
                });
        });
}


function uri(port) {
    return function (path) {
        return 'http://localhost:' + port + path;
    }
}


/**
 * This is a temporary hack, drop in replacement for node-fixtures. It's usage is
 * a little different but it returns data in the same format.
 *
 * Usage Example:
 *
 *   fx = FixturesSync();
 *
 * It pulls in the same files from the same location (./fixtures/*.*). However
 * these files need to be requireable modules that return json. Either as JSON
 * or self executing functions that return JSON. This is so that comments (and
 * other cool stuff) can go in a fixtures file.
 *
 * NOTE 1: As noted by the `Sync` suffix, this function uses sync code so be
 * careful where you call this, so that you're not blocking the event loop.
 *
 * returns
 *   object, an object indexed by filename of fixtures as JSON
 */
function fixturesSync() {
  var fixtureList = fs.readdirSync(path.join(__dirname, './fixtures'));
  var fixtures;

  if (!fixtures) {
    fixtures = {};
    _.forEach(fixtureList, function A(value, index, collection) {
      fixtures[path.basename(value, '.js')] = require('./fixtures/' + value);
    });
  }
  return fixtures;
}


/**
 * Given an array of fixtures, it flattens each fixture into a MongoDB doc.
 * By flattening, it removes links and changes id to _id.
 *
 * @param  {[type]} docs  A single MongoDB doc or an Array of MongoDB docs
 * @return {[type]}       an Array of promoted docs
 *
 */
function flatternFixturesIntoDocs(docs) {
    if (!_.isArray(docs)) {
        docs = [ docs ];
    }
    _.forEach(docs, function (doc) {
        if (doc.id) {
            doc._id = doc.id;
            delete doc.id;
            if (doc.links) {
                _.forEach(doc.links, function flatternLinks(value, key) {
                    doc[key] = doc.links[key];
                });
                delete doc.links;
            }
        }
    });
    return docs;
}


/**
 * create MongoDB docs for the given Resource with the given docs.
 *
 * @param  {[type]} Resource  the Mongoose Model name for the resource
 * @param  {[type]} docs      A single MongoDB doc or an Array of MongoDB docs
 * @return {[type]}           Promise containing the number of docs created
 *
 */
function insertDocsIntoDb(Resource, docs) {
    var promises = [];

    _.forEach(docs, function (doc) {
        promises.push(Resource.create(doc));
    });
    return Promise.all(promises)
    .then(function countCreatedDocs(docs) {
        return docs.length;
    });
}


// public API
module.exports = function (port) {
    return {
        fixturesSync: fixturesSync,
        chaiExpress: chaiExpress,
        dropDb: dropDb,
        flatternFixturesIntoDocs: flatternFixturesIntoDocs,
        insertDocsIntoDb: insertDocsIntoDb,
        seed: seed,
        resourceGet: resourceGet,
        resourceDelete: resourceDelete,
        immutableDelete: immutableDelete,
        resourcePost: resourcePost,
        immutablePost: immutablePost,
        resourcePut: resourcePut,
        immutablePut: immutablePut,
        uri: uri(port)
    }
}
