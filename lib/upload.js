var Busboy = require('busboy'),
  debug = require('debug')('share'),
  fs = require('fs'),
  path = require('path'),
  Q = require('q'),
  randomTmpFile = require('./random'),
  rimraf = require('rimraf'),
  sanitize = require('sanitize-filename');

var crypto = require('crypto');

function Upload(name, file, config) {
  if (!(this instanceof Upload)) {
    return new Upload(name, file, config);
  }

  this.name = sanitize(name);
  this.file = file;
  this.config = config;
  this.random = null;
  this.writeStream = null;
  this.aborted = false;
  this.hash = crypto.createHash('sha1');
  this.digest = null;
}

Upload.prototype.start = function() {
  var self = this;

  return randomTmpFile(self.config.tmpDir)
    .then(function(random) {
      self.random = random;
    })
    .then(function() {
      return self.pipeToTmpFile();
    })
    .then(function() {
      var deferredCompute = Q.defer();
      var deferredMoveToUpload = Q.defer();
      var stream = fs.createReadStream(path.join(self.config.tmpDir, self.random));
      stream.on('data', function(data) {
        self.hash.update(data, 'utf8');
        deferredCompute.resolve();
      });
      stream.on('end', function() {
        self.digest = self.hash.digest('hex');
        console.log('url is set', self.url());
        self.moveToUploadDir();
        deferredMoveToUpload.resolve();
      });
      return deferredMoveToUpload.promise;
    });
}

Upload.prototype.pipeToTmpFile = function() {
  var self = this,
    deferred = Q.defer(),
    tmpFile = path.join(self.config.tmpDir, self.random);

  self.writeStream = fs.createWriteStream(tmpFile);

  function onError(err) {
    self.file.unpipe();
    self.writeStream.destroy();
    deferred.reject(err);
  }

  function onFinish() {
    self.writeStream.on('close', onClose);
  }

  function onClose() {
    deferred.resolve();
  }

  self.file.on('error', onError);
  self.writeStream.on('error', onError);
  self.writeStream.on('finish', onFinish);

  self.file.pipe(self.writeStream);

  return deferred.promise;
}

Upload.prototype.moveToUploadDir = function() {
  var self = this;
  return Q.nfcall(fs.mkdir, path.join(self.config.uploadDir, self.digest))
    .then(function() {
      console.log('copying file');
      return Q.nfcall(fs.rename,
                      path.join(self.config.tmpDir, self.random),
                      path.join(self.config.uploadDir, self.digest, self.name));
    },
    function() {
      console.log('file already exists');
      return;
    });
}

Upload.prototype.abort = function() {
  if (this.aborted)
    return;

  this.aborted = true;
  debug('Aborting upload %s', this.name);

  this.file.unpipe();

  if (this.writeStream) {
    this.writeStream.destroy();
  }

  if (this.random) {
    rimraf(path.join(this.config.tmpDir, this.random), logAnyError);
    rimraf(path.join(this.config.uploadDir, this.random), logAnyError);
  }

  function logAnyError(err) {
    if (err) {
      debug(err);
    }
  }
}

Upload.prototype.url = function() {
  return encodeURIComponent(this.digest) + '/' + encodeURIComponent(this.name);
}

function upload(stream, headers, config) {
  var busboy = new Busboy({headers: headers}),
    deferred = Q.defer(),
    uploads = [],
    promises = [];

  function onFile(field, file, name) {
    var upload = Upload(name, file, config);
    uploads.push(upload);
    promises.push(upload.start().fail(onError));
  }

  function onBusboyFinish() {
    Q.all(promises).then(onUploadFinish).done();
  }

  function onUploadFinish() {
    var urls = uploads.map(function(upload) {
      console.log('url is baked', upload.url());
      return upload.url();
    });

    deferred.resolve(urls);
  }

  function onError(err) {
    debug('Upload error: %s', err);

    stream.unpipe();

    uploads.forEach(function(upload) {
      upload.abort();
    });

    deferred.reject(err);
  }

  stream.on('error', onError);
  busboy.on('error', onError);

  busboy.on('file', onFile);
  busboy.on('finish', onBusboyFinish);

  stream.pipe(busboy);

  return deferred.promise;
}

module.exports = upload;
