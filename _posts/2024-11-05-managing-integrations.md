---
layout: post
title:  "Managing large Integrations"
date:   2025-11-05 00:35:00 +0100
categories: blog
tags:
- integrations
- software
---

## A Question, an edited response

I was asked recently to `describe my integration experience with platforms (think Trello, Google Analytics or similar), and how I've managed the challenges of scaling integrations across a wide ecosystem`.

What follows is my response, with the benefit of hours of editing and formatting, I hope you (and future me) find it helpful.

Hello there, I will summarise my experiences with integrations below. I find the following to be true regardless of what integration you are undergoing, i itemize them below and go into some detail later in the article.

- Need a way to deal with retries to keep a semblance of idempotency
- Async where possible with web hooks
- Use a wrapper where possible
- Need to set up for easier unit testing (core logic) and integration testing (replacing clients for instance)
- Beware of limits: timeouts and http client exhaustion if applicable (had this happen in a net core application), set limits yourself
- Validate data yourself before pushing downstream
- Establish some contract or anti corruption layer
- Rotating keys, (the possibility of should be supported by abstractions), or just segregating users maybe by geographical area
- Tests as a way to replay bugs, validate assumptions
- Retries, failures in queuing systems and Dead Letter Queues?

As a couple of things are common between them, be it exposing an API to interface with a Selenium farm, workflows powered by Trello : external resources, managing access, resource limits, type of response, testing and monitoring.

## Encapsulate your external resources
As much as we want to be fast and pragmatic, I have found that encapsulating to quite speed things up and also lets you focus on your logic and not necessarily design your system to fit a provider. 

```galang
interface CanProvideWorkflowMechanisms  {
  proceedTo(ctx context.Context, boardId, cardId, toCardId string) (error)
}

```

The above is a sample encapsulation, but even this is already being forced to look like say a Trello integration, what happens if this workflow becomes provided by a Miro board? 
cardId may become irrelevant. 

```golang

struct ProceedOptions  {
   toCardId *string
   someOtherPropertyRequiredByOtherProvider *string  
}

interface CanProvideWorkflowMechanisms {
  proceedTo (ctx context.Context, from, to string, options ProceedOptions) (error)
}


```
Another benefit of encapsulating here is that it becomes. A lot easier to test our integration and to also fake certain scenarios (more on this in the [#Testing section](#testing))

Using a common wrapper for http clients, grapnel clients and the likes is also very helpful.

Another benefit of this is it provides an opportunity to introduce an anti corruption layer to your external providers’ inputs and outputs

## Async where possible
- Web hooks
Prefer the webhooks to polling. Most integrations provide a way to either receive webhooks or ingest data via a queue (if there are partner integrations like Shopify with AWS)
- Tradeoffs
Webhooks (and distributed systems) do introduce some tradeoffs, availability is often the best attribute of any system.
Also retries, idempotency guarantees (where applicable, could be managed in code) and failure conditions should be provided for, the latter perhaps by setting up Dead Letter Queues (DLQs) and handling them.
## Beware of limits
- Rate limits
External providers will often have limits (resources are finite) these limits should always be taken into consideration proactively. Some strategies I’ve found useful include enforcing rate limits on my app myself (which may not always match the rate limits of the external provider, for instance if you have just one client on the provider but use said client to manage all of your customers, rate limiting M customers to one key may prove to not be sustainable). Alternatively where possible it may prove expedient to force some flows into queues to better manage resources.
- Resource exhaustion (an example of the http client)
Another way limits may present themselves may be on hardware. Let us explore some examples:
- Naive usage of Promise.all() for unbounded inputs
- Http Client exhaustion (see https://learn.microsoft.com/en-us/aspnet/core/fundamentals/http-requests?view=aspnetcore-5.0#httpclient-and-lifetime-management-1)
In an app I was part of the team building and managing (using dotNET Core) we ran into resource exhaustion because we naively created http clients in every class that needed it.

```cs

// dependency injection
services.AddHttpClient();

```


```cs
public abstract class AppHttpClient
{
  protected readonly HttpClient Http;
  
  protected AppHttpClient(IHttpClientFactory client, string baseRoute)
  {

    BaseRoute = baseRoute;
    Http = client.CreateClient();
  }

  protected async Task<TReturn> GetAsync<TReturn>(string relativeUri, AllowedHeaders headers, CancellationToken token = default)
  {
    HttpResponseMessage res = await Http.GetWithHeadersAsync($"{BaseRoute}/{relativeUri}", headers, token);
  }

}
```

The snippet above is an approximation of our initial solution, we thought this was good because it prevented us initiating the client in each subclass (we had a subclass for different services).

```cs

// dependency injection
services.AddHttpClient();

// see: https://docs.microsoft.com/en-us/dotnet/architecture/microservices/implement-resilient-applications/use-httpclientfactory-to-implement-resilient-http-requests
services.AddHttpClient<ISomeService, SomeService>(client =>
{
    client.BaseAddress = new Uri(Configuration.GetValue<string>("ASPNETCORE_YOUR_Api_Url"));
});


var httpConfig = new HttpConfig();
httpConfig.someBaseUri = Environment.GetEnvironmentVariable("ASPNETCORE_YOUR_Api_Url");

```

```cs

public abstract class AppHttpClient
{
  protected readonly HttpClient Http;
  
  protected AppHttpClient(HttpClient _http)
  {
    Http = _http;
  }

 protected async Task<TReturn> GetAsync<TReturn>(string relativeUri, AllowedHeaders headers, CancellationToken token = default)
  {
    // client is set up correctly via dependency injection
    HttpResponseMessage res = await Http.GetWithHeadersAsync(relativeUri, headers, token);
  }
}


```

The above snippet shows how we refactored to be in line with best practices (more info in the learn.microsoft.com article linked earlier in this section).
We have avoided the subtle problem of socket exhaustion by using the HttpClientFactory which keeps its own pool of client handlers recycling periodically.

## Handling keys

The possibility or rotating keys should be supported by abstractions.
In the case of multiple keys perhaps to separate users (maybe by geographical area or tiers) should be supported

```typescript

class XProviderImpl {

private getAuthenticationInformation(int customerId, TCustomerOpts customerOpts) {
  return {
    clientId: ‘’,
    clientSecret: ‘’,
    region: customerOpts.region
  };
}

triggerEffect(int customerId, TBody data, TCustomerOpts customerOpts) {

  // ...
  return client.make(getAuthenticationInformation(customerId, customerOpts)).do();
  };
}

```

Take for instance, we need to perhaps due to legal reasons process some customer information in certain data regions, or use a different account to process requests for our customers of a higher tier. This should also be provided for.

Above I have presented pseudocode to represent how this may look like.


## Testing

Code should be laid out in a way to ease unit testing core logic and integration testing (replacing http / graphGL clients for instance).
Testing should also be set up to achieve the following goals:

- Replay bugs
Once we had some promotion code set up. Some weeks later business found some funny behaviour, someone had a cart filled with lots of domains (under promotion).
The account was blocked. We couldn’t quite reproduce the issue at first glance (we had unit and integration tests covering the flow). Eventually the Product Owner (PO) was able to replicate this, but we were unsure if it was logic related or a race condition. We replicated the POs clicks in an integration test named `Test_PromotionsCannotBeHoarded`, wrote test cases that failed, fixed the code and eventually the tests passed. Moral of the story, validate bugs via test cases, leave the test cases in the code base to also serve as invariants and documentation.
- Validate assumptions (with regards to how your system handles responses from external providers)
Testing should also be structured to validate assumptions on how your system handles different types of responses. Being able to replace the clients or wrappers for your integrations is an easy way to ensure you can recreate scenarios where say your provider replies with a 429 or a 400
- Regression testing
## Monitoring
## Misc

Set timeouts on your clients and other sane defaults



