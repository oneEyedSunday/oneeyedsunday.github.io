using System.Collections.Generic;
using PassingStreams.Interfaces;
using Panama.Core.Entities;

namespace PassingStreams
{
    public class Container: IModel
    {
        public List<IStreamPipeline> Pipelines { get; set; }

        public Container() => Pipelines = new List<IStreamPipeline>();

        public Container AddPipeline(IStreamPipeline pipeline)
        {
            Pipelines.Add(pipeline);
            return this;
        }
    }
}
