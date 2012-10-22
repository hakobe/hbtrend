var request = require('request');
var url     = require('url');
var querystring = require('querystring');
var libxmljs = require('libxmljs');

//var API_BASE = 'http://b.hatena.ne.jp/api/ipad.tag';
var API_BASE = 'http://b.hatena.ne.jp/search/tag';
http://b.hatena.ne.jp/search/tag?q=hoge&mode=rss&of=200&limit=1

exports.entries = function(req, res) {
    if (!req.query.tag) {
        res.status(404).send('404 Not Found');
        return;
    }

    var apiUrl = API_BASE + '?' + querystring.stringify({
        q     : req.query.tag,
        mode  : 'rss',
        of    : req.query.of,
    });
    request(apiUrl, function(error, response, body) {
        var xmlDoc = libxmljs.parseXml(body);
        var items = xmlDoc.root().find('//rss:item', { 'rss' : 'http://purl.org/rss/1.0/' });
        var entries = [];
        for (var i = 0, l = items.length; i < l; i++) {
            var item = items[i];
            var childNodes = item.childNodes();
            var entry = {};
            for (var ci = 0, cl = childNodes.length; ci < cl; ci++) {
                var childNode = childNodes[ci];
                var name = childNode.name();
                if (name === 'link') {
                    entry.url = childNode.text();
                }
                else if (name === 'title') {
                    entry.title = childNode.text();
                }
                else if (name === 'description') {
                    entry.description = childNode.text();
                }
                else if (name === 'date') {
                    entry.date = childNode.text();
                }
                else if (name === 'bookmarkcount') {
                    entry.bookmarkCount = parseInt(childNode.text());
                }
            }
            entries.push(entry);
        }
        res.json(entries);
    });
};


