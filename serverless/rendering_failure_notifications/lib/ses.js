const aws = require('aws-sdk');

const ses = new aws.SES({
    region: process.env.AWS_SES_REGION,
});

module.exports = ses;
