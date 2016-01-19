/**
* Ttn.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

var dateFormat  = require('dateformat');
var parseString = require('xml2js').parseString;
var Step        = require('step');

module.exports = {

  attributes: {
		key: {
			type: 'string',
			size: 128,
			unique: true,
			index: true,
			required: true,
		},

		ttnRaw: {
			type: 'text',
		},

		formBRaw: {
			type: 'text',
		},
		
		replied: {
			type: 'string',
			size: 16,
			defaultsTo: 'no',
		},
		
		realQuantities: {
			type: 'text',
		},
		
		note: {
			type: 'text',
		},
		
		requests: {
			type: 'integer',
			defaultsTo: 0,
		},
		
		replies: {
			type: 'text',
		},
		
		unpack: function () {
			var ttnRaw = this.ttnRaw;
			var formBRaw = this.formBRaw;
			
			/*
			 * Drop raw data
			 */
			this.ttnRaw = undefined;
			this.formBRaw = undefined;
			
			if (ttnRaw == undefined)
				return;

			var ttn = JSON.parse(ttnRaw);
			var content = ttn["wb:Content"];
			if (content == undefined)
				return;
			content = content[0];
			
			/*
			 * Fill TTN positions
			 */
			var positions = [];
			
			var positions_xml = content["wb:Position"];
			for (var i = 0; i < positions_xml.length; i++) {
				var position_xml = positions_xml[i];
				var product_xml = position_xml["wb:Product"][0];
				
				var product = {};
				if (product_xml["pref:ShortName"]) {
					product.name = product_xml["pref:ShortName"][0];
				}
				else if (product_xml["pref:FullName"]) {
					product.name = product_xml["pref:FullName"][0];
				}
				else {
					product.name = "Неизвестный продукт";
					if (product_xml["pref:AlcCode"]) {
						product.name = product.name + " AclCode: " + product_xml["pref:AlcCode"][0];
					}
				}
				
				product.capacity = product_xml["pref:Capacity"][0];
				
				var producer = product_xml["pref:Producer"][0];
				if (producer) {
					if (producer["oref:ShortName"]) {
						product.producer = producer["oref:ShortName"][0];
					}
					else if (producer["oref:FullName"]) {
						product.producer = producer["oref:FullName"][0];
					}
					else {
						product.producer = "Неизвестный производитель";
						if (producer["oref:INN"]) {
							product.producer = product.producer + " ИНН: " + producer["oref:INN"][0];
						}
					}
				}
				
				var position = {};
				position.product = product;
				position.quantity = parseInt(position_xml["wb:Quantity"][0]);
				if (position_xml["wb:Price"]) {
					position.price = position_xml["wb:Price"][0];
				}
				position.identity = position_xml["wb:Identity"][0];
				
				positions.push(position);
			}
			this.positions = positions;
			
			var realQuantities;
			if (this.realQuantities) {
				realQuantities = JSON.parse(this.realQuantities);
			}
			
			for (var i = 0; i < positions.length; i++) {
				if (realQuantities) {
					positions[i].realQuantity = realQuantities[i];
				}
				else {
					positions[i].realQuantity = positions[i].quantity;
				}
			}
			
			var header_xml = ttn["wb:Header"][0];
			this.date = header_xml["wb:Date"][0];
			this.shippingDate = header_xml["wb:ShippingDate"][0];
			this.number = header_xml["wb:NUMBER"][0];
			this.identity = ttn["wb:Identity"][0];

			var shipper_xml = header_xml["wb:Shipper"][0];
			var shipper = {};
			shipper.inn = shipper_xml["oref:INN"];
			shipper.kpp = shipper_xml["oref:KPP"];
			shipper.name = shipper_xml["oref:ShortName"];
			shipper.fullName = shipper_xml["oref:FullName"];
			this.shipper = shipper;
			
			var consignee_xml = header_xml["wb:Consignee"][0];
			var consignee = {};
			consignee.inn = consignee_xml["oref:INN"];
			consignee.kpp = consignee_xml["oref:KPP"];
			consignee.name = consignee_xml["oref:ShortName"];
			consignee.fullName = consignee_xml["oref:FullName"];
			this.consignee = consignee;
			
			if (formBRaw) {
				var formB = JSON.parse(formBRaw);
				var formBPositions = formB["wbr:Content"][0]["wbr:Position"];
				
				for (var i = 0; i < positions.length; i++) {
					positions[i].formBRegId = formBPositions[i]["wbr:InformBRegId"][0];
				}
				
				this.hasFormB = true;
			}
			else {
				this.hasFormB = false;
			}
		},
  },

	addTtn: function (ttn, cb) {
		console.log("Save ttn to database\n");
		
		var header = ttn["wb:Header"];
		if (header == undefined) {
			cb(new Error("ttn: wb:Header field must present"));
			return;
		}
		header = header[0];

		var number = header["wb:NUMBER"];
		if (number == undefined) {
			cb(new Error("ttn.header: wb:NUMBER field must present"));
			return;
		}
		number = number[0];

		var shipper = header["wb:Shipper"];
		if (shipper == undefined) {
			cb(new Error("ttn.header: wb:Shipper field must present"));
			return;
		}
		shipper = shipper[0];

		var shipper_inn = shipper["oref:INN"];
		if (shipper_inn == undefined) {
			cb(new Error("ttn.header.shipper: oref:INN field must present"));
			return;
		}
		shipper_inn = shipper_inn[0];

		var shipper_kpp = shipper["oref:KPP"];
		if (shipper_kpp == undefined) {
			cb(new Error("ttn.header.shipper: oref.KPP field must present"));
			return;
		}
		shipper_kpp = shipper_kpp[0];

		var clientRegId = shipper["oref:ClientRegId"];
		if (clientRegId == undefined) {
			cb(new Error("ttn.header.shipper: oref.ClientRegId field must present"));
			return;
		}
		clientRegId = clientRegId[0];

		var key = clientRegId + '_' + shipper_inn + '_' + shipper_kpp + '_' + number;
		var raw = JSON.stringify(ttn);
		
		Ttn.query('INSERT INTO ttn (ttn.key,ttn.ttnRaw,ttn.replied) VALUES (?,?,"no") ON DUPLICATE KEY UPDATE ttn.ttnRaw=?', [key, raw, raw], function (err, data) {
			if (err) {
				cb(err);
				return;
			}
			
			/*
			 * With ON DUPLICATE KEY UPDATE, the affected-rows value per row is 1
			 * if the row is inserted as a new row and 2 if an existing row is updated.
			 */
			if (data.affectedRows == 1) {
				Ttn.publishCreate({id: data.insertId});
			}
			
			cb();
		});
	},

	addFormB: function(formB, cb) {
		console.log("Save formB to database\n");
		
		var header = formB["wbr:Header"];
		if (header == undefined) {
			cb(new Error("formB: wbr:Header field must present"));
			return;
		}
		header = header[0];

		var number = header["wbr:WBNUMBER"];
		if (number == undefined) {
			cb(new Error("formB.header: wbr:WBNUMBER field must present"));
			return;
		}
		number = number[0];

		var shipper = header["wbr:Shipper"];
		if (shipper == undefined) {
			cb(new Error("formB.header: wbr:Shipper field must present"));
			return;
		}
		shipper = shipper[0];

		var shipper_inn = shipper["oref:INN"];
		if (shipper_inn == undefined) {
			cb(new Error("formB.header.shipper: oref:INN field must present"));
			return;
		}
		shipper_inn = shipper_inn[0];

		var shipper_kpp = shipper["oref:KPP"];
		if (shipper_kpp == undefined) {
			cb(new Error("formB.header.shipper: oref.KPP field must present"));
			return;
		}
		shipper_kpp = shipper_kpp[0];

		var clientRegId = shipper["oref:ClientRegId"];
		if (clientRegId == undefined) {
			cb(new Error("formB.header.shipper: oref.ClientRegId field must present"));
			return;
		}
		clientRegId = clientRegId[0];

		var key = clientRegId + '_' + shipper_inn + '_' + shipper_kpp + '_' + number;
		var raw = JSON.stringify(formB);
		
		Ttn.query('INSERT INTO ttn (ttn.key,ttn.formBRaw,ttn.replied) VALUES (?,?,"no") ON DUPLICATE KEY UPDATE ttn.formBRaw=?', [key, raw, raw], function (err, data) {
			if (err) {
				cb(err);
				return;
			}
			
			/*
			 * With ON DUPLICATE KEY UPDATE, the affected-rows value per row is 1
			 * if the row is inserted as a new row and 2 if an existing row is updated.
			 */
			if (data.affectedRows == 2) {
				Ttn.findOne({key: key}).exec(function (err, record) {
					if (err) {
						cb(err);
						return;
					}
					
					record.unpack();
					Ttn.publishUpdate(record.id, record);
					
					cb();
				});
				return;
			}

			cb();
		});
	},
	
	initiate_WayBillAct_send: function (record, cb) {
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
			root.att("xmlns:oref", "http://fsrar.ru/WEGAIS/ClientRef");
			root.att("xmlns:pref", "http://fsrar.ru/WEGAIS/ProductRef");
			root.att("xmlns:wa",   "http://fsrar.ru/WEGAIS/ActTTNSingle");
			
			root.ele("ns:Owner").ele("ns:FSRAR_ID", fsrarid);
			
			var act = root.ele("ns:Document").ele("ns:WayBillAct");
			var header = act.ele("wa:Header");
			var content = act.ele("wa:Content");

			var accept = record.replied == "accepted";
			header.ele("wa:IsAccept", accept ? "Accepted" : "Rejected");
			
			var ttn = JSON.parse(record.ttnRaw);
			header.ele("wa:ACTNUMBER", "АКТ-" + ttn["wb:Header"][0]["wb:NUMBER"][0]);
			
			var now = new Date();
			header.ele("wa:ActDate", dateFormat(now, "yyyy-mm-dd"));
			
			var formB = JSON.parse(record.formBRaw);
			header.ele("wa:WBRegId", formB["wbr:Header"][0]["wbr:WBRegId"][0]);
			
			header.ele("wa:Note", record.note);
			
			if (accept) {
				record.unpack();
				
				var haveDifference = false;
				
				for (var i = 0; i < record.positions.length; i++) {
					var item = record.positions[i];
					if (item.realQuantity != item.quantity) {
						haveDifference = true;
						break;
					}
				}
				
				if (haveDifference) {
					for (var i = 0; i < record.positions.length; i++) {
						var item = record.positions[i];
						var position = content.ele("wa:Position");
						position.ele("wa:Identity", item.identity);
						position.ele("wa:RealQuantity", item.realQuantity);
						position.ele("wa:InformBRegId", item.formBRegId);
					}
				}
			}

			var xml = root.end({pretty: true});

			EgaisRequest.initiate({model_name:  "ttn",
														model_id:    record.id,
														complete_cb: "complete_WayBillAct_send",
														xml:         xml,
														send_url:    "opt/in/WayBillAct",
														},
			function (err, request) {
				if (err) {
					cb(err);
					return;
				}

				EgaisRequest.count({model_name: 'ttn', model_id: record.id}, record).exec(function (err, count) {
					if (err) {
						cb(err);
						return;
					}

					record.requests = count;
					Ttn.update({id: record.id}, {requests: count}).exec(function () {
						console.log("------------------ count: " + count);
						Ttn.publishUpdate(record.id, record);
						cb();
					});
				});
			});
		});
	},

	complete_WayBillAct_send: function (request, reply, cb) {
		console.log("TTN send act request complete");
		console.log(JSON.stringify(reply));

		Ttn.findOne({id : request.model_id}).exec(function (err, record) {
			if (err) {
				cb(err);
				return;
			}

			if (record) {
				record.unpack();
				
				var replies = [];
				if (record.replies) {
					replies = JSON.parse(record.replies);
				}
				
				replies.push(reply);
				
				Ttn.update({id: record.id}, {replies: JSON.stringify(replies)}).exec(function () {
					var documents = reply["ns:Documents"];
					if (!documents) {
						cb(new Error("ns:Documents field required"));
						return;
					}
					
					var document = documents["ns:Document"];
					if (!document) {
						cb(new Error("ns:Document field required"));
						return;
					}
					document = document[0];
					
					var ticket = document["ns:Ticket"];
					if (!ticket) {
						cb(new Error("ns:Ticket field required"));
						return;
					}
					ticket = ticket[0];
					
					var docType = ticket["tc:DocType"];
					if (!docType) {
						cb(new Error("tc:DocType field required"));
						return;
					}
					docType = docType[0];
					
					if (docType == "WAYBILL") {
						var identity = ticket["tc:Identity"];
						if (!identity) {
							cb(new Error("tc:Identity field required"));
							return;
						}
						identity = identity[0];
						
						if (identity != record.identity) {
							cb(new Error("Identity value mismatch: " + identity + "!=" + record.identity));
							return;
						}
						
						var opResult = ticket["tc:OperationResult"];
						if (!opResult) {
							cb(new Error("tc:OperationResult field required"));
							return;
						}
						opResult = opResult[0];
						
						var opName = opResult["tc:OperationName"];
						if (!opName) {
							cb(new Error("tc:OperationName field required"));
							return;
						}
						opName = opName[0];
						
						if (opName != "Confirm") {
							cb(new Error("tc:OperationName has invalid value: " + opName));
							return;
						}
						
						var opResultValue = opResult["tc:OperationResult"];
						if (!opResultValue) {
							cb(new Error("tc:OperationResult field required"));
							return;
						}
						opResultValue = opResultValue[0];
						
						if (opResultValue.toUpperCase() != record.replied.toUpperCase()) {
							cb(new Error("tc:OperationResult has invalid value: " + opResultValue));
							return;
						}
						
						EgaisRequest.destroy({id: request.id}).exec(function (err) {
							if (err) {
								cb(err);
								return;
							}
							EgaisRequest.count({model_name: 'ttn', model_id: record.id}).exec(function (err, count) {
								if (err) {
									cb(err);
									return;
								}
								
								record.requests = count;
								Ttn.update({id: record.id}, {requests: count}).exec(function () {
									console.log("------------------ count: " + count);
									Ttn.publishUpdate(record.id, record);
									cb();
								});
							});
						});
					}
					else {
						console.log("Ignore reply: docType=" + docType);
						cb();
					}
				});
			}
			else {
				console.log("Response for unexisting ttn: " + request.model_id);
				cb();
			}
		});
	},

	accept: function (id, realQuantities, cb) {
		console.log("TTN accept: " + id);
		Ttn.update({id: id},
		{
			replied: "accepted",
			realQuantities: JSON.stringify(realQuantities),
		}).exec(
		function (err, records) {
			if (err) {
				cb(err);
				return;
			}
			
			if (records) {
				console.log("Accept OK");
				Ttn.initiate_WayBillAct_send(records[0], cb);
			}
		});
	},

	reject: function (id, cb) {
		console.log("TTN reject: " + id);
		Ttn.update({id: id},
		{
			replied: "rejected",
		}).exec(
		function (err, records) {
			if (err) {
				cb(err);
				return;
			}
			
			if (records) {
				console.log("Reject OK");
				Ttn.initiate_WayBillAct_send(records[0], cb);
			}
		});
	},
};

