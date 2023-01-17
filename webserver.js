// /*
//  *
//  * webserver.js
//  * Starts the js webserver for muscledb for local testing
//  * Bjørn-Petter Johannessen
//  * 2023
//  * 
//  */


var fs = require('fs'),
    http = require('http');

http.createServer(function (req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');

  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3001/muscles')
  fs.readFile(__dirname + req.url, function (err,data) {
    if (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
}).listen(5001);



// const express = require("express");
// const http = require("http");

// /* Config for the http server*/
// const http_config = {
//     port: 5001,
//     host: "localhost",
// }
  
//   const app = express();  
//   const http_server = http.createServer(app);

// /*
//  * Routes
//  */




// app.use(express.json());
// app.use(express.static('public'));

// /* Default route + ping route */

// app.get("/", (req, res) => {
//     res.status(200).json({message: "alive"});
//   });

// /* Start the server */
// http_server.listen(http_config.port, http_config.host, () => {
//   console.log(`Listening on ${http_config.host}:${http_config.port}`);
// });
