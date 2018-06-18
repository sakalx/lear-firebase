const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;

// node modules
const os = require('os');
const path = require('path');

exports.onFileChange = functions.storage.object().onFinalize(event => {
  const {bucket, contentType, name: filePath} = event;
  console.log('File changed');

  if (path.basename(filePath).startsWith('resized-')) {
    console.log('Already renamed !!!');

    return null;
  }

  const destBucket = gcs.bucket(bucket);
  const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
  const metaData = {contentType};

  return destBucket.file(filePath).download({
    destination: tempFilePath,
  }).then(() => {
    return spawn('convert', [tempFilePath, '-resize', '500x500', tempFilePath])
      .then(() => {
        destBucket.upload(tempFilePath, {
          destination: 'resized-' + path.basename(filePath),
          metaData,
        })
      });
  });
});
