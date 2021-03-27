const Winston = require('winston')

function createLogger(transport) {
    return Winston.createLogger({
        transports: [transport],
        level: process.env.LOG_LEVEL || 'silly'
    })
}



module.exports = {
    bareConsole: new Proxy({}, {
        get: (_, p) => {
            if(['info', 'error'].includes(p)) return console[p];
            return console.log;
        }
    }),

    winstonConsole: createLogger(new Winston.transports.Console({
        format: Winston.format.combine(
          Winston.format.timestamp(),
          Winston.format.colorize(),
          Winston.format.printf(info =>
            `${info.level}[${info.label || info.timestamp}]: ${info.message}`)
        )
      })),

      winstonFile: createLogger(new Winston.transports.File({
        filename: 'demo.log',
        dirname: __dirname
    }))
}