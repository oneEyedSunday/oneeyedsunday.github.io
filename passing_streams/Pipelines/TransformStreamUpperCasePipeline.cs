using PassingStreams.Interfaces;
using System;
using System.IO;
using System.IO.Pipelines;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace PassingStreams.Pipelines
{
    public class TransformStreamUpperCasePipeline: IStreamPipeline
    {
        public async Task Stream(Pipe pipe, CancellationTokenSource cancellationTokenSource)
        {
            if (pipe == null)
            {
                cancellationTokenSource.Cancel();
                throw new ArgumentNullException(
                    message: $"[{nameof(pipe)}] is not provided."
                    , paramName: nameof(pipe));
            }


            using(var stream = new StreamReader(pipe.Reader.AsStream()))
            using (var writeStream = new StreamWriter(new MemoryStream()))
            {
                while (!stream.EndOfStream && !cancellationTokenSource.IsCancellationRequested)
                {
                    var r = await stream.ReadLineAsync();
                    // var b = Encoding.ASCII.GetByteCount(r);
                    await writeStream.WriteLineAsync(r.ToUpper().AsMemory(), cancellationTokenSource.Token);
                    // pipe.Writer.Advance(b);
                }
                // basically run transform func
                // then write to reader
                // while (true)
                // {
                //     Memory<byte> buffer = pipe.Writer.GetMemory(sizeHint: 1);
                //     int bytes = await stream.ReadAsync(buffer, cancellationTokenSource.Token);
                //     pipe.Writer.Advance(bytes);

                //     if (bytes == 0)
                //     {
                //         // source EOF
                //         break;
                //     }

                //     var flush = await pipe.Writer.FlushAsync(cancellationTokenSource.Token);
                //     if (flush.IsCompleted || flush.IsCanceled)
                //     {
                //         break;
                //     }
                // }
                // await writeStream.FlushAsync();
                // pipe.Writer.Complete();
            }
        }
    }
}
