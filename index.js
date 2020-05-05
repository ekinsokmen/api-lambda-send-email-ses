const AWS = require('aws-sdk'),
  SES = new AWS.SES(),
  destinationMapper = require('./destination-mapper.js'),
  processResponse = require('./process-response.js'),
  FROM_EMAIL = process.env.FROM_EMAIL,
  UTF8CHARSET = 'UTF-8';

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') {
    return processResponse(true);
  }

  if (!event.body) {
    return processResponse(true, 'Please specify email parameters: toEmails, subject, and message ', 400);
  }
  const emailData = JSON.parse(event.body);

  emailData.toEmails = destinationMapper(emailData.toEmails);
  emailData.ccEmails = destinationMapper(emailData.ccEmails);

  if (!emailData.toEmails || !Array.isArray(emailData.toEmails) || !emailData.subject || !emailData.message) {
    return processResponse(true, 'Please specify email parameters: toEmails, subject and message', 400);
  }

  const destination = {
    ToAddresses: emailData.toEmails
  }

  if (emailData.ccEmails) {
    destination.CcAddresses = emailData.ccEmails;
  }

  const body = (emailData.message && isHTML(emailData.message)) ?
    { Html: { Charset: UTF8CHARSET, Data: emailData.message } } :
    { Text: { Charset: UTF8CHARSET, Data: emailData.message } };

  const emailParams = {
    Destination: destination,
    Message: {
      Body: body,
      Subject: {
        Charset: UTF8CHARSET,
        Data: emailData.subject
      }
    },
    Source: FROM_EMAIL
  };

  if (emailData.replyToEmails && Array.isArray(emailData.replyToEmails)) {
    emailParams.ReplyToAddresses = emailData.replyToEmails;
  }

  try {
    await SES.sendEmail(emailParams).promise();
    return processResponse(true);
  } catch (err) {
    console.error(err, err.stack);
    const errorResponse = `Error: Execution update, caused a SES error, please look at your logs.`;
    return processResponse(true, errorResponse, 500);
  }
};

function isHTML(value) {
  value = value.trim();
  return value.startsWith('<') && value.endsWith('>') &&
    (value.includes('<body') || value.includes('<div') || value.includes('<s') || value.includes('<h') || value.includes('<p'));
}
