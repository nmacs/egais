/**
* AlcoProducts.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

	attributes: {
		inn: {
			type: 'string',
			size: 32,
		},
		
		kpp: {
			type: 'string',
			size: 32,
		},
		
		fullName: {
			type: 'string',
			size: 256,
		},
		
		alcCode: {
			type: 'string',
			size: 64,
		},
		
		capacity: {
			type: 'string',
			size: 32,
		},
		
		alcVolume: {
			type: 'string',
			size: 32,
		},
		
		productVCode: {
			type: 'string',
			size: 64,
		},
		
		importerRegId: {
			type: 'string',
			size: 32,
		},
		
		producerRegId: {
			type: 'string',
			size: 32,
		},
		
		object: {
			type: 'text',
		},
	},

	populate: function (partner, data, cb) {
		var products = [];

		console.log("populate alco products");

		if (data == undefined) {
			cb();
			return;
		}
		
		for (var i = 0; i < data.length; i++) {
			var product = {};
			var item = data[i];
			var producer;
			var importer;
			
			product.fullName     = item["pref:FullName"][0];
			product.alcCode      = item["pref:AlcCode"][0];
			product.capacity     = item["pref:Capacity"][0];
			product.alcVolume    = item["pref:AlcVolume"][0];
			product.productVCode = item["pref:ProductVCode"][0];
			
			if (item["pref:Producer"] != undefined) {
				producer = item["pref:Producer"][0];
				product.producerRegId = producer["oref:ClientRegId"];
			}
			
			if (item["pref:Importer"] != undefined) {
				importer = item["pref:Importer"][0];
				product.importerRegId = importer["oref:ClientRegId"];
				
				product.inn = importer["oref:INN"][0];
				product.kpp = importer["oref:KPP"][0];
			}
			else
			{
				product.inn = producer["oref:INN"][0];
				product.kpp = producer["oref:KPP"][0];
			}

			product.object = JSON.stringify(item);

			products.push(product);
		}

		AlcoProducts.destroy({or: [{inn: partner.inn}, {producerRegId: partner.regId}]}).exec(function (err) {
			if (err) {
				cb(err);
				return;
			}

			AlcoProducts.create(products).exec(function (err) {
				cb(err);
			});
		});
	},
};

