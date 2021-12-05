using System.Threading.Tasks;
using Autofac;
using PassingStreams.DependencyInjection;
using PassingStreams.UseCases;

namespace PassingStreams
{
    class Program
    {
        static Task Main(string[] args)
        {
            var services = DI.BuildContainer();
            return services.Resolve<WritingStuff>().Run();
        }
    }
}
