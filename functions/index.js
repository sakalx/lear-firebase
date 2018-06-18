const functions = require('firebase-functions');

const gcsConfig = {
  projectId: 'sakal-s',
  keyFilename: 'sakal-s-firebase-adminsdk-tttz9-5022f7cb73.json',
};

const gcs = require('@google-cloud/storage')(gcsConfig);

const spawn = require('child-process-promise').spawn;
const cors = require('cors')({origin: true});
const Busboy = require('busboy');

// node modules
const os = require('os');
const fs = require('fs');
const path = require('path');

// Upload Img and with endPoint rename + resize
//endPoint: https://us-central1-sakal-s.cloudfunctions.net/uploadFile
exports.onUpload = functions.storage.object().onFinalize(event => {
  const {bucket, contentType, name: filePath} = event;

  if (path.basename(filePath).startsWith('resized-')) {
    console.log('Already resized');
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

exports.uploadFile = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    if (req.method !== 'POST') {
      return res.status(200).json({
        message: 'Not allowed 👿'
      })
    }

    const busboy = new Busboy({headers: req.headers});
    let uploadData = null;

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const filepath = path.join(os.tmpdir(), filename);

      uploadData = {file: filepath, type: mimetype};
      file.pipe(fs.createWriteStream(filepath));
    });

    busboy.on('finish', () => {
      const bucket = gcs.bucket('sakal-s.appspot.com');

      bucket.upload(uploadData.file, {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: uploadData.type,
          }
        },
      })
        .then(() => {
          res.status(200).json({
            message: 'Uploaded file successfully ✨'
          })
        })
        .catch(err => {
          res.status(500).json({
            error: err,
          })
        })
    });

    busboy.end(req.rawBody);
  });
});