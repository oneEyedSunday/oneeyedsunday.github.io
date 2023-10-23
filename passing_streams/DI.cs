using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Autofac;
using Autofac.Features.AttributeFilters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NLog;
using Panama.Core.Commands;
using Panama.Core.IoC;
using Panama.Core.IoC.Autofac;
using Panama.Core.Logger;
using PassingStreams.UseCases;

namespace PassingStreams.DependencyInjection
{
    static class DI
    {
        public static IContainer BuildContainer()
        {
            var config = LoadConfiguration();
            var builder = new ContainerBuilder().ConfigurePanama(config);
            builder.RegisterType<WritingStuff>();
            var kernel = builder.Build();
            ServiceLocator.SetLocator(new AutofacServiceLocator(kernel));


            var nlogConfig = new NLog.Config.LoggingConfiguration();
            var logconsole = new NLog.Targets.ConsoleTarget("console");
            nlogConfig.AddRule(LogLevel.Info, LogLevel.Fatal, logconsole);
            NLog.LogManager.Configuration = nlogConfig;
            
            return kernel;
        }

        private static void ConfigureMain(this IServiceCollection services, IConfiguration Configuration)
        {
            services.AddSingleton(Configuration);

            // required to run the application
            services.AddTransient<WritingStuff>();
        }

        private static IConfiguration LoadConfiguration()
        {
            var builder = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);

            return builder.Build();
        }

        private static ContainerBuilder ConfigurePanama(this ContainerBuilder builder, IConfiguration Configuration)
        {
            var assemblies = new List<Assembly>();

            assemblies.Add(Assembly.GetExecutingAssembly());
            assemblies.AddRange(AppDomain.CurrentDomain.GetAssemblies());
            assemblies.AddRange(Assembly
                .GetExecutingAssembly()
                .GetReferencedAssemblies()
                .Select(x => Assembly.Load(x))
                .ToList());

            var domain = assemblies.ToArray();

            builder.RegisterType<Panama.Core.Logger.NLog>().As<ILog>();

            //Register all commands -- singletons
            builder.RegisterAssemblyTypes(domain)
                   .Where(t => t.IsAssignableTo<ICommand>())
                   .Named<ICommand>(t => t.Name)
                   .AsImplementedInterfaces()
                   .SingleInstance()
                   .WithAttributeFiltering();

            //Register all async commands -- singletons
            builder.RegisterAssemblyTypes(domain)
                   .Where(t => t.IsAssignableTo<ICommandAsync>())
                   .Named<ICommandAsync>(t => t.Name)
                   .AsImplementedInterfaces()
                   .SingleInstance()
                   .WithAttributeFiltering();

            return builder;
        }
    }
}