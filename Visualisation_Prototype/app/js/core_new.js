/**
 * Created by Devid on 2017/2/1.
 */


function hierarchical_hexmap(dom_container) {

    var _this = this;


    _this.hexmap_data = null;
    _this.topic_data = null;
    _this.container = d3.select(dom_container);
    _this.loaded = false;
    _this.render_on_load = true;
    console.log(_this.container)

    var client_rect = _this.container._groups[0][0].getBoundingClientRect();
    _this.config = {
        height: client_rect.height,
        width: client_rect.width,
        hexagon_scale: 80,
        zoom_scale: 1,
        zoom_power: 1,
        zoom_base: Math.sqrt(3),
        zoom_ease: d3.easeLinear,
        min_hex_r: 80,
    }


    _this.svg = null;

    _this.view = {
        drag_d_pos: {
            x: 0,
            y: 0
        },
        drag_start_pos: {
            x: 0,
            y: 0
        },
        dragging: false,
        x: 0,
        y: 0
    }

    _this.colors = {
        background: "rgba(23,23,23,1)",
        border: "rgba(155,155,200, 0.3)",
        cluster_border: "rgba(155,155,188,0.8)"
    }

    var prepare_data = function () {

        function set_all_position(data) {
            data.data.hexagons = [];
            for (var i = 0; i < 6; i++) {
                var a = (i + 0) / 6 * Math.PI * 2; //angle of this hex relative to parent center
                var x = _this.config.hexagon_scale * Math.cos(a) * (Math.sqrt(3) / 3);
                var y = _this.config.hexagon_scale * Math.sin(a) * (Math.sqrt(3) / 3);
                data.data.hexagons[i] = {x: x, y: y}
                //data.children[i].words = data.data.topics[i];

            }
            data.data.hexagons[i] = {x: 0, y: 0}
            //data.children[6].words = data.data.topics[6];
            //delete data.data.topics;

            delete data.data.submodels;

            if (data.children && data.children.length > 0) {
                for (var i = 0; i < data.children.length; i++) {
                    set_all_position(data.children[i]);
                }

            }
            if (data.parent == null)
                data.is_root = true;
            else
                data.is_root = false;
            delete data.parent;
        }

        if (_this.hexmap_data && _this.topic_data) {
            _this.topic_data.data.hexagons = [];
            for (var i = 0; i < _this.topic_data.children.length; i++) {
                var hex_coor = _this.hexmap_data["hexmapData"][i].hexAggloCoord;

                var x = hex_coor.x * _this.config.hexagon_scale;
                var y = hex_coor.y * _this.config.hexagon_scale;
                _this.topic_data.data.hexagons[i] = {x: x, y: y}

                set_all_position(_this.topic_data.children[i]);
            }
            delete _this.topic_data.data.submodels;
            console.log(_this.topic_data)
            // _this.topic_data = JSON.parse(JSON.stringify(_this.topic_data));
            // _this.loaded = true;
            if (_this.render_on_load) {
                _this.render();
            }
        }


    }

    _this.load_topic_model = function (data_url, callback) {
        d3.json(data_url, function (data) {
            _this.topic_data = d3.hierarchy(data, function (d) {
                return d.submodels;
            });
            prepare_data(); //try prepare data
            if (callback) callback(_this);
        })
        return _this;
    }

    _this.load_hexmap_data = function (data_url, callback) {
        d3.json(data_url, function (data) {
            _this.hexmap_data = data;
            prepare_data(); //try prepare data
            if (callback) callback(_this);
        })
        return _this;
    }


    _this.init = function (render_onload) {
        //init svg
        _this.svg = _this.container.append("svg")
            .attr("height", _this.config.height + "px")
            .attr("width", _this.config.width + "px")
            .attr("class", "hexmap")

        if (render_onload) _this.render_on_load = render_onload;
        return _this;
    }


    var hexagon_points = function (centre_x, centre_y, r) {
        var points = "";
        for (var i = 0; i < 6; i++) {
            var rs = i / 6;
            var x = centre_x + Math.cos(Math.PI * 2 * rs + Math.PI / 6) * r;
            var y = centre_y + Math.sin(Math.PI * 2 * rs + Math.PI / 6) * r;
            points += x + "," + y;
            if (i < 5) {
                points += " ";
            }

        }
        return points;
    }


    var render_model = function (node_data, super_wrapper_group, trace) {
        console.log("--------------------------------------------")
        //
        console.log(node_data, super_wrapper_group)
        var selection = super_wrapper_group.selectAll("g.wrap-model-d" + node_data[0].depth)
            .data(node_data)

        var enter = selection.enter();


        var render_topics = function (node_data, i) {
            var hexagons = node_data.data.hexagons;

            var h = d3.select(this).selectAll("g.wrap-single-" + node_data.depth).data(hexagons)

            var e = h.enter()


            var scale = node_data.depth > 0 ? 1 / 3 : 1;
            var w = e.append("g")
                .attr("class", "wrap-single-" + node_data.depth)
                .style("transform", function (d, i) {
                    return "translate(" + d.x + "px," + d.y + "px) " +
                        "scale(" + scale + "," + scale + ")";
                })


            w.append("polygon")
                .attr("points", hexagon_points(0, 0, 1 * _this.config.hexagon_scale))
                .style("fill", _this.colors.background)
                .style("stroke", _this.colors.border)
                .style("stroke-width", 1)


            if (node_data.children) {
                var next = w.append("g")
                    .attr("class", "next")
                console.log("h", h, "e", next)
                render_model(node_data.children, next)
            }

        }

        enter.each(render_topics)

    }

    _this.render = function () {
        render_model([_this.topic_data], _this.svg);
        return _this;
    }


}