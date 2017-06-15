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

yahtpl = class {

	constructor(file){
		this.tplblocks = {};
		this.assignments = {};
		this.tplfile = path.join(rundir, file);
		this.filecontents = "";
		if(fs.existsSync(this.tplfile)){
			this.filecontents = fs.readFileSync(this.tplfile).toString().replace(/(\r\n|\n|\n\r)/g, '<!-- NL -->');
			
			this.breakblocks(this.filecontents, '');
		}
	}
	
	breakblocks(contents, layer){
		var parent = layer;
		if(layer != ''){ layer += '.'; }
		
		var blocks = contents.match(/<!-- BEGIN: (.*?) -->(.*?)<!-- END: \1 -->/g);
		if(blocks != null && blocks.length > 0){
			for(var x=0;x<blocks.length;x++){
				var block = blocks[x];
				var transform = block.match(/<!-- BEGIN: (.*?) -->(.*?)<!-- END: \1 -->/);
				var name = transform[1];
				var content = transform[2];
				
				if(parent == ''){
					this.filecontents = this.filecontents.replace(transform[0], '<--_' + layer + name + '_-->' );
				}else{
					this.tplblocks[parent] = this.tplblocks[parent].replace(transform[0], '<--_' + layer + name + '_-->' );
				}
				
				this.tplblocks[layer + name] = content;
				this.breakblocks(content, layer + name);
			}
		}
	}
	
	getParent(blockname){
		if(blockname.lastIndexOf(".") == -1){ return ''; }
		return blockname.substr(0, blockname.lastIndexOf("."))
	}
	
	assign(varname, val){
		if(typeof(varname) == typeof({})){
			for(var k in varname){
				this.assignments[k] = varname[k];
			}
		}else{
			this.assignments[varname] = val;
		}
	}
	
	parse(blockname){
		var parent = this.getParent(blockname);
		
		var assigned_block = this.tplblocks[blockname];
		
		for(var varname in this.assignments){
			assigned_block = assigned_block.replace('{' + varname + '}', this.assignments[varname]);
		}
		
		if(parent == ''){
			this.filecontents = this.filecontents.replace('<--_' + blockname + '_-->', assigned_block + '<--_' + blockname + '_-->');
		}else{
			this.tplblocks[parent] = this.tplblocks[parent].replace('<--_' + blockname + '_-->', assigned_block + '<--_' + blockname + '_-->');
		}
		
		this.assignments = {};
	}
	
	out(res){
		this.filecontents = this.filecontents.replace(/<--_(.*?)_-->/g, "");
		this.filecontents = this.filecontents.replace(/<!-- NL -->/g, "\n");
		
		if(typeof(res) == 'undefined'){
			
			return this.filecontents.trim();
		}
		
		res.statusCode = 200;
		res.setHeader('Content-Type', 'text/html');
		res.end(this.filecontents.trim());
	}
}

YAHtk = function(options){
	this.host = options['host'] || '0.0.0.0';
	this.port = options['port'] || 3000;
	
	this.max_upload_size = options['max_upload_size'] || 0;

	http.IncomingMessage.prototype.killed = false;
	
	http.IncomingMessage.prototype.route = function(){
		return this.url.split('?')[0].replace(/(.)\/$/g, '$1')
	}

	// this needs more... https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
	http.ServerResponse.prototype.setCookie = function(name, value){
		this.setHeader('Set-Cookie', name + '=' + value);
	}
	
	http.ServerResponse.prototype.expireCookie = function(name){
		this.setHeader('Set-Cookie', name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT');
	}
	
	http.IncomingMessage.prototype.getCookie = function(name){
		if(!('cookie' in this.headers)) { return undefined; }
		if(!('cookie_object' in this)){
			this.cookie_object = {};
			var rc = this.headers.cookie;

			rc = rc.split(';')
			for(x=0; x<rc.length; x++){
				var parts = rc[x].split('=');
				if(parts.length < 2){ continue;	}
				this.cookie_object[parts[0].trim()] = decodeURI(parts[1]);
			};
		}

		
		if(!(name in this.cookie_object)){
			return undefined;
		}
		return this.cookie_object[name];
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
