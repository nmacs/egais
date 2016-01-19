/**
* PartnerBranches.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

	attributes: {
		regId: {
			type: 'string',
			size: 64,
		},
		
		kpp: {
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
		
		country: {
			type: 'string',
			size: 32,
		},
		
		region: {
			type: 'string',
			size: 32,
		},
		
		city: {
			type: 'string',
			size: 64,
		},
		
		street: {
			type: 'string',
			size: 64,
		},

		house: {
			type: 'string',
			size: 32,
		},

		description: {
			type: 'text',
		},

		partner: {
			model: 'egaispartner',
		},
	}
};

