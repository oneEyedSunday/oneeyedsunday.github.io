---
layout: post
title:  "Handling streams in Command-Oriented Frameworks"
date:   2021-12-04 17:30:00 +0100
categories: blog
tags:
- netcore
- streams
- experiments
---

Hey there, recently I had to refactor some parts of a code base using [Panama](https://github.com/mrogunlana/Panama.Core). We had been passing raw bytes around from streams, as the streams themselves were getting disposed and the threaded nature of the framework didn't quite make for easy passing around of the streams themselves. 

Here's a contrived example of the problem. Say we wanted to fetch an image from S3 (or anywhere really), then convert/resize said image, this is how we'd currently handle such.

```csharp
var result = new Handler(ServiceLocator.Current)
                .Add(new KeyValuePair("Key", "Image_540.png"))
                .Add(new KeyValuePair("Bucket", "foogazi"))
                .Add(new KeyValuePair("Dimension", 70))
                .Command<GetObjectFromAws>()
                .Command<ResizeImageBasedOnDimensions>()
                .InvokeAsync()
```

Ideally, we'd want `GetObjectFromAws` to get the object (in this case an image) as a stream, then pass it on so other commands (in our case `ResizeImageBasedOnDimensions`) on the chain can access it. The problem with this is the stream gets disposed of (something to do with the end of the thread, as Panama runs commands in different threads). 

### How we handled this
Since we were relatively not serving a lot of these requests, we decided to add this to technical debt and move quickly. We resolved to fetch the object, convert to bytes array via an extension, then pass along said bytes.

{% gist fa7178aa6110482dd1728bfab7bef179#file-awss3clientextensions-cs %}

{% gist fa7178aa6110482dd1728bfab7bef179#file-getobjectfromawsasbytes-cs %}

While this works, it's not exactly memory-effective and defeats the purpose of having streams in the first place.

### The proposed solution
So we want a way to access a stream regardless of the threaded environment. 
The team found [pipelines](https://devblogs.microsoft.com/dotnet/system-io-pipelines-high-performance-io-in-net/) an interesting proposition, we also found some very valuable demos by the [community](https://github.com/tulis/system-io-pipelines-demo/blob/master/src/SystemIoPipelinesDemo/SystemIoPipelinesDemo/Program.cs) which we based our trials on.

### Bringing this all together in Panama
Let's see a trivial example at work, suppose we wanted to transform a stream of strings from lowercase to uppercase, then save in another location. How would this look like in Panama?
We'd leverage some sample stream pipelines from the very helpful [Tulis](https://github.com/tulis)

*Sidenote, Tulis apparently means to write, fittingly this example is about writing stuff*

```csharp
_ = await new Handler(ServiceLocator.Current)
    .Add(new KeyValuePair("InputPath", ""))
    .Add(new KeyValuePair("OutputPath", ""))
    .Command<ReadFileStreamPipeline>()
    .Command<TransformShiiii>()
    .Command<WriteFileStreamPipeline>()
    .InvokeAsync();
```

Here is how consuming the stream will look like

```csharp
var container = result.DataGetSingle<Container>();
var pipe = new System.IO.Pipelines.Pipe();

foreach (var stage in container.Pipelines)
    await stage.Stream(pipe, cts);

var stream = pipe.Reader.AsStream();
```

We pass the pipe into every stage in the pipeline and handle the resulting stream.

```csharp
_logger.LogDebug<WritingStuff>($"Read stream length is: {stream.Length}");

```

### Addedum

So, I had this post in my drafts for about a year and half. Mostly because 
- it didnt work out as planned (a failed experiment is an experiment nonetheless)
- I tried getting some help, another set of eyes to look at this.

Thankfull @NikiforovAll took a look and confirmed my suspicions, wrong use case because of the multi threaded nature of Panama. You can find his [diagnosis here](https://github.com/oneEyedSunday/oneeyedsunday.github.io/pull/9#pullrequestreview-842571146)

