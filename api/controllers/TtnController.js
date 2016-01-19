/**
 * TtnController
 *
 * @description :: Server-side logic for managing ttns
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {
	browse: function (req, resp) {
		if (req.isSocket) {
			Ttn.watch(req);
		}
		
		var find = {};
		if (req.param("sort") != undefined) {
			find.sort = req.param("sort") + " " + req.param("order");
		}
		
		find.where = {ttnRaw: {'!': null}};
		console.log("Page: " + req.param("page"));
		console.log("PerPage: " + req.param("per_page"));

		Ttn.count(find).exec(function (err, count) {
			Ttn.find(find).paginate({page: req.param("page"), limit: req.param("per_page")}).exec(function (err, items) {
				if (!items) {
					resp.json({total_count: 0, items: []});
					return;
				}
				
				var len = items.length;
				for (var i = 0; i < len; i++) {
					items[i].unpack();
				}
				resp.json({total_count: count, items: items});
				
				if (req.isSocket) {
					Ttn.subscribe(req, _.pluck(items, 'id'), ['update']);
				}
			});
		});
	},
	
	accept: function (req, resp) {
		Ttn.accept(req.param("id"), req.param("real_quantities"), function (err, record) {
		});
	},
	
	reject: function (req, resp) {
		Ttn.reject(req.param("id"), function (err, record) {
		});
	},
};

