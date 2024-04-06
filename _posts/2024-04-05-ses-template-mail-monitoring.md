---
layout: post
title:  "Monitoring AWS SES Templated mail failures"
date:   2024-04-05 12:35:00 +0100
categories: blog
tags:
- aws
- ses
- serverless
---

## Problem Statement

You are sending transactional emails with the aid of the SES Template Email functionality. You run some tests, but there is a problem, you are not receiving any mails: you check your logs, no errors. 

I found myself in this scenario some time back. I had to go back to the developer guide, and read the fine print. At the very [top](https://docs.aws.amazon.com/ses/latest/dg/send-personalized-email-api.html#send-personalized-email-set-up-notifications) of the page, it recommends you set up notifications for invalid personalization content. This post will walk you through setting up such notifications via email and lambda.

## Setting up

I spent quite some time trying to setup this demo entirely with the [serverless framework](https://www.serverless.com/) and I was quite surprised there was no support for managing some SES settings from serverless. That said, i got some great help setting up from [this article](https://medium.com/appgambit/serverless-email-service-with-aws-ses-and-templates-139f56cf539c). The final code for this walkthrough can be [found on github.](https://github.com/oneEyedSunday/oneeyedsunday.github.io/tree/master/serverless/rendering_failure_notifications)

## Wiring up the Notifications

The notifications need a couple of things:
1. First, a Configuration set, these add extra functionality to your emails, and in this case we will be concerned with `RenderingFailures`.
2. An SNS Topic to route messages from the configuration set above.
3. The SNS Topic can have lots of subscriptions (SQS, Email, Lambda, etc), but in this case we will use the Lambda and Email protocols.
4. Updating your email sending code to use the Configuration set from `1` above


### Creating the SNS Topic

We will create an SNS Topic which will be the destination for the notifications. 
We set up with help from the [serverless guides](
https://www.serverless.com/framework/docs-providers-aws-events-sns)

```
resources:
  Resources:
    SESRenderingTemplateFailureTopic:
      Type: AWS::SNS::Topic
      Properties:
        TopicName: SESRenderingFailureTopic
```

### Creating the SNS Topic Subscriptions

We will create two subscriptions for the SNS Topic. I find it easier during development to have the notifications come through via email. You will need to verify this subscription as AWS will send a confirmation email, which you must acknowleged by clicking on the confirmation link to confirm your subscription.

You can hardcode your email address when you run the template, replacing `Endpoint: foo@example.com` with your email address.

```
resources:
  Resources:
    SESRenderingTemplateFailureEmailSubscription:
      Type: AWS::SNS::Subscription
      Properties:
        Endpoint: foo@example.com
        Protocol: "email"
        TopicArn: !Ref SESRenderingTemplateFailureTopic

```

I have also created a lambda subscription which is valuable in more formal arrangement as you can then have a more central way of logging these errors.

```
functions:
  monitorFailuresFn:
    handler: ...
    events:
      - sns:
          arn: !Ref SESRenderingTemplateFailureTopic
          topicName: SESRenderingFailureTopic
```

### Creating the Configuration Set

As of writing this article, I couldnt find a way to wire this up with the serverless framework so we will do this on the AWS console.
[Create a configuration set](https://us-east-1.console.aws.amazon.com/ses/home?region=us-east-1#/configuration-sets/create) specifying a suitable name

![AWS Console view of creating a configuration set](/media/create_config_set.png "Create a Configuration Set")

Next, switch to the `Event Destinations` tab and Add a new destination.

![AWS Console view of adding an event destination to the Config set](/media/event_destination.png "Adding an event destination to the Configuration Set")


In `Select Event Types` tick, `Rendering Failures`

![AWS Console view of selecting event types](/media/select_event_types.png "Selecting Event types to notify")


Next, in `Specify Destination` select `Amazon SNS` enter a suitable destination name, then select your SNS Topic (created earlier)

![AWS Console view of specifying destination](/media/specify_destination.png "Specifying destination")


### Specify Configuration set

One thing is missing, we have to instruct ses to use our configuration set when sending the templated email.
We do that by adding the configuration set name to the `sendTemplateEmail` parameters like so

```javascript
const sendTemplateEmailParams = {
    Template: templateName,
    Destination: {
      ToAddresses: [sendTo],
    },
    Source: process.env.SOURCE_EMAIL_ADDRESS, // use the SES domain or email verified in your account
    TemplateData: JSON.stringify(data || {}),
    ConfigurationSetName: '<your config set name>'
  };

  const resp = await sesClient
    .sendTemplatedEmail(sendTemplateEmailParams)
    .promise();
```

### Testing it all out

A small env file has been added, which is quite helpful to potentially inject sensitive values.
To test this all out, ive added a few more lambda functions.
You can start the app locally via the serverless offline plugin.

```sh
./node_modules/serverless/bin/serverless.js offline start
```


- `createTemplate` which is a small api endpoint to help create templates, Can be triggered via 
```sh
curl -X POST http://localhost:3000/mailing/templates -H "Content-Type: application/json" -d '{"templateName":"DummyTemplate", "subject": "SES Rendering Failure Monitoring", "body": "We are here for {{name}}" }'
```

- `getTemplates` which is a small api endpoint to help validate available templeates. Can be triggered via 
```sh
curl -X GET http://localhost:3000/mailing/templates 
```

- `consume` which is a small api endpoint to send an email. Can be triggered via 
```sh
curl -X POST http://localhost:3000/mailing/send -H "Content-Type: application/json" -d '{"templateName":"DummyTemplate", "sendTo": "your_email@example.com" }'
```

You should get an email from AWS like so

```
{"eventType":"Rendering Failure","mail":{"timestamp":"2024-04-06T13:04:00.928Z","source":"your_email@example.com","sourceArn":"arn:aws:ses:us-east-1:*********:identity/your_email@example.com","sendingAccountId":"*********","messageId":"0100018eb3823d0d-18c8f590-c453-4a7a-b668-0bdd51df78d3-000000","destination":["your_email@example.com"],"headersTruncated":false,"tags":{"ses:source-tls-version":["TLSv1.3"],"ses:operation":["SendTemplatedEmail"],"ses:configuration-set":["EmailFailures"],"ses:source-ip":["89.154.69.34"],"ses:from-domain":["example.com"],"ses:caller-identity":["root"]}},"failure":{"errorMessage":"Attribute 'name' is not present in the rendering data.","templateName":"DummyTemplate"}}
```

And your lambda should also get an event with similar payload.

The full serverless template is given below:

```
service: sesmonitoring
frameworkVersion: '3'

plugins:
  - serverless-offline

provider:
  name: aws
  runtime: nodejs16.x
  region: 'us-east-1'
  stage: ${opt:stage, 'dev'}
  environment:
    AWS_SDK_LOAD_CONFIG: '1'
    AWS_SES_REGION: ${aws:region}
    DEFAULT_TO_ADDRESS: ${file(env.yml):DEFAULT_TO_ADDRESS}
    SOURCE_EMAIL_ADDRESS: ${file(env.yml):SOURCE_EMAIL_ADDRESS}
  iamRoleStatements:
    - Effect: "Allow"
      Action:
        - "ses:SendTemplateEmail"
        - "ses:CreateTemplate"
        - "ses:ListTemplates"
      Resource: "*"


resources:
  Resources:
    SESRenderingTemplateFailureTopic:
      Type: AWS::SNS::Topic
      Properties:
        TopicName: SESRenderingFailureTopic
    SESRenderingTemplateFailureEmailSubscription:
      Type: AWS::SNS::Subscription
      Properties:
        Endpoint: foo@example.com
        Protocol: "email"
        TopicArn: !Ref SESRenderingTemplateFailureTopic

functions:
  monitorFailuresFn:
    handler: functions/main.logSESFailureEvent
    events:
      - sns:
          arn: !Ref SESRenderingTemplateFailureTopic
          topicName: SESRenderingFailureTopic
  createTemplate:
    handler: functions/main.createTemplate
    events:
      - httpApi:
          path: /mailing/templates
          method: post
    timeout: 15
  getTemplates:
    handler: functions/main.listTemplates
    events:
      - httpApi:
          path: /mailing/templates
          method: get
    timeout: 5
  consume:
    handler: functions/main.sendEmail
    environment: ${file(env.yml)}
    events:
      - httpApi:
          path: /mailing/send
          method: post
    timeout: 10
    

```
