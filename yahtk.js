const http = require('http');
var fs = require('fs');
var path = require('path');

var rundir = path.dirname(require.main.filename);

var mimeTypes = {
	"txt": "text/plain",
	"html": "text/html",
	"jpeg": "image/jpeg",
	"jpg": "image/jpeg",
	"png": "image/png",
	"js": "text/javascript",
	"css": "text/css"
};

YAHtk = function(options){
	this.host = options['host'] || '0.0.0.0';
	this.port = options['port'] || 3000;
	
	this.max_upload_size = options['max_upload_size'] || 0;

	http.IncomingMessage.prototype.killed = false;
	
	http.IncomingMessage.prototype.route = function(){
		return this.url.split('?')[0].replace(/(.)\/$/g, '$1')
	}

	http.IncomingMessage.prototype.getQuery = function(name){
		// need to setup the data object.
		if(!('data_object' in this)){
			this.data_object = {};
		
		
			// do we have a query string?
			if(this.url.indexOf('?') > -1){
				data_break = this.url.split('?')[1].split('&');
				for(k=0; k<data_break.length; k++){
					if(data_break[k].indexOf('=') == -1){ // dude is doing bad stuff... just kill his connection
						res.statusCode = 500;
						res.setHeader('Content-Type', 'text/plain');
						res.end('Invalid multipart form data.');
						return undefined;
					}
					this.data_object[data_break[k].substring(0, data_break[k].indexOf('='))] = decodeURIComponent( data_break[k].substring( data_break[k].indexOf('=')+1, data_break[k].length ).replace(/\+/g, ' ') );
				}
			}
		
			// parsing normal form data...
			if('content-type' in this.headers && this.headers['content-type'].match(/^application\/x-www-form-urlencoded/) != null){
				data_break = this.data.split('&');
				for(k=0; k<data_break.length; k++){
					if(data_break[k].indexOf('=') == -1){ // dude is doing bad stuff... just kill his connection
						res.statusCode = 500;
						res.setHeader('Content-Type', 'text/plain');
						res.end('Invalid multipart form data.');
						return undefined;
					}
					this.data_object[data_break[k].substring(0, data_break[k].indexOf('='))] = decodeURIComponent( data_break[k].substring( data_break[k].indexOf('=')+1, data_break[k].length ).replace(/\+/g, ' ') );
				}
			}
		
			// parsing multipart form data... thanks mozilla: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
			if('content-type' in this.headers && this.headers['content-type'].match(/^multipart\/form-data/) != null && this.headers['content-type'].match(/boundary=/) != null){
			
				//  extract the boundary and add the extra -- to the bounardy
				boundary = this.headers['content-type'].split(/boundary=/);
				if(boundary == null){ // dude is doing bad stuff... just kill his connection
					res.statusCode = 500;
					res.setHeader('Content-Type', 'text/plain');
					res.end('Invalid multipart form data.');
					return undefined;
				}
			
				boundary = '--'+boundary[1];
				if(boundary.indexOf(';') > 0){
					boundary = boundary.substring(0, boundary.indexOf(';'));
				}
			
			
				cursor = this.data.indexOf(boundary);
			
				// we're only getting the content name, we don't care about filename for example, don't trust that shit.
				do{
				
					// the content info
					start_mpfd_header = this.data.indexOf("\r\n", cursor) + 1;
					end_mpfd_header = this.data.indexOf("\r\n\r\n", cursor);
					cursor = this.data.indexOf(boundary, cursor+1);
	
					name_match = this.data.substring(start_mpfd_header, end_mpfd_header).match(/name="(.*?)"/);
					if(name_match == null || name_match.length < 2){ // dude is doing bad stuff... just kill his connection
						res.statusCode = 500;
						res.setHeader('Content-Type', 'text/plain');
						res.end('Invalid multipart form data.');
						return undefined;
					}
				
					this.data_object[name_match[1]] = this.data.substring(end_mpfd_header+4, cursor-2); // have to trim the newlines.
	
					look_ahead = this.data.indexOf(boundary, cursor+1);
				}while(look_ahead > -1);			
			}
		}
	
		if(!(name in this.data_object)){
			return undefined;
		}
	
		return this.data_object[name];
	}
	
	this.routes = {};
	this.rules = [];
	this.statics = [];
	
	this.server = http.createServer(function(req, res){
		console.log(req.url);
	
		// We assume everything is 200 OK...
		res.statusCode = 200;
	
		// BEGIN: capturing data
		var chunks = [];
		var chunks_count = 0;
		
		req.on('data', function(chunk){
			chunks_count += chunk.length;
			if(max_upload_size > 0 && chunks_count > max_upload_size){
				res.statusCode = 500;
				res.setHeader('Content-Type', 'text/plain');
				res.end('Too much data received by server. Limit is set to ' + max_upload_size + '.');
		
				req.killed = true;
			}
			if(req.killed == false){
				chunks.push(chunk);
			}
		});
		
		req.on('end', function() {
			
			if(req.killed){ return; } // the request was killed, stop doing stuff.
			
			// buff that data up into a useful place!
			data = Buffer.concat(chunks);
			req.data = data.toString();
			req.rawdata = data;
	
			// try rules...
			for(r=0; r<rules.length; r++){
				matches = req.url.match(rules[r]['regex']);
				if(matches != null){
					array_of_args = [ req, res ];
					for(i=1; i<matches.length; i++){ array_of_args.push(matches[i]); }
					rules[r]['fn'].apply(this, array_of_args);
					// prevent hitting anything further below.
					return;
				}
			}
	
			// try routes
			if(req.route() in routes && req.route()[0] == '/'){
				routes[req.route()](req, res);
				return;
			}
			
			
			// try the file system.
			for(s=0; s<statics.length; s++){
				var filename = path.join(rundir + '/' + statics[s], path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '')); // Stupid Syntax Highler.. ]/
				if(fs.existsSync(filename)){
					
					var ext = path.extname(filename).split(".");
					if(typeof(ext[1]) == 'undefined') { ext = 'txt'; }else{ ext = ext[1]; }
					var mimeType = mimeTypes[ext];
				
					res.statusCode = 200;
					res.setHeader('Content-Type', mimeType);

					var fileStream = fs.createReadStream(filename);
					fileStream.pipe(res);
					//res.end();
					return;
				}
			}
			
			// fallback to a 404..
			res.statusCode = 404;
			res.setHeader('Content-Type', 'text/plain');
			res.end('404 - Page not found.\n');
		});
		// END: capturing data
	});
	
	
	this.server.listen(this.port, this.host, () => {
		console.log('Server running...');
	});
	
	this.addStatic = function(dir){
		this.statics.push(dir);
	}

	this.addRule = function(rule, fn){
		// addRule('/test/([0-9])+/([0-9]+)/whatever', fn);
		this.rules.push({ regex: new RegExp('^'+rule+'$'), fn: fn, text_rule: rule });
	}

	this.addRoute = function(name, fn){
		if(typeof(name) == typeof("")){
			this.routes[name] = fn;
		}
		if(typeof(name) == typeof([])){
			for(x=0; x<name.length; x++){
				this.routes[name[x]] = fn;
			}
		}
	
	}

	
	
	return this;
}
