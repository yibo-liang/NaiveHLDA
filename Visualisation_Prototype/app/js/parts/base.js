/**
 * Created by Devid on 06/05/2017.
 */

//d3 v3 module, removed in v4, but useful in our app

// Method is assumed to be a standard D3 getter-setter:
// If passed with no arguments, gets the value.
// If passed with arguments, sets the value and returns the target.
function d3_rebind(target, source, method) {
    return function () {
        var value = method.apply(source, arguments);
        return value === source ? target : value;
    };
}
d3.rebind = function (target, source) {
    var i = 1, n = arguments.length, method;
    while (++i < n) target[method = arguments[i]] = d3_rebind(target, source, source[method]);
    return target;
};

var base_hexmap = function (dom_container) {
    var _this = this;
    var colors = {EU: "#5B5EA6", UK: "#D65076", US: "#05A0FF", CN: "#FF0505"};


    _this.groupColors = [
        'rgba(188, 36, 60,0.3)',
        'rgba(91, 94, 166,0.3)',
        'rgba(0, 152, 116,0.3)',
        'rgba(221, 65, 36,0.3)',
        'rgba(239, 192, 80,0.3)',
        'rgba(111, 65, 129,0.3)',
        'rgba(195, 68, 122,0.3)',
        'rgba(178, 186, 182,0.3)',
        'rgba(147, 86, 53,0.3)',
        'rgba(85, 180, 176,0.3)'
    ];


    _this.backend_server = null;
    _this.data_dir = null;
    _this.hexmap_data = null;
    _this.topic_data = null;
    _this.container = d3.select(dom_container);


    _this.documents = {}; //dictionary for documents, should be {id: document_object, id2: doc_obj2, ...}
    _this.topic_doc_distribution = {}; //cached topic doc distribution , in format of {topic_trace: [list of document]}


    _this.config = {
        height: null,
        width: null,
        hexagon_scale: 100,
        min_hex_r: 100,
        transition_duration: 300,
        max_depth: 2,
        cluster_border_width: 1.5,
        panel_width: null,
        cloud_height: 300,
    };




    _this.set_backend = function (host) {
        _this.backend_server = host;
        //console.log(_this.backend_server);
        return _this;
    };


    _this.init_list = [];
    _this.init = function () {
        for (var i in _this.init_list) {
            console.log("initial task:", _this.init_list[i].name);
            _this.init_list[i]();
        }
        return _this;
    };

    _this.postload_list = [];
    _this.postload = function () {
        for (var i in _this.postload_list) {
            console.log("post load task:", _this.postload_list[i].name);
            _this.postload_list[i]();
        }
        return _this;
    }


}