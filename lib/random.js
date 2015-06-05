var fs = require('fs'),
  path = require('path'),
  Q = require('q');

function randomName(length) {
  var i,
    name = '',
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (i = 0; i < length; i++) {
    name += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return name;
}

function randomTmpFile(parentDir) {
  var attempts = 0;

  function retry() {
    var name = randomName(5);
    attempts += 1;

    var deferred = Q.defer();
    fs.exists(path.join(parentDir, name), function(exists) {
      if (exists) {
        deferred.reject(name);
      } else {
        deferred.resolve(name);
      }
    });
    return deferred.promise
      .thenResolve(name)
      .fail(onError);
  }

  function onError(err) {
    var message;

    if (attempts >= 3) {
      message = 'Failed to make random directory after ' + attempts +
        ' attempts: ' + err.message;

      throw new Error(message);
    }

    return retry();
  }

  return retry();
}

module.exports = randomTmpFile;
