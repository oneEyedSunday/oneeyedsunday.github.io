using Panama.Core.Commands;

namespace PassingStreams.Commands
{
    class CreatePipelineContainer: ICommand
    {
        public void Execute(Subject subject)
        {
            subject.Context.Add(new Container());
        }
    }
}