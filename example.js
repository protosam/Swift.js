/* yahtk.js - The everything test!
   This is a test for everything that yahtk.js currently supports.
 */
require('./yahtk.js');

// Lazy math variable...
_2mb=(2 * 1024 * 1024); // 2mb broken down to kb then b.

// Fire up the HTTP server.
yahtk = YAHtk({ host: '0.0.0.0', port: 3000, max_upload_size: _2mb });

yahtk.addStatic('www');

yahtk.addRoute("/", function(req, res){
	res.setHeader('Content-Type', 'text/html');
	res.end('Welcome to the YAHtk example homepage!<br>\n\n' +
	'Below you see examples of the different yahtk.js supported features.<br><br>\n\n' +
	'<a href="/iamstatic.html">Static File Example</a>.<br><br>\n' +
	'<a href="/cookietest">Cookies Demo</a>.<br><br>\n' +
	'<a href="/r1">/r1</a> | <a href="/d2">/d2</a> - These two pages use the same code to return output.<br><br>\n' +
	'Rule Use Examples: <a href="/catch1/123/abc">example 1</a> | <a href="/catch1/8675309/WHATEVER">example 2</a> | <a href="/catch1/0000/zzzz">example 3</a> - Rules can be implemented to get data from the URL.<br><br>\n' +
	'<a href="/formsanddata">Forms and Data Processing</a> - Getting data from your user could not be much easier than this.<br>\n' +
	'\n');
});


/* We want /r1 and /d2 to land on the same code, so we just do the following.
 */
yahtk.addRoute([ "/r1", "/d2" ], function(req, res){
	res.setHeader('Content-Type', 'text/html');
	res.end('These are not the JS-<i>droids you are looking for</i>.');
});


/* Want to catch some input directly from the URL?
   We just use some regex like below. Capture groups are involved in filling in the function parameters.
 */
yahtk.addRule('/catch1/([0-9]+)/([A-Za-z0-9]+)', function(req, res, digits, alphanum){
	res.setHeader('Content-Type', 'text/plain');
	res.end('From the URL we got ' + digits +' and ' + alphanum + '\n');
});


/* Simple test to see yahtk.js handing post-data and query string data.
 */
yahtk.addRoute("/formsanddata", function(req, res){
	res.setHeader('Content-Type', 'text/html');

	res.end('Normal Form:<br>' +
	'<form method="post" action="/formsanddata/process">' +
	'<input type="text" name="email" placeholder="Email Address">' +
	'<button type="submit">Send</button>' +
	'</form>' +
	'<br><br>' +
	'Multi-part Form Data: <br>' +
	'<form method="post" action="/formsanddata/process" enctype="multipart/form-data">' +
	'<input type="text" name="email" placeholder="Email Address">' +
	'<button type="submit">Send</button>' +
	'</form>' +
	'<br><br>' +
	'Simple Query String: <a href="/formsanddata/process?email=someguy@somedomain.tld">click here to send</a>' +
	'\n');
});


/* Part 2 of that /formsanddata test.
 */
yahtk.addRoute("/formsanddata/process", function(req, res){
	email = req.getQuery('email');
	
	res.setHeader('Content-Type', 'text/html');
	res.end('You told us your email was ' + email);
});


/* Cookies demo...
 */
yahtk.addRoute("/cookietest", function(req, res){

	res.setHeader('Content-Type', 'text/html');
	
	testcookie = req.getCookie('testcookie');
	if(typeof(testcookie) == 'undefined'){
		testcookie = "not set";
		res.setCookie('testcookie', 'totally set now');
		
		res.write('Sent a set cookie header<br>\n');
	}else{
		res.expireCookie('testcookie');
		
		res.write('Sent an expiry for the cookie header<br>\n');
	}
	
	res.end('The value of testcookie is ' + testcookie + ' | Refresh this page to see if it updates.');
});
