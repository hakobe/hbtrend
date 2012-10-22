exports.trends = function(req, res){
    var tags = req.params[0];
    if (!tags) {
        res.redirect('/trends/javascript,perl,ruby');
    }
    res.render('trends', { title: 'Hatena::Bookmark Trend' });
};
