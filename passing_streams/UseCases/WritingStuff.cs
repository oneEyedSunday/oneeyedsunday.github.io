using System.Threading.Tasks;
using Panama.Core.Commands;
using Panama.Core.Entities;
using Panama.Core.IoC;
using System;
using PassingStreams.Commands;
using PassingStreams.Interfaces;
using System.Linq;
using System.Threading;
using Panama.Core.Logger;

namespace PassingStreams.UseCases
{
    public class WritingStuff: IUseCase
    {
        private readonly ILog _logger;
        public WritingStuff(ILog logger)
        {
            _logger = logger;
        }

        public async Task Run()
        {
            var cts = new CancellationTokenSource();
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var result = await new Handler(ServiceLocator.Current)
                .Add(cts.Token)
                .Add(new KeyValuePair("InputPath", "text.txt"))
                .Add(new KeyValuePair("OutputPath", "written.txt"))
                .Command<CreatePipelineContainer>()
                // get
                .Command<GetObjectFromInputPath>()
                // alter stream
                // .Command<TransformWords>()
                // write
                // .Command<WriteStreamToOutputPath>()
                .InvokeAsync();

            _logger.LogInformation<WritingStuff>($"Result is {result.Success}");

            if (!result.Success) throw new Exception("Foogazi");


            // Everything after here can be moved inside a command
            var container = result.DataGetSingle<Container>();
            // TODO the streaming can be moved inside the command chain
            var pipe = new System.IO.Pipelines.Pipe();


            // needs an error handler here
            // since cancellation will most likely happen here
            await container.Pipelines
                .FirstOrDefault()
                .Stream(pipe, cts);

            var stream = pipe.Reader.AsStream();

            // in this case read from the WriteStream as we want the transformation???
            _logger.LogDebug<WritingStuff>($"Read stream length is: {stream.Length}");

        }
    }
}
