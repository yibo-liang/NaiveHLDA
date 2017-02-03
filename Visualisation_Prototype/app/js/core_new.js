/**
 * Created by Devid on 2017/2/1.
 */


function hierarchical_hexmap(dom_container) {

    var _this = this;


    _this.groupColors = [
        'rgba(188, 36, 60,0.5)',
        'rgba(91, 94, 166,0.5)',
        'rgba(0, 152, 116,0.5)',
        'rgba(221, 65, 36,0.5)',
        'rgba(239, 192, 80,0.5)',
        'rgba(111, 65, 129,0.5)',
        'rgba(195, 68, 122,0.5)',
        'rgba(178, 186, 182,0.5)',
        'rgba(147, 86, 53,0.5)',
        'rgba(85, 180, 176,0.5)'
    ];

    _this.hexmap_data = null;
    _this.topic_data = null;
    _this.container = d3.select(dom_container);
    _this.panel = null;
    _this.mini_map = null;
    _this.word_cloud = null;


    _this.loaded = false;
    _this.render_on_load = true;

    _this.boundary_box = null;

    _this.config = {
        height: null,
        width: null,
        hexagon_scale: 100,
        min_hex_r: 100,
        transition_duration: 300,
        max_depth: 2,
        cluster_border_width: 1.5,
        panel_width: 500,
        cloud_height: 300,
    }


    _this.svg = null;
    _this.view_wrap = null;

    _this.view = {
        minimap_height: 140,
        minimap_scale: null,
        minimap_offsetx: null,
        minimap_offsety: null,

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
        background: "rgba(255,255,255,0.95)",
        border: "rgba(233,233,233, 1)",
        cluster_border: "rgba(199,199,199,1)"
    }

    //helper function
    var zoom_depth = function () {
        var k = Math.log(_this.view.zoom_scale) / Math.log(_this.view.zoom_base);
        return Math.ceil((k + 1) / 2) - 1;
    }

    var padding_shrink = function (node_data) {
        return (_this.config.hexagon_scale -
            (node_data.depth == 0 ? _this.config.cluster_border_width : 0))
            / _this.config.hexagon_scale;

    }


    var zoom_to_depth = function (depth, dx, dy) {
        var dpower = (depth + 1) * 2 + 1;
        if (-dx == _this.view.x && -dy == _this.view.y || dpower < _this.view.zoom_power) {
            _this.view.zoom_power = (depth + 1) * 2 + 1;
            _this.view.zoom_power = Math.min(Math.max(_this.view.zoom_power, 1), 7);
            _this.view.zoom_scale = Math.pow(_this.view.zoom_base, _this.view.zoom_power - 1)
        }

        _this.view.x = -dx;
        _this.view.y = -dy;
        drag_graph(_this.view_wrap, true);
        _this.render();
    }

    var prepare_data = function () {

        //function to find cluster neighbour and borders for top level
        var boundary_box = {
            min_x: 9999,
            min_y: 9999,
            max_x: -9999,
            max_y: -9999
        }

        function determineRr(hexagons) {
            //Determines hexagon radius 'r' from min distance of neighbours
            //Find distance between immediate neighbours
            var d2 = 0, dMin2 = 100000000000000000000000000000;
            for (var n = 0; n < hexagons.length; n++) {
                for (var m = n + 1; m < hexagons.length; m++) {
                    var dx = hexagons[n].x - hexagons[m].x;
                    var dy = hexagons[n].y - hexagons[m].y;

                    d2 = dx * dx + dy * dy;
                    if (d2 < dMin2) dMin2 = d2;
                }
            }
            return Math.sqrt(dMin2) / 2;
        }

        function addImmediateNeighboursAndBorders(hexagons) {
            //Function that finds list of immediate hexagon neighbours
            var r = determineRr(hexagons);
            console.log(r)
            var dMin2 = r * r * 4; //squarded distance between immediate neighbours

            function addNeighbour(relativePosition, n, i, dx, dy) {
                if (hexagons[n].cluster_id !== hexagons[m].cluster_id) {
                    hexagons[n].borders.push(i);

                }

                hexagons[n].neighbours[i] = {};
                hexagons[n].neighbours[i].type = relativePosition;
                hexagons[n].neighbours[i].topic_id = hexagons[m].topic_id;
                hexagons[n].neighbours[i].dx = dx;
                hexagons[n].neighbours[i].dy = dy;
                hexagons[n].neighbours[i].d2 = d2;
                hexagons[n].neighbours[i].sideNo = i;
            }

            for (var n = 0; n < hexagons.length; n++) {
                hexagons[n].neighbours = [];
                hexagons[n].borders = [];
                for (var m = 0; m < hexagons.length; m++) {
                    var dx = hexagons[m].x - hexagons[n].x;
                    var dy = hexagons[m].y - hexagons[n].y;
                    var d2 = dx * dx + dy * dy;

                    if (d2 < 1.1 * dMin2 && n != m) {
                        if (dx > 1.8 * r) addNeighbour("horiz-right", n, 1, dx, dy);
                        else if (dx < -1.8 * r) addNeighbour("horiz-left", n, 4, dx, dy);
                        else if (dx > 0 && dy < 0) addNeighbour("upper-right", n, 0, dx, dy);
                        else if (dx > 0 && dy > 0) addNeighbour("lower-right", n, 2, dx, dy);
                        else if (dx < 0 && dy < 0) addNeighbour("upper-left", n, 5, dx, dy);
                        else if (dx < 0 && dy > 0) addNeighbour("lower-left", n, 3, dx, dy);
                    }
                }

                for (var i = 0; i < 6; i++) {
                    if (!hexagons[n].neighbours[i]) hexagons[n].borders.push(i);
                }
            }
        }

        //function to set position recursively, initially
        function set_all_position(data, parent_coor) {
            data.data.hexagons = [];
            for (var i = 0; i < 6; i++) {
                var a = (i) / 6 * Math.PI * 2; //angle of this hex relative to parent center
                var x = _this.config.hexagon_scale * Math.cos(a) * (Math.sqrt(3) / 3);
                var y = _this.config.hexagon_scale * Math.sin(a) * (Math.sqrt(3) / 3);
                data.data.hexagons[i] = {
                    x: x,
                    y: y,
                    absolute_x: parent_coor.absolute_x + x * Math.pow(1 / 3, data.depth - 1),
                    absolute_y: parent_coor.absolute_y + y * Math.pow(1 / 3, data.depth - 1),
                    pos: i
                }

                //update boundary box
                var d = data.data.hexagons[i];
                if (d.absolute_x > boundary_box.max_x) boundary_box.max_x = d.absolute_x;
                if (d.absolute_y > boundary_box.max_y) boundary_box.max_y = d.absolute_y;
                if (d.absolute_x < boundary_box.min_x) boundary_box.min_x = d.absolute_x;
                if (d.absolute_y < boundary_box.min_y) boundary_box.min_y = d.absolute_y;


            }
            data.data.hexagons[6] = {
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
                    cluster_id: _this.hexmap_data["hexmapData"][i].clusterAgglomerative,
                    topic_id: _this.hexmap_data["hexmapData"][i].topicId,
                    x: x,
                    y: y,
                    absolute_x: x,
                    absolute_y: y,
                    pos: i
                }
                //update boundary box value
                var d = _this.topic_data.data.hexagons[i];
                if (d.absolute_x > boundary_box.max_x) boundary_box.max_x = d.absolute_x;
                if (d.absolute_y > boundary_box.max_y) boundary_box.max_y = d.absolute_y;
                if (d.absolute_x < boundary_box.min_x) boundary_box.min_x = d.absolute_x;
                if (d.absolute_y < boundary_box.min_y) boundary_box.min_y = d.absolute_y;


                set_all_position(_this.topic_data.children[i], _this.topic_data.data.hexagons[i]);
            }
            delete _this.topic_data.data.submodels;
            addImmediateNeighboursAndBorders(_this.topic_data.data.hexagons)
            console.log(_this.topic_data)
            // _this.topic_data = JSON.parse(JSON.stringify(_this.topic_data));
            // _this.loaded = true;
            _this.boundary_box = boundary_box;
            if (_this.render_on_load) {
                enter_render(_this.topic_data, _this.view_wrap);
                update_render(_this.topic_data, _this.view_wrap);
                enable_minimap();
            }

        }


    }

    _this.load_topic_model = function (data_url, callback) {
        d3.json(data_url, function (data) {
            _this.topic_data = d3.hierarchy(data, function (d) {
                return d.submodels;
            });
            console.log("topic data loaded", data)
            prepare_data(); //try prepare data
            if (callback) callback(_this);
        })
        return _this;
    }

    _this.load_hexmap_data = function (data_url, callback) {
        d3.json(data_url, function (data) {
            _this.hexmap_data = data;
            console.log("hexmap data loaded", data)
            prepare_data(); //try prepare data
            if (callback) callback(_this);
        })
        return _this;
    }


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
        change_minimap_view();
    }

    var offsetx;
    var offsety
    _this.init = function (render_onload) {
        //init svg

        var client_rect = _this.container._groups[0][0].getBoundingClientRect();
        _this.config.width = client_rect.width - _this.config.panel_width;
        _this.config.height = client_rect.height;
        //adding panel


        offsetx = _this.config.width / 2;
        offsety = _this.config.height / 2;


        _this.panel = _this.container.append("div")
            .attr("class", "panel")
            .style("position", "absolute")
            .style("left", _this.config.width + "px")
            .style("height", _this.config.height + "px")
            .style("width", _this.config.panel_width + "px")

        var panel_wrap = _this.panel.append("div")
            .style("position", "relative")
            .style("height", "100%")
            .style("width", "100%")

        //adding svg
        _this.svg = _this.container.append("svg")
            .attr("height", _this.config.height + "px")
            .attr("width", _this.config.width + "px")
            .attr("class", "hexmap")
            .attr("id", "hex_svg")

        //a group wrap for dragging and zooming
        _this.view_wrap = _this.svg.append("g")
            .attr("class", "view_wrap")
            .style("transform", "translate("
                + (_this.view.x * _this.view.zoom_scale + offsetx) + "px,"
                + (_this.view.y * _this.view.zoom_scale + offsety) + "px)"
                + " scale(" + _this.view.zoom_scale + "," + _this.view.zoom_scale + ")");

        //wordcloud

        _this.word_cloud = panel_wrap.append("div")
            .style("height", "300px")
            .style("width", "100%");


        //binding mouse events for dragging effect
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
                //console.log("mouseup")
            })
            .on("mouseleave", function () {
                if (_this.view.dragging) {
                    _this.render();
                }
                _this.view.dragging = false;
                //console.log("mouseleave")
            })
            .on("mousemove", function () {
                if (_this.view.dragging) {
                    var pos = d3.mouse(this);

                    var dx = pos[0] - _this.view.drag_start_pos.x;
                    var dy = pos[1] - _this.view.drag_start_pos.y;
                    //console.log("mousemove", dy, dx);
                    var scale = _this.view.zoom_scale;
                    var nx = _this.view.drag_d_pos.x + dx / scale;
                    var ny = _this.view.drag_d_pos.y + dy / scale;

                    _this.view.x = Math.min(Math.max(_this.boundary_box.min_x, nx), _this.boundary_box.max_x);
                    _this.view.y = Math.min(Math.max(_this.boundary_box.min_y, ny), _this.boundary_box.max_y);

                    drag_graph(_this.view_wrap);
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

    var enable_minimap = function () {
        var dx = (_this.boundary_box.max_x - _this.boundary_box.min_x);
        var dy = (_this.boundary_box.max_y - _this.boundary_box.min_y);
        var hw_scale = dx / dy

        var padding = 20;

        _this.mini_map = _this.container.append("div")
            .attr("class", "mini-map")
            .style("position", "absolute")
            .style("left", "30px")
            .style("top", _this.config.height - _this.view.minimap_height - padding * 2 - 30 + "px")
            .style("height", _this.view.minimap_height + padding * 2 + "px")
            .style("width", _this.view.minimap_height * hw_scale + padding * 2 + "px")
            .append("div")
            .style("position", "relative")
            .on("click", function () {
                var coordinates = d3.mouse(this);
                _this.view.x = (-coordinates[0] + _this.view.minimap_offsetx) / _this.view.minimap_scale;
                _this.view.y = (-coordinates[1] + _this.view.minimap_offsety) / _this.view.minimap_scale;
                drag_graph(_this.view_wrap, true);
                _this.render();
            })

        _this.mini_map.append("div")
            .attr("class", "mini-map-view")
            .style("height", _this.view.minimap_height + padding * 2 + "px")
            .style("width", _this.view.minimap_height * hw_scale + padding * 2 + "px")

        _this.mini_map.append("canvas")
            .attr("class", "mini-map-canvas")
            .attr("height", _this.view.minimap_height + padding * 2 + "px")
            .attr("width", _this.view.minimap_height * hw_scale + padding * 2 + "px")

        var scale = (_this.view.minimap_height) / dy;
        _this.view.minimap_scale = scale;

        var m_hex_r = _this.config.hexagon_scale * scale;
        var hexagons = _this.topic_data.data.hexagons;

        var canvas = _this.mini_map.select("canvas")._groups[0][0];

        var ox = dx / 2 * scale + padding;
        var oy = dy / 2 * scale + padding

        _this.view.minimap_offsetx = ox;
        _this.view.minimap_offsety = oy;


        console.log(scale, m_hex_r, canvas)
        var ctx = canvas.getContext("2d");
        ctx.strokeStyle = "rgba(55,55,55,0.5)"
        ctx.strokeWidth = "1"
        for (var i = 0; i < hexagons.length; i++) {
            ctx.beginPath();

            ctx.fillStyle = _this.groupColors[(_this.hexmap_data["hexmapData"][i].clusterAgglomerative)];

            var r = 0.5 / 6 * Math.PI * 2;
            var x = hexagons[i].absolute_x * scale + m_hex_r * Math.cos(r) + ox;
            var y = hexagons[i].absolute_y * scale + m_hex_r * Math.sin(r) + oy;
            ctx.moveTo(x, y)
            console.log(hexagons[i], x, y)
            for (var j = 1; j < 6; j++) {

                var r = (j + .5) / 6 * Math.PI * 2;
                var x = hexagons[i].absolute_x * scale + m_hex_r * Math.cos(r) + ox;
                var y = hexagons[i].absolute_y * scale + m_hex_r * Math.sin(r) + oy;
                ctx.lineTo(x, y);
                console.log(x, y)
            }
            ctx.closePath();
            ctx.stroke()
            ctx.fill();
        }


    }

    var change_minimap_view = function () {
        var mini_view = _this.mini_map.select("div.mini-map-view");
        var scale = 1 / _this.view.zoom_scale;
        mini_view
            .transition()
            .ease(_this.view.zoom_ease)
            .style("transform", "scale(" + scale + "," + scale + ") "
                + "translate(" + (-_this.view.x * _this.view.minimap_scale / scale) + "px,"
                + (-_this.view.y * _this.view.minimap_scale / scale) + "px)")
    }


    var filter_invisible_hexagons = function (hexagons, depth) {
        var padding = -_this.config.min_hex_r * _this.view.zoom_scale;
        var res = [];
        var display_r = Math.pow(1 / 3, depth) * _this.config.hexagon_scale * _this.view.zoom_scale;

        for (var i = 0; i < hexagons.length; i++) {
            var coor = {
                x: (hexagons[i].absolute_x + _this.view.x) * _this.view.zoom_scale + offsetx,
                y: (hexagons[i].absolute_y + _this.view.y) * _this.view.zoom_scale + offsety
            }

            if (zoom_depth() < depth) { // too small to see
                hexagons[i].visible = false;
                res.push(hexagons[i])
            } else if (coor.x > padding && coor.x < _this.config.width - padding //visible within svg
                && coor.y > padding && coor.y < _this.config.height - padding) {
                hexagons[i].visible = true;
                res.push(hexagons[i])
            } else { //out of the visible svg
                hexagons[i].visible = false;
                res.push(hexagons[i])
            }
        }
        return res;
    }

    function draw_boarders(container, node_data, borders) {
        //console.log("borders", borders)
        var shrink = padding_shrink(node_data);
        container.selectAll("path")
            .data(borders)
            .enter()
            .append("path")
            .attr("d", function (datum, i) {
                var rotate = datum - 1;
                var r = 1 * _this.config.hexagon_scale / shrink;
                var rs1 = ((rotate - 1) ) / 6;
                var x1 = 0 + Math.cos(Math.PI * 2 * rs1 + Math.PI / 6) * r;
                var y1 = 0 + Math.sin(Math.PI * 2 * rs1 + Math.PI / 6) * r;
                var rs2 = (rotate) / 6;
                var x2 = 0 + Math.cos(Math.PI * 2 * rs2 + Math.PI / 6) * r;
                var y2 = 0 + Math.sin(Math.PI * 2 * rs2 + Math.PI / 6) * r;
                return "M" + x1 + " " + y1 + " L" + x2 + " " + y2;

            })
            .attr("stroke", _this.colors.cluster_border)
            .attr("stroke-width", "2")
            .attr("stroke-linecap", "round")
            .style("z-index", 999)
            .style("opacity", 0)
            .transition()
            .style("opacity", 1)
    }


    function draw_pie_in_group(group, pie_data, sibling_models) {
        function get_value_range(model) {

            var get_sum = function (d) {
                var res;
                if (d.topicClassesDistrib)
                    res = d.topicClassesDistrib[0].weightedValueSum + d.topicClassesDistrib[1].weightedValueSum;
                else {
                    res = d[0].weightedValueSum + d[1].weightedValueSum;
                }
                //console.log("res", res)
                return res;
            }
            var arr = []

            for (key in model) {
                arr.push(get_sum(model[key]));
            }

            //console.log("getsum", arr)
            return {
                min: Math.min.apply(Math, arr),
                max: Math.max.apply(Math, arr),
            }
        }

        // require [{name: eu, val: num, proj: num},...]
        var colors = {EU: "#5B5EA6", UK: "#D65076"};

        var sum = pie_data[0].weightedValueSum + pie_data[1].weightedValueSum;

        var pie = d3.pie()
            .value(function (d) {
                return d.weightSum;
            })(pie_data)
        var range = get_value_range(sibling_models);

        var min_radius_percentage = 1 / 5;

        var radius = _this.config.hexagon_scale * Math.sqrt(3) / 2;
        //console.log(radius, range)
        radius = radius * min_radius_percentage + radius * (1 - min_radius_percentage) * ((sum - range.min) / (range.max - range.min));

        //console.log("r2", radius)

        var arc = d3.arc()
            .outerRadius(radius)
            .innerRadius(0)

        var pie_g = group.selectAll(".arc")
            .data(pie)
            .enter()

        pie_g.insert("path", ":first-child")
            .style("opacity", "0.3")
            .attr("class", "arc")
            .attr("d", arc)
            .style("fill", function (d, i) {
                return colors[d.data.classID];
            })
    }

    var zoom_fade = function (node_data) {
        if (zoom_depth() !== node_data.depth && node_data.depth !== _this.config.max_depth) {
            return 0.05
        }
        return 1;
    }

    var show_cloud = function (topic_words) {
        var max = d3.max(topic_words, weight);
        var min = d3.min(topic_words, weight);

        function weight(d) {
            return d.weight;
        }

        function fontsize(d) {
            return 15 + 10 * (d.weight - min) / (max - min);
        }

        d3.layout.cloud().size([_this.config.panel_width, 300])
            .words(topic_words)
            .text(function (d) {
                return d.label
            })
            .rotate(0)
            .fontSize(fontsize)
            .spiral('rectangular')
            .padding(5)
            .font('Arial, Helvetica, sans-serif')
            .random(function () {
                return 0.5;
            })
            .on("end", draw)
            .start();

        function draw(words) {
            console.log(words)
            var selection = _this.word_cloud.selectAll("text").data(words);

            selection.enter()
                .append("text")
                .style("font-size", fontsize)
                .attr("transform", function (d) {
                    return "translate(" + [d.x, d.y] + ") rotate(" + d.rotate + ")";
                })
                .text(function (d) {
                    return d.label;
                })


        }

    }


    var draw_topic = function (container, node_data, d, i) {


        if (d.visible) {
            //draw polygon
            container.append("polygon")
                .attr("points", hexagon_points(0, 0, 1 * _this.config.hexagon_scale))
                .style("fill", _this.colors.background)
                .style("stroke", _this.colors.border)
                .style("stroke-width", 1)

            //draw borders for toplevel
            if (node_data.depth == 0) {
                draw_boarders(container, node_data, d.borders);
            }

            //draw pie

            var data_group = container.append("g")
                .attr("class", "data")
                .style("opacity", 0)

            draw_pie_in_group(data_group, node_data.data.topicClassesDistrib[i], node_data.data.topicClassesDistrib);


            //draw texts
            var texts = node_data.data.topics[i];
            var visible_texts = texts
                .sort(function (a, b) {
                    return b.weight - a.weight;
                })
                .slice(0, 3)
            var text_group = data_group.append("g")
                .attr("class", "texts")
            text_group.selectAll("text")
                .data(visible_texts)
                .enter()
                .append("text")
                .text(function (d) {
                    return d.label
                })
                .style("transform", function (d, i) {
                    var font_size = 24;
                    var order = [0, 1, -1]
                    return "translate(" + 0 + "," + (order[i]) * font_size + "px)"
                })
                .style("font-size", function (d, i) {
                    return i == 0 ? "18" : "14";
                })
                .style("font-weight", function (d, i) {
                    return i == 0 ? "600" : "400";
                })
                .style("text-anchor", "middle")

            data_group
                .transition()
                .duration(_this.config.transition_duration)
                .style("opacity", zoom_fade(node_data))

            var cc = clickcancel();
            container.call(cc);
            cc
                .on("dblclick", function () {
                    console.log("click dpth = " + 0);
                    zoom_to_depth(node_data.depth, d.absolute_x, d.absolute_y);
                })
                .on("click", function () {
                    show_cloud(node_data.data.topics[i]);
                })
        }

    }

    var enter_render = function (node_data, super_wrapper_group) {
        var node_data_children = node_data.children;

        var scale = node_data.depth > 0 ? 1 / 3 : 1; //scale for sub level
        var shrink = padding_shrink(node_data);

        var hexagons = filter_invisible_hexagons(node_data.data.hexagons, node_data.depth);

        //wrap for all hex
        var hexagons_wrap = super_wrapper_group
            .append("g")
            .attr("class", "hex-wrap-" + node_data.depth)

        //data selection
        var selection = hexagons_wrap
            .selectAll("g.wrap-single-" + node_data.depth)
            .data(hexagons, function (d) {
                return d.pos
            })

        //enter selection

        selection.enter().append("g")
            .attr("class", "wrap-single-" + node_data.depth)
            .style("transform", function (d, i) {
                return "translate(" + d.x + "px," + d.y + "px) " +
                    "scale(" + scale * shrink + "," + scale * shrink + ")";
            })
            .each(function (d, i) {
                draw_topic(d3.select(this), node_data, d, d.pos)
            })

        if (node_data_children && node_data_children.length > 0) {

            var next = super_wrapper_group
                .append("g")
                .attr("class", "children-" + node_data.depth)

            selection.enter().each(function (d, i) {

                var next_level_wrap = next.append("g")
                    .attr("class", "level-wrap-" + (node_data.depth + 1))
                    .style("transform", "translate(" + d.x + "px," + d.y + "px) " +
                        "scale(" + scale * shrink + "," + scale * shrink + ")"
                    )
                    .attr("info", function () {
                        return d.pos
                    })
                enter_render(node_data_children[i], next_level_wrap)
            })
        }
    }

    var update_render = function (node_data, super_wrapper_group) {


        var node_data_children = node_data.children;

        var scale = node_data.depth > 0 ? 1 / 3 : 1; //scale for sub level
        var shrink = padding_shrink(node_data)
        //rendering
        //hexagon data, position
        var hexagons = filter_invisible_hexagons(node_data.data.hexagons, node_data.depth);
        hexagons = hexagons.filter(function (d) {
            return d.visible
        })

        //wrap for all hex
        var hexagons_wrap = super_wrapper_group
            .select("g.hex-wrap-" + node_data.depth)

        //data selection
        var selection = hexagons_wrap
            .selectAll("g.wrap-single-" + node_data.depth)
            .data(hexagons, function (d) {
                return d.pos
            })

        //enter
        var polygon_wrap_enter = selection.enter().append("g")
            .attr("class", "wrap-single-" + node_data.depth)
            .style("opacity", 0)
            .style("transform", function (d) {
                return "translate(" + d.x + "px," + d.y + "px) " +
                    "scale(" + scale * shrink + "," + scale * shrink + ")";
            })
            .each(function (d, i) {
                draw_topic(d3.select(this), node_data, d, d.pos)
            })
            .transition()
            .duration(500)
            .style("opacity", 1)


        // //update

        selection.select("g.data")
            .transition()
            .duration(500)
            .style("opacity", zoom_fade(node_data))


        //exit
        selection.exit()
            .transition()
            .duration(_this.config.transition_duration)
            .style("opacity", 0)
            .remove()

        //sub models
        var next = super_wrapper_group
            .select("g.children-" + node_data.depth)

        next.selectAll("g.level-wrap-" + (node_data.depth + 1))
            .each(function (d, i) {
                update_render(node_data_children[i], d3.select(this))
            })


    }

    _this.render = function () {
        //console.log("re-rendering")
        update_render(_this.topic_data, _this.view_wrap);
        return _this;
    }

    _this.enable_zooming = function () {

        bind_mousewheel("hex_svg", function (delta) {
            _this.view.zoom_power = Math.min(Math.max(delta * 0.5 + _this.view.zoom_power, 1), 7);
            _this.view.zoom_scale = Math.pow(_this.view.zoom_base, _this.view.zoom_power - 1)
            _this.view.zoom_scale = Math.min(Math.max(_this.view.zoom_scale, 1), 27);
            console.log(zoom_depth())
            drag_graph(_this.view_wrap, true);
            _this.render()
        })
        return _this;
    }

}