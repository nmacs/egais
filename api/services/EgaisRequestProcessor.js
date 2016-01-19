/**
 * EgaisRequestProcessor
 *
 * @description :: Server-side logic for managing Egaisrequests
 */

var http        = require('http');
var FormData    = require('form-data');
var parseString = require('xml2js').parseString;
var Step        = require('step');
var url         = require('url');
var request     = require("request");

var stopcb = null

function receive_document(opts, cb) {
	var options = {
		host   : "localhost",
		port   : 8080,
		path   : opts.path,
		method : 'GET',
	};

	var req = http.request(options, function(resp) {
		var body = '';
		resp.on('data', function (chunk) { body += chunk; });
		resp.on('end',  function () {
			if (resp.statusCode == 200) {
				cb(null, body);
			}
			else {
				var err = new Error("Request failed with code " + resp.statusCode);
				err.http_code = resp.statusCode;
				cb(err);
			}
		});
		resp.on('error', function (err) {
			cb(err);
		});
	});
	req.on('error', function(err) {
		cb(err);
	});
	req.end();
}

function receive_xml_document(opts, cb) {
	receive_document(opts, function(err, data) {
		if (err) {
			cb(err);
			return;
		}

		parseString(data, function (err, result) {
			if (err) {
				cb(err);
				return;
			}
			
			cb(null, result, opts);
		});
	});
}

/*function drop_document(opts, cb) {
	var options = {
		host   : "localhost",
		port   : 8080,
		path   : opts.path,
		method : 'DELETE',
	};

	var req = http.request(options, function(resp) {
		var body = '';
		resp.on('end',  function () {
			console.log("Drop done with code: " + resp.statusCode);
			cb();
		});
		resp.on('error', function (err) {
			cb(err);
		});
	});
	req.on('error', function(err) {
		cb(err);
	});
	req.end();
}*/

function drop_document(opts, cb) {
	console.log("Drop uri " + opts.uri);
	request.del(opts.uri, function (err, resp, body) {
		if (err) {
			cb(err);
			return;
		}

		console.log("Drop done with code: " + resp.statusCode);
		if (resp.statusCode == 200 || resp.statusCode == 404)
		{
			cb();
		}
		else
		{
			var err = new Error("Drop failed with code: " + resp.statusCode);
			cb(err);
		}
	});
}

function process_loop() {
	if (stopcb) {
		stopcb();
		return;
	}
	
	console.log("poll");

	Step(
		function () {
			var self = this;
			
			var receiveTtn = function (path, cb) {
				console.log("TTN detected: " + path);
				receive_xml_document({path: url.parse(path).path}, function (err, result) {
					if (err) {
						console.log("Fail to receive TTN: " + path);
						cb(err);
						return;
					}
					
					console.log("TTN received: " + path);
					
					//console.log(JSON.stringify(result));
					receive_xml_document
					var docs = result["ns:Documents"];
					var doc = docs["ns:Document"][0];
					var wb = doc["ns:WayBill"][0];
					
					Ttn.addTtn(wb, function (err) {
						if (err) {
							console.log("Fail to save TTN in database: " + path + "\n" + err.message);
							cb(err);
							return;
						}

						drop_document({uri: path}, function (err) {
							if (err) {
								console.log("Fail to delete TTN: " + path);
								cb(err);
								return;
							}
							
							console.log("done TTN: " + path);
							cb();
						});
					});
				});
			};
			
			var receiveFormB = function (path, cb) {
				console.log("formB detected: " + path);
				receive_xml_document({path: url.parse(path).path}, function (err, result) {
					if (err) {
						console.log("Fail to receive formB: " + path);
						cb(err);
						return;
					}
					
					console.log("formB received: " + path);
					
					//console.log(JSON.stringify(result));
					
					var docs = result["ns:Documents"];
					var doc = docs["ns:Document"][0];
					var wb = doc["ns:TTNInformBReg"][0];
					
					Ttn.addFormB(wb, function (err) {
						if (err) {
							console.log("Fail to save FromB in database: " + path + "\n" + err.message);
							cb(err);
							return;
						}

						drop_document({uri: path}, function (err) {
							if (err) {
								console.log("Fail to delete FormB: " + path);
								cb(err);
								return;
							}
							
							console.log("done formB: " + path);
							cb();
						});
					});
				});
			};
			
			receive_xml_document({path : "/opt/out"}, function (err, result) {
				if (err) {
					self(err);
					return;
				}
				
				var urls = result.A.url;
				if (urls == undefined) {
					self();
					return;
				}
				
				var group = self.group();

				//console.log("URLS:\n" + urls);

				for (var i = 0; i < urls.length; i++) {
					var url = urls[i];
					if (url['$'] == undefined || url['$'].replyId == undefined) {
						if (url.toUpperCase().indexOf("OPT/OUT/WAYBILL") >= 0) {
							receiveTtn(url, group());
						}
						else if (url.toUpperCase().indexOf("OPT/OUT/FORMBREGINFO") >= 0) {
							receiveFormB(url, group());
						}
					}
				}
			});
		},
		
		function () {
			var self = this;
			
			console.log("Poll unsent requests");

			EgaisRequest.getUnsentRequests(function (err, requests) {
				if (err) {
					console.log("Fail to get unsent requests: " + err.message);
					self(err);
					return;
				}
				else if (!requests || requests.length == 0) {
					self();
					return;
				}

				var group = self.group();

				requests.forEach(function (request) {
					var done = group();

					var form = new FormData();
					form.append("xml_file", request.xml);

					var options = {
						host    : "localhost",
						port    : 8080,
						path    : "/" + request.send_url,
						method  : 'POST',
						headers : form.getHeaders()
					};

					var req = http.request(options, function(resp) {
						var body = '';

						resp.on('data', function (chunk) {
							body += chunk;
						});

						resp.on('end',  function () {
							if (resp.statusCode == 200)
							{
								parseString(body, function (err, result) {
									if (err)
									{
										console.log("Fail to parse UTM response: " + err.message);
										console.log("Data:\n" + body);
										return;
									}
									
									console.log("Request applied:\n" + JSON.stringify(result));
									
									var queryId = result.A.url[0];
									var signature = result.A.sign[0];
									
									EgaisRequest.requestSentToUTM({id: request.id, queryId: queryId, singature: signature}, done);
								});
							}
							else
							{
								done(new Error("Request failed with status: " + resp.statusCode));
								console.log("Data:\n" + body);
							}
						});
						
						resp.on('error', function(err) {
							done(err);
						});
					});

					req.on('error', function(err) {
						console.log("Fail to send request to UTM: " + err.message);
						done(err);
					});

					form.pipe(req);
					req.end();
				});
			});
		},

		function () {
			console.log("Poll incoming documents");
			var self = this;
			receive_xml_document({path : "/opt/out"}, function (err, result) {
				if (err) {
					self(err);
					return;
				}
				
				var urls = result.A.url;
				if (urls == undefined || urls.length == 0) {
					self();
					return;
				}

				var processReply = function (uri, replyId, cb) {
					console.log("Process reply: " + replyId);
					receive_xml_document({path: url.parse(uri).path}, function (err, result) {
						if (err) {
							console.log("Fail to receive reply: " + err.message);
							cb(err);
							return;
						}
						
						EgaisRequest.processReply(replyId, result, function (err) {
							if (err) {
								console.log("Fail to process reply: " + err.message);
								cb(err);
								return;
							}
							
							console.log("Drop incoming document");
							drop_document({uri: uri}, function (err) {
								if (err) {
									console.log("Fail to remove reply: " + err.message);
								}
								
								console.log("Drop done");
								
								cb();
							});
						});
					});
				};

				var group = self.group();
				for (var i = 0; i < urls.length; i++) {
					if (urls[i]['$'] && urls[i]['$'].replyId) {
						processReply(urls[i]._, urls[i]['$'].replyId, group());
					}
				}
			});
		},
		
		function () {
			console.log("Poll outgoing documents");
			var self = this;
			receive_xml_document({path : "/opt/in"}, function(err, result) {
				if (err) {
					self(err);
					return;
				}
				
				var urls = result.A.url;
				var queries = [];
				if (urls == undefined) {
					self();
					return;
				}
				
				var group = self.group();
				//console.log("Probe request: " + request.queryId);
				for (var i = 0; i < urls.length; i++) {
					if (urls[i]['$'] && urls[i]['$'].replyId) {
						var processRequest = function(uri, replyId, cb) {
							EgaisRequest.findOne({queryId: replyId}).exec(function (err, request) {
								if (err) {
									cb(err);
									return;
								}
								
								if (!request) {
									/*
									* It seams we do not have such request
									* Drop outgoing EGAIS document if all requests have queryId
									*/
									EgaisRequest.count({queryId: null}).exec(function (err, count) {
										if (err) {
											cb(err);
											return;
										}
										
										if (count == 0) {
											
											EgaisRequest.findOne({queryId: replyId}).exec(function (err, request) {
												
												if (!request) {
													console.log("Drop outgoing document");
													drop_document({uri: uri}, function (err) {
														if (err) {
															console.log("Fail to remove request: " + err.message);
														}
														
														cb();
													});
												}
												else {
													cb();
												}
											});
										}
										else {
											cb();
										}
									});
									
									
								}
								else {
									cb();
								}
							});
						};
						
						processRequest(urls[i]._, urls[i]['$'].replyId, group());
					}
				}
			});
		},

		function final() {
			setTimeout(process_loop, 1000);
		}
	);
}

module.exports = {

	stopflag : false,

	start : function() {
		stopcb = null;
		setTimeout(process_loop, 1000);
	},

	stop : function(cb) {
		stopcb = cb;
	},
	
	getFSRAR_ID: function(cb) {
		receive_document({path: "/"}, function (err, result) {
			if (err) {
				cb(err);
				return;
			}

			var regexp = new RegExp('id="FSRAR-RSA-(\\d*)"');
			var matches = result.match(regexp);

			if (matches.length < 2) {
				cb(new Error("Unable to find FSRAR-RSA value"));
				return;
			}

			var fsrarid = matches[1];
			cb(undefined, fsrarid);
		});
	},
};

