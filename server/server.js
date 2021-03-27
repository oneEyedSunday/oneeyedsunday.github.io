const http = require('http')
const loggers = require('./loggers');

const server = http.createServer((req, res) => {
    req.on('error', (err) => handleServerErrorResponse(res, JSON.stringify({ message: err.message })));
    if (req.method === 'POST') {
        streamBody(req, () => handleServerResponse(res, JSON.stringify({ message: 'Success' })), 'application/json');
    } else {
        return handleServerResponse(res, JSON.stringify({ message: 'noop' }));
    }
});

server.listen(9000, () => {
    const address = server.address();
    const formattedAddress = `${address.family} ${address.address}:${address.port}`;
    console.log(`Server up and listening at ${formattedAddress}`);
})

/**
 * 
 * @param {import('http').IncomingMessage} res 
 */
function handleServerResponse(res, payload, type = 'text/plain', code = 200) {
    res.writeHead(code, { 'Content-Type': type });
    res.write(payload);
    res.end();
}

function handleServerErrorResponse(res, payload) {
    return handleServerResponse(res, payload, 'application/json', 500);
}

/**
 * 
 * @param {import('http').IncomingMessage} req 
 * @param {Function} successCallBack
 */
function streamBody(req, successCallBack) {
    let processCount = 0;
    req.on('data', (chunk) => {
        const asString = chunk.toString();
        // For our server, we;d just parse all lines
        // do a little cleaning
        if (asString.startsWith('--------------------------') || asString.startsWith('Content-')) return
        // console.log(chunk.length, chunk);
        // console.log('Raw log line');
        loggers.bareConsole.debug(`Chunk size processed: ${chunk.length}`)
        processCount++;
    })

    req.on('end', () => {
        console.log(`Done reading request body in ${processCount} iterations`);
        successCallBack();
    });
}
