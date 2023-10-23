using PassingStreams.Pipelines;
using Panama.Core.Commands;
using Panama.Core.Entities;

namespace PassingStreams.Commands
{
    public class WriteStreamToOutputPath: ICommand
    {
        public void Execute(Subject subject)
        {
            var path = subject.Context.KvpGetSingle<string>("OutputPath");
            var container = subject.Context.DataGetSingle<Container>();

            container.AddPipeline(new WriteFileStreamPipeline(path));
        }
    }
}