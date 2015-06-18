share
=====

An internal web app for sharing files using
[dropzone.js](http://www.dropzonejs.com/). There are no limits on file size and
no user authentication. Files are never cleaned up.

## Running

    $ npm install
    $ node .

## Updating client dependencies

    $ bower update
    $ grunt

## Deploy using Docker/Dokku

This project can be deployed using the provided Dockerfile or can be deployed in dokku-alt using:

```
dokku clone share https://github.com/briangreenery/share.git
```
