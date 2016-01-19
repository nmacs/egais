/**
* EgaisPartner.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

var parseString = require('xml2js').parseString;
var Step        = require('step');

module.exports = {

	attributes: {
		inn: {
			type: 'string',
			unique: true,
			required: true,
			size: 32,
		},

		regId: {
			type: 'string',
			size: 32,
		},

		fullName: {
			type: 'string',
			size: 256,
		},

		shortName: {
			type: 'string',
			size: 128,
		},

		branches: {
			collection: 'partnerbranches',
			via: 'partner',
		},

		error: {
			type: 'string',
			size: 256,
		},

		requests: {
			type: 'integer',
			defaultsTo: 0,
		},
	},

	afterCreate: function(record, cb) {
		EgaisPartner.initiate_partner_request(record, function(err) {
			if (err) {
				console.log(err.message);
			}
			cb();
		});
	},

	initiate_partner_request : function(record, cb) {
		var builder = require('xmlbuilder');
		
		EgaisRequestProcessor.getFSRAR_ID(function (err, fsrarid) {
			if (err) {
				cb(err);
				return;
			}

			var root = builder.create("ns:Documents");
			root.att("Version",    "1.0");
			root.att("xmlns:xsi",  "http://www.w3.org/2001/XMLSchema-instance");
			root.att("xmlns:ns",   "http://fsrar.ru/WEGAIS/WB_DOC_SINGLE_01");
			root.att("xmlns:oref", "http://fsrar.ru/WEGAIS/ClientRef");
			root.att("xmlns:qp",   "http://fsrar.ru/WEGAIS/QueryParameters");
			
			root.ele("ns:Owner").ele("ns:FSRAR_ID", fsrarid);
			
			var param = root.ele("ns:Document").ele("ns:QueryClients").ele("qp:Parameters").ele("qp:Parameter");
			param.ele("qp:Name", "ИНН");
			param.ele("qp:Value", record.inn);

			var xml = root.end({pretty: true});
			console.log("+++ \n" + xml);

			EgaisRequest.initiate({model_name:  "egaispartner",
														model_id:    record.id,
														complete_cb: "partner_request_complete",
														xml:         xml,
														send_url:    "opt/in/QueryPartner",
														},
			function(err, request) {
				if (err) {
					console.log(err.message);
					cb(err);
					return;
				}

				EgaisRequest.count({model_name: 'egaispartner', model_id: record.id}, record).exec(function (err, count) {
					if (err) {
						console.log(err.message);
						cb(err);
						return;
					}
					
					console.log(record);

					record.requests = count;
					EgaisRequest.update({id: record.id}, {requests: count}).exec(function () {
						console.log("------------------ count: " + count);
						EgaisPartner.publishUpdate(record.id, record);
						cb();
					});
				});
			});
		});
	},

	partner_request_complete: function (request, response, cb) {
		console.log("EgaisPartner request complete");
		
		//console.log(response);

		EgaisPartner.findOne({id : request.model_id}).exec(function (err, record) {
			if (err) {
				cb(err);
				return;
			}

			if (record) {
				var branches = [];
				var clients = response["ns:Documents"]["ns:Document"][0]["ns:ReplyClient"][0]["rc:Clients"];
				
				if (clients[0] === "") {
					record.error = "Организация не найдена";
				}
				else {
					clients = clients[0]["rc:Client"];

					if (clients.length > 0) {
						var client = clients[0];
						if (client["oref:FullName"] != undefined)
							record.fullName = client["oref:FullName"][0];
						if (client["oref:ShortName"] != undefined)
							record.shortName = client["oref:ShortName"][0];
					}

					for (var i = 0; i < clients.length; i++) {
						var client = clients[i];
						var branch = {};

						if (client["oref:KPP"] != undefined)
							branch.kpp = client["oref:KPP"][0];
						if (client["oref:FullName"] != undefined)
							branch.fullName = client["oref:FullName"][0];
						if (client["oref:ShortName"] != undefined)
							branch.shortName = client["oref:ShortName"][0];
						if (client["oref:ClientRegId"] != undefined)
							branch.regId = client["oref:ClientRegId"][0];

						if (client["oref:address"] != undefined) {
							var address = client["oref:address"][0];
							if (address["oref:Country"] != undefined)
								branch.country = address["oref:Country"][0];
							if (address["oref:RegionCode"] != undefined)
								branch.region = address["oref:RegionCode"][0];
							if (address["oref:city"] != undefined)
								branch.city = address["oref:city"][0];
							if (address["oref:street"] != undefined)
								branch.street = address["oref:street"][0];
							if (address["oref:house"] != undefined)
								branch.house = address["oref:house"][0];
							if (address["oref:description"] != undefined)
								branch.description = address["oref:description"][0];
						}

						branch.partner = record.id;

						branches.push(branch);
					}
				}

				record.branches = branches;

				Step(
					function () {
						PartnerBranches.destroy({partner: record.id}).exec(this);
					},
					function (err) {
						if (err) throw err;
						PartnerBranches.create(branches).exec(this);
					},
					function (err, created) {
						if (err) throw err;
						EgaisPartner.update({id: record.id}, record).exec(this);
					},
					function (err) {
						if (err) throw err;
						EgaisRequest.destroy({id: request.id}).exec(this);
					},
					function (err) {
						if (err) throw err;
						EgaisRequest.count({model_name: 'egaispartner', model_id: record.id}).exec(this);
					},
					function (err, count) {
						if (err) {
							cb(err);
							return;
						}
						
						record.requests = count;
						EgaisPartner.update({id: record.id}, {requests: record.requests}).exec(function () {
							console.log("------------------ count: " + count);
							EgaisPartner.publishUpdate(record.id, record);
							cb();
						});
					}
				);
			}
			else
			{
				console.log("Response for unexisted partner: " + request.model_id);
				cb();
			}
		});
	},
	
	initiate_catalog_request: function (record, cb) {
		
		EgaisRequestProcessor.getFSRAR_ID(function (err, fsrarid) {
			if (err) {
				cb(err);
				return;
			}
		
			var builder = require('xmlbuilder');
			var root = builder.create("ns:Documents");
			root.att("Version",    "1.0");
			root.att("xmlns:xsi",  "http://www.w3.org/2001/XMLSchema-instance");
			root.att("xmlns:ns",   "http://fsrar.ru/WEGAIS/WB_DOC_SINGLE_01");
			root.att("xmlns:qp",   "http://fsrar.ru/WEGAIS/QueryParameters");

			root.ele("ns:Owner").ele("ns:FSRAR_ID", fsrarid);

			var param = root.ele("ns:Document").ele("ns:QueryAP").ele("qp:Parameters").ele("qp:Parameter");
			param.ele("qp:Name", "ИНН");
			param.ele("qp:Value", record.inn);

			var xml = root.end({pretty: true});

			EgaisRequest.initiate({model_name:  "egaispartner",
														model_id:    record.id,
														complete_cb: "catalog_request_complete",
														xml:         xml,
														send_url:    "opt/in/QueryAP",
														},
			function (err, request) {
				if (err) {
					cb(err);
					return;
				}

				EgaisRequest.count({model_name: 'egaispartner', model_id: record.id}, record).exec(function (err, count) {
					if (err) {
						cb(err);
						return;
					}

					record.requests = count;
					record.save(function () {
						console.log("------------------ count: " + count);
						EgaisPartner.publishUpdate(record.id, record);
						cb();
					});
				});
			});
		});
	},
	
	catalog_request_complete: function (request, response, cb) {
		console.log("Catalog request complete");

		EgaisPartner.findOne({id : request.model_id}).populateAll().exec(function (err, record) {
			if (err) {
				cb(err);
				return;
			}

			if (record) {
				Step(
					function() {
						var items = response["ns:Documents"]["ns:Document"][0]["ns:ReplyAP"][0]["rap:Products"][0]["rap:Product"];
						AlcoProducts.populate(record, items, this);
					},
					function (err) {
						if (err) throw err;
						EgaisRequest.destroy({id: request.id}).exec(this);
					},
					function (err) {
						if (err) throw err;
						EgaisRequest.count({model_name: 'egaispartner', model_id: record.id}).exec(this);
					},
					function (err, count) {
						if (err) {
							cb(err);
							return;
						}
						
						record.requests = count;
						EgaisPartner.update({id: record.id}, {requests: record.requests}).exec(function () {
							console.log("------------------ count: " + count);
							EgaisPartner.publishUpdate(record.id, record);
							cb();
						});
					}
				);
			}
			else {
				console.log("Response for unexisted partner: " + request.model_id);
				cb();
			}
		});
	},
	
	cancle_queries: function (record, cb) {
		EgaisRequest.cancel({model_name: 'egaispartner', model_id: record.id}, function (err) {
			if (err) {
				console.log(err);
				cb(err);
				return;
			}

			record.requests = 0;
			EgaisPartner.update({id: record.id}, record).exec(function (err, updated) {
				EgaisPartner.publishUpdate(record.id, record);
				cb();
			});
		});
	},
};

