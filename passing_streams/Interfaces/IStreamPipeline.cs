using System.IO.Pipelines;
using System.Threading;
using System.Threading.Tasks;

namespace PassingStreams.Interfaces
{
    public interface IStreamPipeline
    {
        Task Stream(Pipe pipe, CancellationTokenSource cancellationTokenSource);
    }
}