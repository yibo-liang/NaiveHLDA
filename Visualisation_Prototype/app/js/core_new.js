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

    var client_rect = _this.container._groups[0][0].getBoundingClientRect();
    _this.config = {
        height: client_rect.height,
        width: client_rect.width,
        hexagon_scale: 80,
        min_hex_r: 80,
        transition_duration: 300,

    }


    _this.svg = null;
    _this.drag_wrap = null;
    _this.view = {
        zoom_scale: 1,
        zoom_power: 1,
        zoom_base: Math.sqrt(3),
        zoom_ease: d3.easeLinear,
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
        background: "rgba(233,233,233,1)",
        border: "rgba(155,155,200, 0.3)",
        cluster_border: "rgba(155,155,188,0.8)"
    }

    var prepare_data = function () {
        function set_all_position(data, parent_coor) {
            data.data.hexagons = [];
            for (var i = 0; i < 6; i++) {
                var a = (i + 0) / 6 * Math.PI * 2; //angle of this hex relative to parent center
                var x = _this.config.hexagon_scale * Math.cos(a) * (Math.sqrt(3) / 3);
                var y = _this.config.hexagon_scale * Math.sin(a) * (Math.sqrt(3) / 3);
                data.data.hexagons[i] = {
                    x: x,
                    y: y,
                    absolute_x: parent_coor.absolute_x + x * Math.pow(1 / 3, data.depth),
                    absolute_y: parent_coor.absolute_y + y * Math.pow(1 / 3, data.depth),
                    pos: i
                }
                //data.children[i].words = data.data.topics[i];

            }
            data.data.hexagons[i] = {
                x: 0,
                y: 0,
                absolute_x: parent_coor.absolute_x,
                absolute_y: parent_coor.absolute_y,
                pos: 6

            }
            //data.children[6].words = data.data.topics[6];
            //delete data.data.topics;

            delete data.data.submodels;

            if (data.children && data.children.length > 0) {
                for (var i = 0; i < data.children.length; i++) {
                    set_all_position(data.children[i], data.data.hexagons[i]);
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
                _this.topic_data.data.hexagons[i] = {
                    x: x,
                    y: y,
                    absolute_x: x,
                    absolute_y: y,
                    pos: i
                }

                set_all_position(_this.topic_data.children[i], _this.topic_data.data.hexagons[i]);
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

    var offsetx = _this.config.width / 2;
    var offsety = _this.config.height / 2;

    function drag_graph(super_group, transition) {
        if (transition) {
            super_group
                .transition()
                .duration(_this.config.transition_duration)
                .ease(_this.view.zoom_ease)
                .style("transform", "translate("
                    + (_this.view.x * _this.view.zoom_scale + offsetx) + "px,"
                    + (_this.view.y * _this.view.zoom_scale + offsety) + "px)"
                    + " scale(" + _this.view.zoom_scale + "," + _this.view.zoom_scale + ")");
        } else {
            super_group
                .style("transform", "translate("
                    + (_this.view.x * _this.view.zoom_scale + offsetx) + "px,"
                    + (_this.view.y * _this.view.zoom_scale + offsety) + "px)"
                    + " scale(" + _this.view.zoom_scale + "," + _this.view.zoom_scale + ")");

        }
    }

    _this.init = function (render_onload) {
        //init svg

        _this.svg = _this.container.append("svg")
            .attr("height", _this.config.height + "px")
            .attr("width", _this.config.width + "px")
            .attr("class", "hexmap")
            .attr("id", "hex_svg")


        _this.drag_wrap = _this.svg.append("g")
            .attr("class", "drag_wrap")
            .style("transform", "translate("
                + (_this.view.x * _this.view.zoom_scale + offsetx) + "px,"
                + (_this.view.y * _this.view.zoom_scale + offsety) + "px)"
                + " scale(" + _this.view.zoom_scale + "," + _this.view.zoom_scale + ")");

        _this.svg
            .on("mousedown", function () {
                _this.view.dragging = true;
                var pos = d3.mouse(this);
                _this.view.drag_start_pos.x = pos[0];
                _this.view.drag_start_pos.y = pos[1];

                _this.view.drag_d_pos.x = _this.view.x;
                _this.view.drag_d_pos.y = _this.view.y;

            })
            .on("mouseup", function () {
                if (_this.view.dragging) {
                    _this.render();
                }
                _this.view.dragging = false;


                console.log("mouseup")
            })
            .on("mousemove", function () {
                if (_this.view.dragging) {
                    var pos = d3.mouse(this);

                    var dx = pos[0] - _this.view.drag_start_pos.x;
                    var dy = pos[1] - _this.view.drag_start_pos.y;
                    //console.log("mousemove", dy, dx);
                    var scale = _this.view.zoom_scale;
                    _this.view.x = _this.view.drag_d_pos.x + dx / scale;
                    _this.view.y = _this.view.drag_d_pos.y + dy / scale;

                    drag_graph(_this.drag_wrap);
                }
            })

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


    var filter_invisible_hexagons = function (hexagons) {
        var padding = 50;
        //console.log(hexagons)
        var res = [];
        for (var i = 0; i < hexagons.length; i++) {
            //console.log(i, hexagons[i])
            var coor = {
                x: (hexagons[i].absolute_x + _this.view.x) * _this.view.zoom_scale + offsetx,
                y: (hexagons[i].absolute_y + _this.view.y) * _this.view.zoom_scale + offsety
            }
            //console.log(i, coor)
            if (coor.x > padding && coor.x < _this.config.width - padding
                && coor.y > padding && coor.y < _this.config.height - padding) {
                res.push(hexagons[i])
            }
        }
        return res;
    }

    var render_model = function (node_data, node_data_children, super_wrapper_group) {
        console.log("render_model", node_data.depth, node_data, node_data_children)
        //rendering
        //var hexagons = filter_invisible_hexagons(nd.data.hexagons);
        var hexagons = node_data.data.hexagons;
        var level_wrapper = super_wrapper_group
            .selectAll("g.wrap-single-" + node_data.depth)
            .data(hexagons, function (d) {
                return d.pos
            })
        var enter = level_wrapper.enter()


        var scale = node_data.depth > 0 ? 1 / 3 : 1; //scale for sub level
        var padding_shrink = (_this.config.hexagon_scale - 1) / _this.config.hexagon_scale;
        var polygon_wrap = enter.append("g")
            .attr("class", "wrap-single-" + node_data.depth)
            .style("transform", function (d, i) {
                return "translate(" + d.x + "px," + d.y + "px) " +
                    "scale(" + scale * padding_shrink + "," + scale * padding_shrink + ")";
            })

        polygon_wrap.append("polygon")
            .attr("points", hexagon_points(0, 0, 1 * _this.config.hexagon_scale))
            .style("fill", _this.colors.background)
            .style("stroke", _this.colors.border)
            .style("stroke-width", 1)

        polygon_wrap.each(function (d, i) {
            if (node_data_children[i].children) {
                console.log("go to ", d, i)
                var next = polygon_wrap.append("g")
                    .attr("class", "children")

                render_model(node_data_children[i], node_data_children[i].children, next)
            }
        })


        //render_enter(node_data, super_wrapper_group);
        //super_wrapper_group.selectAll("g.wrap-single-" + node_data[0].depth)
        //    .each(render_update)

    }

    _this.render = function () {
        console.log("re-rendering")
        render_model(_this.topic_data, _this.topic_data.children, _this.drag_wrap);
        return _this;
    }

    _this.enable_zooming = function () {

        bind_mousewheel("hex_svg", function (delta) {

            _this.view.zoom_power = Math.min(Math.max(delta * 1 + _this.view.zoom_power, 1), 7);
            _this.view.zoom_scale = Math.pow(_this.view.zoom_base, _this.view.zoom_power - 1 + 0.0001)

            _this.view.zoom_scale = Math.min(Math.max(_this.view.zoom_scale, 1), 27);
            console.log(delta, _this.view.zoom_scale, _this.view.zoom_power)

            drag_graph(_this.drag_wrap, true);
        })
        return _this;
    }

}