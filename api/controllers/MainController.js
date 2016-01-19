/**
 * MainController
 *
 * @description :: Server-side logic for managing mains
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {
	index: function (req, res) {
		res.view();
	},

	partners: function (req, res) {
		res.view();
	},

	alcoproducts: function (req, res) {
		res.view({args: {inn: req.param("inn"), kpp: req.param("kpp")}});
	},
	
	ttn: function (req, res) {
		res.view();
	}
};

