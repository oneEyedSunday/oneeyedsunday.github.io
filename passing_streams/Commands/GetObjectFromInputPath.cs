using PassingStreams.Pipelines;
using Panama.Core.Commands;
using Panama.Core.Entities;


namespace PassingStreams.Commands
{
    public class GetObjectFromInputPath: ICommand
    {
        public void Execute(Subject subject)
        {
            var path = subject.Context.KvpGetSingle<string>("InputPath");
            var container = subject.Context.DataGetSingle<Container>();

            container.AddPipeline(new ReadFileStreamPipeline(path));
        }
    }
}