/**
 * EgaisPartnerController
 *
 * @description :: Server-side logic for managing Egaispartners
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {
	refresh: function(req, resp) {
		var body = req.body;
		
		EgaisPartner.findOne({id: body.id}).populateAll().exec(function (err, record) {
			if (err) {
				return;
			}
			
			if (record) {
				EgaisPartner.initiate_partner_request(record, function () {});
			}
		});
	},
	
	query_catalog: function (req, resp) {
		var body = req.body;
		
		EgaisPartner.findOne({id: body.id}).populateAll().exec(function (err, record) {
			if (err) {
				return;
			}
			
			if (record) {
				EgaisPartner.initiate_catalog_request(record, function () {});
			}
		});
	},
	
	cancel_queries: function (req, resp) {
		var body = req.body;
		
		EgaisPartner.findOne({id: body.id}).populateAll().exec(function (err, record) {
			if (err) {
				return;
			}

			if (record) {
				EgaisPartner.cancle_queries(record, function () {});
			}
		});
	},
};

