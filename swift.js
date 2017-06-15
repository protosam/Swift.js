const http = require('http');
Swift = function(options){
	options['host'] = options['host'] || '0.0.0.0';
	options['port'] = options['port'] || 3000;



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
						req.end('Invalid multipart form data.');
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
						req.end('Invalid multipart form data.');
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
					req.end('Invalid multipart form data.');
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
						req.end('Invalid multipart form data.');
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
	
	this.server = http.createServer(function(req, res){
		console.log(req.url);
	
		// We assume everything is 200 OK...
		res.statusCode = 200;
	
		// BEGIN: capturing data
		var chunks = [];
		req.on('data', function(chunk){
			chunks.push(chunk);
		});
		req.on('end', function() {
			data = Buffer.concat(chunks);
			req.data = data.toString();
			req.rawdata = data;
	
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
	
			if(req.route() in routes && req.route()[0] == '/'){
				routes[req.route()](req, res);
			}else{
				res.statusCode = 404;
				res.setHeader('Content-Type', 'text/plain');
				res.end('404 - Page not found.\n');
			}
		});
		// END: capturing data
	});
	
	
	this.server.listen(3000, '0.0.0.0', () => {
		console.log('Server running...');
	});
	
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
