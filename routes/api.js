var request = require('request');
var url     = require('url');
var querystring = require('querystring');
var libxmljs = require('libxmljs');
var Memcached = require('memcached');

//var API_BASE = 'http://b.hatena.ne.jp/api/ipad.tag';
var API_BASE = 'http://b.hatena.ne.jp/search/tag';


function convertRssToJSON(xml) {
    var xmlDoc = libxmljs.parseXml(xml);
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
    return entries;
}

exports.entries = function(req, res) {
    var tag = req.query.tag;
    var offset = req.query.of || 0;
    if (!req.query.tag) {
        res.status(404).send('404 Not Found');
        return;
    }

    var memcached = new Memcached('127.0.0.1:11211');

    var cacheKey = ['hbtrend-api-entries', tag, offset].join('-')
    memcached.get(cacheKey, function (err, result) {
        if (err) {
            console.error(err);
        }

        if (result) {
            memcached.end();
            res.json( result );
            return;
        }

        if (err || !result) {
            var apiUrl = API_BASE + '?' + querystring.stringify({
                q     : tag,
                mode  : 'rss',
                of    : offset,
            });
            request(apiUrl, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    var entries;
                    try {
                        entries = convertRssToJSON(body);
                    }
                    if (entries) {
                        memcached.set(cacheKey, entries, 60 * 60, function(err, result) {
                            if (err) {
                                console.error(err);
                            }
                            memcached.end();
                            res.json(entries);
                        });
                    }
                }
            });
        }
    });
};


