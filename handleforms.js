// To use this route, your application.js should call: require('./lib/handleforms');
// Additionally, this assumes your RHMAP form has a photo type field as the first field

var $fh = require('fh-mbaas-api');
var request = require('request');

// // WARNING - DO NOT SHARE AWS KEYS!!!
var AWS = require('aws-sdk');
var AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
var AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
});
var s3 = new AWS.S3();
var AWS_BUCKET = process.env.AWS_BUCKET || 'replacewithyouruniques3bucket-in'

var PassThrough = require('stream').PassThrough;
//-------------------------------------------------------------
function uploadFromStreamToS3(submissionId, groupId) {
  var pass = new PassThrough();
  var key = submissionId + '-' + groupId + '.png';
  var params = {Bucket: AWS_BUCKET, Key: key, Body: pass};
  //var options = {partSize: 10 * 1024 * 1024, queueSize: 1};
  s3.upload(params, function(err, data) {
    console.log('sending data to S3 via AWS SDK to ', AWS_BUCKET + '/' + key);
    if (err) {
        console.log('ERROR ', err);
        return handleError(err);
    }
  });
  return pass;
}

var events = require('events');
var submissionEventListener = new events.EventEmitter();

//-------------------------------------------------------------
submissionEventListener.on('submissionComplete', function(params){
  var submissionId = params.submissionId;
  var submissionCompletedTimestamp = params.submissionCompletedTimestamp;
  console.log('****************************************');
  console.log('params', params);
  console.log('Submission with ID ' + submissionId + ' has completed at ' + submissionCompletedTimestamp);
  console.log('****************************************');
  
  var groupId = params.submission.formFields[0].fieldValues[0].groupId;
  console.log('fileGroupID', groupId);
  $fh.forms.getSubmissionFile({
    "_id": groupId
    }, function (err, fileStreamObject) {
        if (err) return handleError(err);
        console.log('got a file to send to S3:', fileStreamObject.stream.path);
        fileStreamObject.stream.pipe(uploadFromStreamToS3(submissionId, groupId));
        //fileStreamObject.stream.resume();  // this was in example code but is unnecessary due to pipe
    });
});

//-------------------------------------------------------------
$fh.forms.registerListener(submissionEventListener, function(err){
  if (err) return handleError(err);
  console.log("submissionEventListener has now been registered with the $fh.forms Cloud API. Any valid Forms Events will now emit.");
});