// chart
google.load('visualization', '1.0', {'packages':['corechart']});

var HBTrend = {
    Model      : {},
    Collection : {},
    View       : {},
    Router     : undefined,
};

HBTrend.Model.Tag = Backbone.Model.extend({
    defaults : function () {
        return {
            name : '',
            slots : new HBTrend.Collection.Slots(),
        };
    },
    addSlot : function (slot) {
        this.get('slots').push(slot);
    },
    addEntry : function (entry) {
        var entryDate = entry.get('date');
        this.get('slots').each(function( slot ) {
            if (
                slot.get('year')  == entryDate.getFullYear() &&
                slot.get('month') == entryDate.getMonth()    &&
                slot.get('date')  == entryDate.getDate()
            ) {
                slot.addEntry(entry);
            }
        });
        this.trigger('change');
    },
    addAllEntries : function (entries) {
        entries.each( _.bind(function(entry) {
            this.addEntry(entry);
        }, this));
    },
});

HBTrend.Model.Slot = Backbone.Model.extend({
    defaults : function () {
        return {
            year    : 0,
            month   : 0,
            date    : 0,
            entries : new HBTrend.Collection.Entries(),
        };
    },
    addEntry : function(entry) {
        this.get('entries').push(entry);
    },
    asDate : function() {
        return new Date( this.get('year'), this.get('month'), this.get('date') );
    },
}, {
    newByDate : function(d) {
        return new HBTrend.Model.Slot({
            year  : d.getFullYear(),
            month : d.getMonth(),
            date  : d.getDate(),
        });
    }
});

HBTrend.Model.Entry = Backbone.Model.extend({
    defaults : function () {
        return {
            url           : '',
            title         : '',
            description   : '',
            bookmarkCount : 0,
            image         : '',
            date          : new Date(),
        };
    },
});

HBTrend.Collection.Tags = Backbone.Collection.extend({
    model : HBTrend.Model.Tag,
});

HBTrend.Collection.Slots = Backbone.Collection.extend({
    model : HBTrend.Model.Slot,
    comparator : function(model) {
        return new Date(model.get('year'), model.get('month'), model.get('date')).getTime();
    },
});

HBTrend.Collection.Entries = Backbone.Collection.extend({
    model : HBTrend.Model.Entry,
    comparator : function(model) {
        return - model.get('count');
    },
});

HBTrend.View.TagInputBox = Backbone.View.extend({
    initialize : function() {
    },

    events : {
        'keyup' : 'keyup',
    },

    keyup : function(evt) {
        if (evt.keyCode == 13) {
            this.trigger('input', this.el.value);
        }
    },
});

HBTrend.View.Graph = Backbone.View.extend({
    initialize : function() {
        var drawGraph = _.throttle(_.bind(function() { this.draw() }, this), 100);
        this.collection.on('change', function() {
            drawGraph();
        });
        this.chart = undefined;
    },

    draw : function() {
        var rows = [];
        var dateRow = this.collection.at(0).get('slots').map( function( slot ) { return slot.asDate() } );
        rows.push(dateRow);
        this.collection.each(function (tag) {
            var row = [];
            tag.get('slots').each( function(slot) {
                //row.push( slot.get('entries').reduce( function(memo, entry) { return memo + entry.get('bookmarkCount'); }, 0 ) );
                row.push( slot.get('entries').length );
            });
            rows.push(row);
        });
        rows = _.zip.apply(_, rows);

        var dataTable = new google.visualization.DataTable();
        dataTable.addColumn('datetime', 'Date');
        this.collection.each( function(tag) {
            dataTable.addColumn('number', tag.get('name'));
        });

        dataTable.addRows( rows );

        this.chart = new google.visualization.LineChart(this.el);
        google.visualization.events.addListener(this.chart, 'ready', _.bind(function() {
            this.trigger('draw');
        }, this));
        this.chart.draw(dataTable, {
            width : 940,
            height : 200,
            vAxis : { title : 'n Entries' },
            pointSize: 3,
        });
        google.visualization.events.addListener(this.chart, 'select', _.bind(function() {
            var selection = this.chart.getSelection();
            this.trigger('select', selection[0].column, selection[0].row);
        }, this));
    },

    select : function( column, row ) {
        if (!this.chart) {
            return;
        }
        this.chart.setSelection([{row:row,column:column}]);
    },
});

HBTrend.View.Entries = Backbone.View.extend({
    initialize : function() {
        this.collection.on('add', this.add, this);
        this.collection.on('reset', this.reset, this);
    },
    reset : function() {
        $(this.el).empty();
    },
    add : function(entry) {
        var entriesItem = new HBTrend.View.EntriesItem({model:entry});
        this.el.appendChild( entriesItem.render().el );
    },
});

HBTrend.View.EntriesItem = Backbone.View.extend({
    tagName : 'li',
    className : 'entries-item',
    template : _.template($('#entries-item-template').html()),
    render : function() {
        $(this.el).html( this.template({
            title          : this.model.get('title'),
            description    : this.model.get('description'),
            url            : this.model.get('url'),
            bookmarkCount  : this.model.get('bookmarkCount'),
        }) );
        return this;
    },
});

HBTrend.EntriesLoader = function() { };
_.extend( HBTrend.EntriesLoader.prototype, Backbone.Events, {
    limit : 40,
    nextOffset : 0,
    load: function(tag) {
        var offset = this.nextOffset;
        if (offset > 1000) {
            return;
        }
        $.ajax({
            url  : '/api/entries.json',
            data : {
                tag    : tag.get('name'),
                of     : offset,
                limit  : this.limit,
            },
        }).done(_.bind(function(data) {
            var entries = new HBTrend.Collection.Entries();
            for (var i = 0, l = data.length; i < l; i++) {
                entries.add({
                    url           : data[i].url,
                    title         : data[i].title,
                    description   : data[i].description,
                    bookmarkCount : data[i].bookmarkCount,
                    image         : data[i].image,
                    date          : new Date(data[i].date),
                });
            }
            this.nextOffset = offset + this.limit;
            this.trigger('load', tag, entries);
        }, this));
    }
});

HBTrend.Router = Backbone.Router.extend({
    routes : {
        'trends/:tagpath' : 'index',
    },
    index : function(tagpath) {
        tagpath = decodeURIComponent(tagpath);
        var tags = new HBTrend.Collection.Tags();
        var inputView = new HBTrend.View.TagInputBox({ el : $('input#tags') });
        var graphView = new HBTrend.View.Graph({ el : $('div#graph'), collection : tags });
        var entriesView = new HBTrend.View.Entries({ el : $('ul#entries'), collection : new HBTrend.Collection.Entries() });

        inputView.on('input', _.bind(function (newTags) {
            this.navigate('trends/' + encodeURIComponent( newTags ), { trigger : true } );
        }, this));

        tags.on('add', function(tag) {
            var now = new Date().getTime();
            _.range(0,14).forEach(function(i) {
                tag.addSlot(HBTrend.Model.Slot.newByDate( new Date( now - (60 * 60 * 24 * 1000) * i ) ));
            });
            var entriesLoader = new HBTrend.EntriesLoader();
            entriesLoader.load(tag);
            entriesLoader.on('load', function (tag, entries) {
                tag.addAllEntries(entries);
                var firstSlot = tag.get('slots').first();
                if (
                    entries.length > 0                                                   &&
                    firstSlot.asDate().getTime() <= entries.last().get('date').getTime() &&
                    firstSlot.get('entries').length == 0
                ) {
                    entriesLoader.load(tag);
                }
            });
        });

        var showEntriesAt = function(tagIndex, slotIndex) {
            var entries = tags.at(tagIndex).get('slots').at(slotIndex).get('entries');
            entriesView.collection.reset();
            entriesView.collection.add( entries.models );
        };

        graphView.on('draw', function() {
            graphView.select( tags.length, 12 );
            showEntriesAt( tags.length - 1, 12);
        });

        graphView.on('select', function( column, row ) {
            showEntriesAt( column - 1, row);
        });

        if (tagpath) {
            inputView.el.value = tagpath;
            tags.reset();
            tagpath = tagpath.replace(/^\s*/, '');
            tagpath = tagpath.replace(/\s*$/, '');
            tags.add(_.map( tagpath.split(/\s*,\s*/).slice(0,4) , function(t) { return { name : t }; } ));
        }
    },
});

$(function run() {
    new HBTrend.Router();
    Backbone.history.start( { pushState: true } );
});
