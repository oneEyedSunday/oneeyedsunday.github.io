---
layout: post
title:  "Logging and Latency"
date:   2021-03-27 12:30:18 +0100
categories: blog
tags: perf observability
---
*This post is the product of this [thread](https://twitter.com/Idiakosesunday/status/1375151404839542784?s=20)*


Hello there, sometime last year I was dealing with largish csv files (200k rows) and noticed performace dropped significantly when i added some logging into the row handler.

The general flow of the code is shown below:
{% highlight javascript %}
stream.on('data', () => {
    process();
    writeLog();
})
{% endhighlight %}

We want to look at the impact of logging on latency. We explore the following loggers
- bare console calls
- Cloudwatch console transport
- Cloudwatch file transport
- Demo buffered transport


{% gist e6b53cbd7380fc16b6655314c4774825 %}




We'd first see raw response times for a demo bare metal http server (with expressJs)
Then we'd run a ~benchmark with the [package](https://www.npmjs.com/package/benchmark)~

_I could not figure out how to run the package and have decided to test the server via apache benchmark `ab`_

Since we are tracking latency, we'd let curl handle checking the response times

{% highlight sh %}
curl -X POST http://localhost:9000/api/v1/ -H "authorization: xxxx" --form file='@filename'  -w "\n%{time_starttransfer}\n"
{% endhighlight %}

How to send post data with ab 
http://www.adityamooley.net/2011/03/21/multipart-posting-with-apache-benchmark/
https://stackoverflow.com/questions/12584998/apache-benchmark-multipart-form-data

{% highlight sh %}

ab -n 1000 -c 100 -p csv_parse_one.json -H 'content-type: application/json' -H 'authorization: $TOKEN' http://localhost:8004/api/v1/contact/import


{% endhighlight %}
