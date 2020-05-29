function runTest(aspive){

	const path = require('path');
	const express = require('express');
	const app = express();

	app.engine('php', aspive({template: 'layout', logSpeed: true}));
	app.set('views', path.join(__dirname, 'views'));
	app.set('view engine', 'php');

	app.use(function(req, res, next){
		if(req.url === '/favicon.ico'){res.send('').end(); return;}
		res.render('index', {opts: {title: 'example', content: "<h2>Hello, World!</h2>", list: {item1: 1, item2: 2, item3: [1, 2, 3]}}});
	});

	app.listen(8080);

}

module.exports = runTest;
