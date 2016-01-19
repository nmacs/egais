/**
* Request.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

var xml2js = require('xml2js');

module.exports = {

	attributes: {
		model_name: {
			type: 'string',
			size: 64,
		},
		
		model_id: {
			type: 'integer',
		},
		
		complete_cb: {
			type: 'string',
			size: 64,
		},
		
		queryId: {
			type: 'string',
			size: 64,
		},
		
		sign: {
			type: 'string',
			size: 128,
		},

		send_url: {
			type: 'string',
			size: 128,
		},

		xml: {
			type: 'text',
		},

		in_url : {
			type: 'string',
			size: 128,
			defaultsTo: ''
		},

		out_url : {
			type : 'string',
			size: 128,
			defaultsTo : ''
		},

		response : {
			type : 'text',
			defaultsTo : ''
		},

		opts : {
			type : 'string',
			size: 256,
		},

		sent : {
			type : 'integer',
			defaultsTo : 0
		},
	},

	initiate : function (opts, cb) {
		EgaisRequest.create({
			model_name  : opts.model_name,
			model_id    : opts.model_id,
			complete_cb : opts.complete_cb,
			xml         : opts.xml,
			send_url    : opts.send_url,
			opts        : JSON.stringify(opts.opts)
		}).exec(cb);
	},
	
	cancel: function (opts, cb) {
		EgaisRequest.destroy({model_name: opts.model_name, model_id: opts.model_id}).exec(cb);
	},

	getUnsentRequests : function (cb) {
		EgaisRequest.find({sent : 0}).exec(function (err, requests) {
			if (err) {
				cb(err);
				return;
			}
			
			console.log("requests: " + requests);
			
			cb(undefined, requests);
		});
	},
	
	requestSentToUTM: function (opts, cb) {
		EgaisRequest.update({id: opts.id}, {queryId : opts.queryId, sign: opts.signature, sent: 1}).exec(function (err) {
			if (err) {
				console.log("Fail to update request status: " + err.message);
			}
			
			cb();
		});
	},
	
	processReply: function (replyId, reply, cb) {
		EgaisRequest.findOne({queryId: replyId}).exec(function (err, request) {
			if (err) {
				cb(err);
				return;
			}

			if (request) {
				console.log("Reply received. Notify model: " + request.model_name + "." + request.complete_cb + "(" + request.model_id + ")");
				var model = sails.models[request.model_name];
				model[request.complete_cb](request, reply, cb);
			}
			else {
				/*
				 * Request not found. Do nothing.
				 */
				cb();
			}
		});
	},
};

