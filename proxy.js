sys = require('sys');
HTTP = require('http');
URL = require ('url');
HTML5 = require('html5');
var events = require('events');
var buffer = require('buffer');

handlers = {
	"text/html": function(inr, outr) {
		outr.writeHead(inr.statusCode, inr.headers);
		var p = new HTML5.Parser(inr);
		//inr.addListener('data', function(chunk) { outr.write(chunk, 'binary'); });
		var bw = new events.EventEmitter();
		var buf = new buffer.Buffer(1400);
		var s = 0;
		bw.addListener('data', function(data) {
			if(data.length == 0) return;
			while(s + data.length > buf.length) {
				buf.write(data.slice(0, data.length - s), 'binary', s);
				outr.write(buf, 'binary');
				data = data.slice(data.length - s);
				s = 0;
			}
			buf.write(data, 'binary', s);
		});
		inr.addListener('end', function() { if(s > 0) outr.write(buf.slice(0, s), 'binary'); outr.end(); });
	},
	'default': function(inr, outr) {
		outr.writeHead(inr.statusCode, inr.headers);
		inr.addListener('data', function(chunk) { outr.write(chunk, 'binary'); });
		inr.addListener('end', function() { outr.end(); });
	}
}

HTTP.createServer(function(inreq,outresp) {
	var url = URL.parse(inreq.url);
	sys.puts(inreq.method + " for " + url.hostname + " on port " + (url.port || 80) + " with path " + (url.pathname || '/'));
	var client = HTTP.createClient(url.port || 80, url.hostname);
	if(inreq.headers['accept-encoding']) delete inreq.headers['accept-encoding'];
	var outreq = client.request(inreq.method, (url.pathname || '/') + (url.search || ''), inreq.headers);
	sys.puts("To Server: " + inreq.method + " " + url.pathname + " " + JSON.stringify(inreq.headers));

	outreq.addListener('response', function(inresp) {
		sys.puts("From Server: "+ inresp.statusCode + " " + JSON.stringify(inresp.headers));
		// Handle types here
		if(handlers[inresp.headers['content-type']]) {
			handlers[inresp.headers['content-type']](inresp, outresp);
		} else {
			handlers['default'](inresp, outresp);
		}
	});

	// Set up relaying the incoming request to the remote server
	inreq.addListener('data', function(chunk) { 
		if(chunk.length > 0) outreq.write(chunk); 
	});

	// Finish the client request when the request finishes
	inreq.addListener('end', function() { 
		outreq.end(); 
	});

}).listen(8080);
