/**
 * AlcoProductsController
 *
 * @description :: Server-side logic for managing Alcoproducts
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {
	browse: function (req, resp) {
		var find = {};
		
		if (req.param("sort") != undefined) {
			find.sort = req.param("sort") + " " + req.param("order");
		}
		
		find.where = {}
		if (req.param("inn") != undefined) {
			find.where.inn = req.param("inn");
		}
		if (req.param("kpp") != undefined) {
			find.where.kpp = req.param("kpp");
		}

		AlcoProducts.count(find).exec(function (err, count) {
			AlcoProducts.find(find).paginate({page: req.param("page"), limit: req.param("per_page")}).exec(function (err, items) {
				resp.json({total_count: count, items: items});
			});
		});
	},
};

