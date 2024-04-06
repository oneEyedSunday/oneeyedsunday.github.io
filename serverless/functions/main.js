const sesClient = require("../lib/ses");

const formatResponse = (body = {}, statusCode = 500) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Access-Control-Allow-Headers": "*",
  },
  body: JSON.stringify(body),
});

const getJsonEvent = ({ body }) => {
  return typeof body === "string" ? JSON.parse(body) : body;
};

const sendEmail = async (event) => {
  console.log("event is: ", getJsonEvent(event));

  const ConfigurationSetName = process.env.SES_CONFIG_SET_NAME;

  const { templateName, data = {}, sendTo } = getJsonEvent(event);
  let sendTemplateEmailParams = {
    Template: templateName,
    Destination: {
      ToAddresses: [sendTo],
    },
    Source: process.env.SOURCE_EMAIL_ADDRESS, // use the SES domain or email verified in your account
    TemplateData: JSON.stringify(data || {}),
  };

  if (ConfigurationSetName) {
    console.log(
      "Sending template email with config set: ",
      ConfigurationSetName
    );
    sendTemplateEmailParams = {
      ...sendTemplateEmailParams,
      ConfigurationSetName,
    };
  }
  const resp = await sesClient
    .sendTemplatedEmail(sendTemplateEmailParams)
    .promise();

  console.log("resp sending mail: ", resp);

  return { message: `email sent to ${sendTo}` };
};

const logSESFailureEvent = async (event) => {
  console.log("notification of failed ses template mail: ", event);
  return event;
};

const createTemplate = async (event) => {
  console.log("event is: ", getJsonEvent(event));
  const { templateName, body, subject } = getJsonEvent(event);
  const resp = await sesClient
    .createTemplate({
      Template: {
        TemplateName: templateName,
        HtmlPart: body,
        SubjectPart: subject,
      },
    })
    .promise();

  console.log("response from creating template: ", resp);

  return { message: `Successfully created template: ${templateName}` };
};

const listTemplates = async () => {
  const resp = await sesClient.listTemplates({ MaxItems: 10 }).promise();

  console.log("more templates exist: ", resp.NextToken);

  return resp.TemplatesMetadata || [];
};

const fnToLambdaHandler = (fn) => {
  console.log("wrapping fn to API Gateway response: ", fn);
  const wrappedFn = async (evt) => {
    // console.log("sending event: ", evt);
    try {
      const result = await fn(evt);

      return formatResponse(result, 200);
    } catch (err) {
      console.error("an error occured: ", err.message);
      return formatResponse(
        {
          error: true,
          message: "An error occured",
        },
        500
      );
    }
  };

  return wrappedFn;
};

module.exports = {
  sendEmail: fnToLambdaHandler(sendEmail),
  logSESFailureEvent,
  createTemplate,
  listTemplates,
};
