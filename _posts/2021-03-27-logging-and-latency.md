---
layout: post
title:  "Logging and Latency"
date:   2021-03-27 12:30:18 +0100
categories: blog
tags: perf observability
---
*This post is the product of this [thread](https://twitter.com/Idiakosesunday/status/1375151404839542784?s=20){:target="_blank"}*


Hello there, sometime last year I was dealing with large csv files (200k rows) and noticed performace dropped significantly when i added some logging into the row handler.

The general flow of the code is shown below:
{% highlight javascript %}
stream.on('data', () => {
    process();
    writeLog();
})
{% endhighlight %}

We want to look at the impact of logging on latency. We explore the following loggers
- Console calls
- Cloudwatch console transport
- Cloudwatch file transport
- Proxied calls to console.log with `Proxy`
- Piping output of server with `console.log` to `/dev/null`
- Piping output of server with `console.log` to a file



We'd first see raw response times for a demo bare metal http server ~(with expressJs)~
Then we'd run a ~benchmark with the [package](https://www.npmjs.com/package/benchmark){:target="_blank"}~

_~I could not figure out how to run the package and have decided to test the server via apache benchmark `ab`~_
_Passing in `POST` data to `ab` turned out to be cumbersome_
_I settled for [`hey`](https://github.com/rakyll/hey){:target="_blank"}_

{% gist e6b53cbd7380fc16b6655314c4774825 %}


### The Server
For our server, we use the functionalities provided by nodeJs's `http` package.
To read our post data, we just read the input chunk by chunk.
We could try to parse the body, check the boundaries as there could be more than one file.
But for brevity sakes, we'd assume every line is a csv entry after we check for the telltale boundary demarcations (`--------------------------`) and the content information `Content-Type`, `Content-Length` and perhaps `Content-Disposition`.
The original app I was involved in that sparked interest in this investigation, we used multer, then parsed the contents of the file by using `csv.Parse`. We then validated each line using the formidable `Joi`.
Looking back, I think we could have ditched multer, using `multipart` to parse the form data, as we had other fields in the payload.
(_right, enough nostalgia and introspection, ahead we go_)

On receiving a `POST` request, we invoke the `streamBody` function which does some processing.
When the data ends, we invoke a `successCallBack` passed into the function.
For deugging sakes, we save the amount of times we called the processing function.
We also define helper methods to return json / text responses.

### The Loggers
We begin our experimentation here, we define some loggers in the `loggers.js` file.
We use `winston` as it allows for different transports. We will experiment with the `File` and `Console` transports.
I also define two more loggers:
- `proxiedConsole` which uses the `Proxy` functionality to transform calls into `console.log`, `console.info` or `console.error`. 
- `bareConsole` which defines `log`, `info`, `debug` and `error` methods statically.


### The benchmarking tools
Since we are tracking latency, we'd let curl handle tracking the response times.

Using curl to track response times
{% highlight sh %}
curl -X POST http://localhost:9000 -H "authorization: xxxx" --form file='@filename'  -w "\n%{time_starttransfer}\n"
{% endhighlight %}


Using apache benchmark tool (`ab`)
{% highlight sh %}

ab -n 1000 -c 100 -p csv_parse_one.json -H 'content-type: application/json' -H 'authorization: $TOKEN' http://localhost:9000


{% endhighlight %}

Using hey
{% highlight sh %}
hey -m POST -n 1000 -c 10 -D server/fifty_k.csv  http://localhost:9000/ >> plain_console_log_10_50k.txt
{% endhighlight %}

All through yesterday, I spent time trying to prove my hypothesis, that logging had a noticeable impact on latency.
I had noticed this while building the app, we debugged validation errors after processing a line of data. Processing 2m records took 8s, removing the log line dropped down the response time to 1 - 2 seconds. Hence, here we are.

> As an aside, you really should not be processing 2m line csv files from the end user in a request-response cycle. Youre better off having the user provide a link to the file hosted in the cloud (Google Drive, Dropbox, S3 bucket (_if your users are savvy_)) then processing it in the background. Our use case had to cater for 200k lines of csv (which we handled in under 1 second).


### Results
Logging does take a toll on the overrall speed of your application, its work the cpu has to do. 
Logging is also usually sync, for nodejs, this is extra bad since we are limited to a single thread.
Our benchmarking setup was
- Create csv files with `X` lines using `gen-csv.sh` which generates a csv line entry by picking from some hardcoded data, optionally leaving empty entries to simulate a real life environment
- We run the benchmarking tool `hey` and dump the results in text files
- I'm running this on an 8 core CPU (hey by default uses all your cpu cores, an improvement over `ab`)
- `os.cpus()` lists this as my processor `'Intel(R) Core(TM) i7-4770HQ CPU @ 2.20GHz'`
- We run 1000 requests, with 10 concurrent requests


> `Hey`'s output lists `req.write`, `DNS+dialup` and `DNS-lookup` amongst the details, Im unsure if these entries are included in the `response time histogram` and overral summary.

{% highlight sh %}
hey -m POST -n 1000 -c 10 -D server/fifty_k.csv  http://localhost:9000/ >> plain_console_log_10_50k.txt
{% endhighlight %}


Initially, I used a file with 2 million csv entries and 10000 requests with concurrency set to 10.
Unfortunately, it took too long and I could not notice any difference, so I switched to the aforementioned configuration.

* Winston console transport (enriched with timestamps) 115.23 requests/sec
* Using `console.log` at call site directly 129.52 requests/sec
* Plain console calls (_bareConsole_) 137 requests/sec
* Log calls proxied (_proxiedConsole_) to `console.(log|error|info)` 140 requests/sec
* Winston file transport 232 requests/sec
* No logs in processing func (but server startup and iteration counts get logged) 290.12 requests/sec
* Using `format(xxxx, ...args)` piped to `/dev/null` 304.7 requests/sec
* Using `format(xxxx, ...args)` piped to a file 304.94 requests/sec

The benchmarks are provided [here](https://github.com/oneEyedSunday/oneeyedsunday.github.io/commit/b44dd3be2148bb2eafcdf7441abf7545296149c8){:target="_blank"}


### Making sense of the results
The major surprise for me was that using the file transport performed faster, I'm so surprised I had to run the benchmark again before completing this post.
While Ive not looked at the code, I can only assume the eventual call to write to the file may be:
- buffered
- not calling flush
- definitely not sync


Overall, my case is made by comparing the throughput of just piping the output of the app to a file or stream (as 12 Factor App suggests) against the result of just logging a few lines to the console (which is sync and im assuming must wait for an `ack` of some sort).
*304.94* v *140* is quite staggering. 
Thats more than double the throughput without doing anything
Also, just piping (leaving the OS to handle) the logs as against very little logging also has some difference in throughput
*304.94* v *290.12*

> Now, I want to know what the default behavior is for docker when you call `console.*`, pipe to OS?

Something else I noticed was that the chunk size and hence, number of iterations needed to process the file flunctuated by load and log use.
In summary, check your hot path folks, don't log what you don't need.
Logging comes at a cost.

### Industry recommendations
The [Twelve Factor App](https://12factor.net/){:target="_blank"} in their entry on [logs](https://12factor.net/logs){:target="_blank"} recommend that an application
> should not attempt to write to or manage logfiles. Instead, each running process writes its event stream, unbuffered, to stdout. During local development, the developer will view this stream in the foreground of their terminal to observe the app’s behavior.

> In staging or production deploys, each process’ stream will be captured by the execution environment, collated together with all other streams from the app, and routed to one or more final destinations for viewing and long-term archival. These archival destinations are not visible to or configurable by the app, and instead are completely managed by the execution environment.



### How to send post data with Apache Benchmark tool
- http://www.adityamooley.net/2011/03/21/multipart-posting-with-apache-benchmark/
- https://stackoverflow.com/questions/12584998/apache-benchmark-multipart-form-data

