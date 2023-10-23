using PassingStreams.Pipelines;
using Panama.Core.Commands;
using Panama.Core.Entities;


namespace PassingStreams.Commands
{
    public class TransformStreamUpperCase: ICommand
    {
        public void Execute(Subject subject)
        {
            var container = subject.Context.DataGetSingle<Container>();

            container.AddPipeline(new TransformStreamUpperCasePipeline());
        }
    }
}