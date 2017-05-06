/**
 * Created by Devid on 2017/2/1.
 */


function hierarchical_hexmap(dom_container) {

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
    _this.panel_container = null;
    _this.mini_map_container = null;
    _this.word_cloud_container = null;
    _this.document_list_container = null;
    _this.svg = null;
    _this.view_wrap = null;


    _this.loaded = false;
    _this.render_on_load = true;

    _this.boundary_box = null;

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
    _this.topic_search = false;

    _this.view = {
        selected_hex: null,

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
        y: 0,
        pie_selection: [
            {name: "US", value: true},
            {name: "UK", value: true},
            {name: "EU", value: true},
            {name: "CN", value: true}
        ],
        pie_select_change: function (name, value) {
            for (var i = 0; i < _this.view.pie_selection.length; i++) {
                if (_this.view.pie_selection[i].name == name) {
                    _this.view.pie_selection[i].value = value;
                    break;
                }
            }
            //console.log(_this.view.pie_selection)
        },
        pie_selected: function (t) {
            var result = false;
            for (var i = 0; i < _this.view.pie_selection.length; i++) {
                //console.log(_this.view.pie_selection[i], i)
                if (_this.view.pie_selection[i].name == t) {
                    result = _this.view.pie_selection[i].value;
                    break;
                }
            }
            //console.log(t, "resul = ", result)
            return result;
        }
    };

    _this.colors = {
        background: "rgba(255,255,255,0.95)",
        selected: "rgba(244,244,244,1)",
        border: "rgba(233,233,233, 1)",
        cluster_border: "rgba(88,88,88,1)"
    };

    //helper function
    var zoom_depth = function () {
        var k = Math.log(_this.view.zoom_scale) / Math.log(_this.view.zoom_base);
        return Math.ceil((k + 1) / 2) - 1;
    };

    var padding_shrink = function (node_data) {
        return (_this.config.hexagon_scale -
            (node_data.depth == 0 ? _this.config.cluster_border_width / 2 : 0.5))
            / _this.config.hexagon_scale;

    };


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
    };

    _this.topic_value_maximums = [];
    var recursiveTopicMaxValue = function (node, depth) {
        console.log("node.data.topicClassesDistrib=", node.data.topicClassesDistrib)
        for (var i in node.data.topicClassesDistrib) {
            var d = node.data.topicClassesDistrib[i];
            var sum = 0;
            console.log(i)
            for (var ci = 0; ci < d.length; ci++) {
                console.log("d[ci].classID=", d[ci].classID, d[ci].weightedValueSum, ci)
                sum += d[ci].weightedValueSum * (_this.view.pie_selected(d[ci].classID) ? 1 : 0);
            }
            console.log(sum, depth)
            if (!_this.topic_value_maximums[depth] || sum > _this.topic_value_maximums[depth]) {
                _this.topic_value_maximums[depth] = sum;

            }
        }
        if (node.children)
            for (var i = 0; i < node.children.length; i++) {
                recursiveTopicMaxValue(node.children[i], depth + 1);
            }
    }

    var prepare_data = function () {

        //function to find cluster neighbour and borders for top level
        var boundary_box = {
            min_x: 9999,
            min_y: 9999,
            max_x: -9999,
            max_y: -9999
        };

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
                };

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

            };
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
            //delete data.parent;
        }

        //recursively get maximum value on each level


        if (_this.hexmap_data && _this.topic_data) {

            _this.topic_data.data.hexagons = [];
            if (!_this.topic_data.children) {
                _this.topic_data.children = [];
            }

            var topic_count = 0;
            for (var key in _this.topic_data.data.topics) {
                //console.log(key);
                topic_count++;
            }

            for (var i = 0; i < topic_count; i++) {
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
                };
                //update boundary box value
                var d = _this.topic_data.data.hexagons[i];
                //console.log("hex:", d)
                if (d.absolute_x > boundary_box.max_x) boundary_box.max_x = d.absolute_x;
                if (d.absolute_y > boundary_box.max_y) boundary_box.max_y = d.absolute_y;
                if (d.absolute_x < boundary_box.min_x) boundary_box.min_x = d.absolute_x;
                if (d.absolute_y < boundary_box.min_y) boundary_box.min_y = d.absolute_y;

                if (_this.topic_data.children.length > 0)
                    set_all_position(_this.topic_data.children[i], _this.topic_data.data.hexagons[i]);
            }
            delete _this.topic_data.data.submodels;
            addImmediateNeighboursAndBorders(_this.topic_data.data.hexagons);

            recursiveTopicMaxValue(_this.topic_data, 0);
            _this.boundary_box = boundary_box;
            if (_this.render_on_load) {
                enter_render(_this.topic_data, _this.view_wrap);
                update_render(_this.topic_data, _this.view_wrap);
                enable_minimap();
                enable_pie_selection();
            }
            console.log("Data prepared", _this.topic_data)
        }


    };

    _this.set_backend = function (host) {
        _this.backend_server = host;
        //console.log(_this.backend_server);
        return _this;
    };

    _this.set_data_directory = function (dir) {
        _this.data_dir = dir;
        return _this;
    };

    _this.load_topic_model = function (filename, callback) {
        d3.json(_this.data_dir + filename, function (data) {
            _this.topic_data = d3.hierarchy(data, function (d) {
                return d.submodels;
            });
            console.log("topic data loaded", data);
            prepare_data(); //try prepare data
            if (callback) callback(_this);
        });
        return _this;
    };

    _this.load_hexmap_data = function (filename, callback) {
        d3.json(_this.data_dir + filename, function (data) {
            _this.hexmap_data = data;
            console.log("hexmap data loaded", data)
            prepare_data(); //try prepare data
            if (callback) callback(_this);
        });
        return _this;
    };

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
        _this.config.panel_width = client_rect.width * 0.3;
        _this.config.width = client_rect.width - _this.config.panel_width;
        _this.config.height = client_rect.height;

        //adding panel_container
        _this.config.hexagon_scale = (_this.config.width - 100) / 12;
        _this.config.min_hex_r = _this.config.hexagon_scale;

        var vertical_hex_offset = _this.config.hexagon_scale;
        var horizontal_hex_offset = Math.sqrt(3) / 2 * vertical_hex_offset;
        offsetx = _this.config.width / 2 + horizontal_hex_offset;
        offsety = _this.config.height / 2 + vertical_hex_offset;

        console.log("offsets", offsetx, offsety)

        _this.panel_container = _this.container.append("div")
            .attr("class", "panel-container")
            .style("left", _this.config.width + "px")
            .style("height", _this.config.height + "px")
            .style("width", _this.config.panel_width + "px");

        { //tab

            var refresh = function () {
                _this.tab_wrapper.selectAll("div")
                    .data(_this.tab_defs)
                    .classed("active", function (d) {
                        return d.active;
                    })
            }

            var show_overview = function () {
                console.log("show overview")
                _this.search_word_panel_wrap
                    .style("display", "none")
                _this.default_panel_wrap
                    .style("display", "initial")
                _this.tab_defs[0].active = true;
                _this.tab_defs[1].active = false;
                _this.topic_search = false;
                refresh();
                _this.render();
            }

            var show_search_words = function () {
                console.log("show search words")
                _this.search_word_panel_wrap
                    .style("display", "initial")
                _this.default_panel_wrap
                    .style("display", "none")
                _this.tab_defs[0].active = false;
                _this.tab_defs[1].active = true;
                _this.topic_search = true;
                refresh();
                _this.render();
            }

            _this.tab_defs = [
                {text: "Overview", onclick: show_overview, active: true},
                {text: "Search Words", onclick: show_search_words, active: false}
            ]
            _this.tab_wrapper = _this.panel_container.append("div")
                .attr("class", "panel-tab-wrapper")
            _this.tabs = _this.tab_wrapper.selectAll("div")
                .data(_this.tab_defs)
                .enter()
                .append("div")
                .attr("class", "panel-tab-button")
                .text(function (d) {
                    return d.text;
                })
                .on("click", function (d) {

                    d.onclick();
                });
            refresh()

        }


        _this.panel_wrapper = _this.panel_container
            .append("div")
            .attr("class", "panel-wrapper");

        {   //Main view
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
        }


        {   //default panel
            console.log("Loading Default Panel")
            _this.default_panel_wrap = _this.panel_wrapper.append("div")
                .style("position", "relative")
                .style("height", "100%")
                .style("width", "100%")

            //word cloud

            _this.word_cloud_container = _this.default_panel_wrap.append("div")
                .style("height", "300px")
                .style("width", "100%")
                .append("svg")
                .attr("height", "100%")
                .attr("width", "100%")
                .append("g");


            //document list for topic doc distribution
            _this.document_list_container = _this.default_panel_wrap.append("div")
                .attr("class", "document-list")
                .style("width", _this.config.panel_width + "px")
                .style("height", "calc( 100% - " + _this.config.cloud_height + "px )")
                .style("visibility", "hidden")


            //table
            var list_table = _this.document_list_container.append("table")
                .attr("class", "doc_list")


            var head_row = list_table.append("thead").append("tr")
            head_row.append("th")
                .text("Grant ID")
            head_row.append("th")
                .text("Title")
            head_row.append("th")
                .text("Source")
            head_row.append("th")
                .text("Topic Relevance")

            list_table.append("tbody");

        }

        {   //search panel
            var query_words = function () {
                var query_string = "";
                var count = 0;
                var len = _this.search_word_result.length;
                for (var i = 0; i < len; i++) {
                    if (_this.search_word_result[i].selected) {
                        if (count > 0)
                            query_string += "+";
                        query_string += _this.search_word_result[i].word;
                        count++;
                    }

                }

                d3.json(_this.backend_server + "/topic_word_count/" + query_string, function (data) {
                    //the data is in tree structure, merge it with current data,and display

                    _this.query_result_maximums = [];
                    function recursiveMerge(topic_data_node, search_data, depth) {

                        topic_data_node.data.query_result = search_data.topic_word_sum;

                        for (i in search_data.topic_word_sum) {
                            var value = search_data.topic_word_sum[i];
                            if (!_this.query_result_maximums[depth] || value > _this.query_result_maximums[depth]) {
                                _this.query_result_maximums[depth] = value;
                            }
                        }
                        if (topic_data_node.children)
                            for (var i = 0; i < topic_data_node.children.length; i++) {
                                recursiveMerge(topic_data_node.children[i], search_data.submodels[i], depth + 1);
                            }
                    }

                    recursiveMerge(_this.topic_data, data, 0);
                    _this.render();
                })
            }

            var update_selection = function () {
                var search_result_container = _this.search_word_panel_wrap
                    .select("div.search-result-container");
                search_result_container.selectAll(".result")
                    .data(_this.search_word_result)
                    .each(function (d, i) {
                        d3.select(this).select("input").property('checked', d.selected);
                    })
                query_words();
            }

            var show_search_results = function () {
                var search_result_container = _this.search_word_panel_wrap
                    .select("div.search-result-container");
                //enter
                console.log("search result", search_result_container, _this.search_word_result)
                var enter = search_result_container.selectAll(".result")
                    .data(_this.search_word_result)
                    .enter()

                var item = enter.append("div")
                    .attr("class", "result");

                item.append("input")
                    .attr("type", "checkbox")
                    .attr("id", function (d, i) {
                        return "result_" + i;
                    })
                    .on("click", function (d) {
                        d.selected = !d.selected;
                        query_words();
                    });
                item.append("label")
                    .attr("class", "result-text")
                    .attr("for", function (d, i) {
                        return "result_" + i;
                    })
                    .text(function (d) {
                        return d.word;
                    })


                search_result_container.selectAll(".result")
                    .data(_this.search_word_result)
                    .exit()
                    .remove();

            }

            var search_word = function () {
                var keyword = document.getElementById("searchbox").value;
                d3.json(_this.backend_server + "/search/" + keyword, function (data) {
                    console.log(data);
                    _this.search_word_result = [];
                    var search_result = [];
                    show_search_results();
                    if (data.result) {
                        for (var i = 0; i < data.result.length; i++) {
                            search_result.push({word: data.result[i], selected: false});
                        }
                    }
                    _this.search_word_result = search_result;
                    show_search_results();
                })
            }


            _this.search_word_panel_wrap = _this.panel_wrapper.append("div")
                .classed("search-word-panel-wrapper", true)
                .style("position", "relative")
                .style("height", "100%")
                .style("width", "100%")

            var searchbox_wrapper = _this.search_word_panel_wrap.append("div")
                .classed("searchbox-wrapper", true);

            var search_box = searchbox_wrapper.append("input")
                .attr("type", "text")
                .attr("placeholder", "Any topic word here ...")
                .classed("search-box", true)
                .attr("id", "searchbox");

            searchbox_wrapper.append("button")
                .text("Search")
                .classed("search-button", true)
                .on("click", function () {
                    search_word();
                });


            var search_result_container = _this.search_word_panel_wrap.append("div")
                .classed("search-result-container", true);

            var search_control_wrapper = _this.search_word_panel_wrap.append("div")
                .classed("search-control-container", true);

            var select_all = search_control_wrapper.append("div")
                .attr("class", "select-all")


            select_all.append("input")
                .attr("type", "checkbox")
                .attr("id", "select_all")
                .on("click", function (d) {
                    var selection = d3.select(this).property('checked');
                    for (var i = 0; i < _this.search_word_result.length; i++) {
                        _this.search_word_result[i].selected = selection;
                    }

                    update_selection();
                });
            select_all.append("label")
                .attr("class", "result-text")
                .attr("for", "select_all")
                .text("select all")

        }

        function drag_start() {
            _this.view.dragging = true;
            var pos = d3.mouse(this);
            _this.view.drag_start_pos.x = pos[0];
            _this.view.drag_start_pos.y = pos[1];

            _this.view.drag_d_pos.x = _this.view.x;
            _this.view.drag_d_pos.y = _this.view.y;
        }

        function dragging() {
            if (_this.view.dragging) {
                var pos = d3.mouse(this);
                var dx = pos[0] - _this.view.drag_start_pos.x;
                var dy = pos[1] - _this.view.drag_start_pos.y;
                var scale = _this.view.zoom_scale;
                var nx = _this.view.drag_d_pos.x + dx / scale;
                var ny = _this.view.drag_d_pos.y + dy / scale;
                _this.view.x = Math.min(Math.max(_this.boundary_box.min_x, nx), _this.boundary_box.max_x);
                _this.view.y = Math.min(Math.max(_this.boundary_box.min_y, ny), _this.boundary_box.max_y);

                _this.view.x = Math.max(Math.min(nx, -_this.boundary_box.min_x), -_this.boundary_box.max_x)
                _this.view.y = Math.max(Math.min(ny, -_this.boundary_box.min_y), -_this.boundary_box.max_y)

                drag_graph(_this.view_wrap);
            }
        }

        function drag_finish() {
            if (_this.view.dragging) {
                _this.render();
            }
            //console.log(_this.view.x, _this.view.y)
            _this.view.dragging = false;
        }

        //binding mouse events for dragging effect
        _this.svg
            .on("mousedown", drag_start)
            .on("mouseup", drag_finish)
            .on("mouseleave", drag_finish)
            .on("mousemove", dragging)

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

    var enable_pie_selection = function () {

        function update_checkbox() {
            var update = _this.checkbox_container.selectAll(".pie-checkbox-text")
                .data(_this.view.pie_selection)
                .text(function (d) {
                    return (d.value ? "✔ " : "✖ ") + d.name + " grants"
                })
        }

        _this.checkbox_container = _this.container.append("div")
            .attr("class", "checkbox-container")

        var checkbox_enter = _this.checkbox_container.selectAll("div")
            .data(_this.view.pie_selection)
            .enter()
            .append("div")
            .attr("class", "pie-checkbox")
            .style("border-color", function (d) {
                return colors[d.name]
            })

        var texts_enter = checkbox_enter.append("div")
            .attr("class", "pie-checkbox-text")
            .text(function (d) {
                return (d.value ? "✔ " : "✖ ") + d.name + " grants"
            })
            .on("click", function (d) {
                d.value = !d.value;
                _this.view.pie_select_change(d.name, d.value)
                _this.topic_value_maximums = [];
                recursiveTopicMaxValue(_this.topic_data, 0);
                //console.log(_this.topic_value_maximums)
                _this.render()

                update_checkbox()
            })


    }

    var enable_minimap = function () {
        var dx = (_this.boundary_box.max_x - _this.boundary_box.min_x);
        var dy = (_this.boundary_box.max_y - _this.boundary_box.min_y);
        var hw_scale = dx / dy

        var padding = 20;

        _this.mini_map_container = _this.container.append("div")
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

        _this.mini_map_container.append("canvas")
            .attr("class", "mini-map-canvas")
            .attr("height", _this.view.minimap_height + padding * 2 + "px")
            .attr("width", _this.view.minimap_height * hw_scale + padding * 2 + "px")

        _this.mini_map_container.append("div")
            .attr("class", "mini-map-view")
            .style("height", _this.view.minimap_height + padding * 2 + "px")
            .style("width", _this.view.minimap_height * hw_scale + padding * 2 + "px")

        var scale = (_this.view.minimap_height) / dy;
        _this.view.minimap_scale = scale;

        var m_hex_r = _this.config.hexagon_scale * scale;
        var hexagons = _this.topic_data.data.hexagons;

        var canvas = _this.mini_map_container.select("canvas")._groups[0][0];

        var ox = dx / 2 * scale + padding;
        var oy = dy / 2 * scale + padding

        _this.view.minimap_offsetx = ox;
        _this.view.minimap_offsety = oy;


        //console.log(scale, m_hex_r, canvas)
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
            //console.log(hexagons[i], x, y)
            for (var j = 1; j < 6; j++) {

                var r = (j + .5) / 6 * Math.PI * 2;
                var x = hexagons[i].absolute_x * scale + m_hex_r * Math.cos(r) + ox;
                var y = hexagons[i].absolute_y * scale + m_hex_r * Math.sin(r) + oy;
                ctx.lineTo(x, y);
                // console.log(x, y)
            }
            ctx.closePath();
            ctx.stroke()
            ctx.fill();
        }


    }

    var change_minimap_view = function () {
        var mini_view = _this.mini_map_container.select("div.mini-map-view");
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


    function draw_pie_in_group(group, pie_data, sibling_models, depth) {
        function get_value_range(model) {

            var get_sum = function (d) {
                var res;
                if (d.topicClassesDistrib) {
                    res = 0;
                    for (var i = 0; i < d.topicClassesDistrib.length; i++) {
                        res += d.topicClassesDistrib[i].weightedValueSum * (_this.view.pie_selected(d[i].classID) ? 1 : 0);
                    }

                } else {
                    res = 0;
                    for (var i = 0; i < d.length; i++) {
                        res += d[i].weightedValueSum * (_this.view.pie_selected(d[i].classID) ? 1 : 0);
                    }
                }
                //console.log("res", res)
                return res;
            }
            var arr = []

            for (var key in model) {
                var s = get_sum(model[key]);
                arr.push(s);
                //console.log(key + ", sum=" + s)
            }
            var max = _this.topic_value_maximums[depth];

            var result = {
                min: Math.min.apply(Math, arr),
                max: Math.max(Math.max.apply(Math, arr), max),
            }
            //console.log("value range result =", result)
            return result;
        }

        pie_data = pie_data.sort(function (a, b) {
            return a.classID > b.classID ? -1 : 1
        })

        // require [{name: eu, val: num, proj: num},...]

        var sum = 0;
        for (var p_i = 0; p_i < pie_data.length; p_i++) {
            sum += pie_data[p_i].weightedValueSum * (_this.view.pie_selected(pie_data[p_i].classID) ? 1 : 0);
        }


        var pie = d3.pie()
            .value(function (d) {
                return parseFloat(d.weightedValueSum) * (_this.view.pie_selected(d.classID) ? 1 : 0);
            })
            .sort(null)
            (pie_data)
        var range = get_value_range(sibling_models);

        // var min_radius_percentage = 1 / 5;
        //
        // var radius = _this.config.hexagon_scale * Math.sqrt(3) / 2;
        // //console.log(radius, range)
        // radius = radius * min_radius_percentage + radius * (1 - min_radius_percentage) * ((sum - range.min) / (range.max - range.min));
        var max_radius = _this.config.hexagon_scale * Math.sqrt(3) / 2 - 10;
        var k = ((sum - range.min) / (range.max - range.min));
        console.log("k = " + (sum) + "/" + (range.max - range.min) + "=" + k, range.max, range.min)
        var r = Math.sqrt(k * max_radius * max_radius) + 10;


        var arc = d3.arc()
            .outerRadius(r)
            .innerRadius(0)
        //console.log("r=" + r)
        function arcTween(a) {
            //this._current.outerRadius = r;
            var intro = d3.interpolate(this._current, a);
            this._current = intro(0);
            return function (t) {
                var res = arc(intro(t))
                //console.log("res d=", intro(t))
                return res;
            };
        }

        var pie_g_enter = group.selectAll(".arc")
            .data(pie)
            .enter()
        //console.log(pie)
        pie_g_enter.insert("path", ":first-child")
            .style("opacity", "0.5")
            .attr("class", "arc")
            .attr("d", function (d, i) {
                d.outerRadius = r;
                var t = arc(d, i);
                //console.log("t=", t, d)
                return t;
            })
            .style("fill", function (d, i) {
                return colors[d.data.classID];
            })
            .style("display", function () {
                return _this.topic_search ? "none" : "initial";
            })


        //update pie
        pie_g_update = group.selectAll("path.arc")
            .data(pie)
            .transition()
            .duration(250)
            .attrTween("d", arcTween)
            .style("display", function () {
                return _this.topic_search ? "none" : "initial";
            })
            .style("fill", function (d, i) {
                return colors[d.data.classID];
            })

    }

    function draw_query_distribution(group, idx, sibling_data, depth) {

        function get_value_range(sibling_data) {
            var arr = [];
            for (var i in sibling_data) {
                arr.push(sibling_data[i]);
            }

            var max = _this.query_result_maximums[depth];

            return {
                min: Math.min(Math.min.apply(Math, arr), 0.0001),
                max: Math.max(Math.max.apply(Math, arr), max),
            }
        }

        var r;
        if (!sibling_data) {
            r = 0;
        } else {
            var query_data_item = sibling_data[idx];
            var range = get_value_range(sibling_data);
            var max_radius = _this.config.hexagon_scale * Math.sqrt(3) / 2;
            var k = ((query_data_item - range.min) / (range.max - range.min));
            r = Math.sqrt(k * max_radius * max_radius);

        }
        var d = [{idx: idx, r: r}];
        var dummy_selection = group.selectAll(".query-circle")
            .data(d, function (d) {
                return d.idx;
            });
        dummy_selection.enter()
            .append("circle")
            .attr("class", "query-circle")
            .attr("r", 0)
            .attr("stroke", "none")
            .attr("fill", "rgba(90,0,30,0.2)");

        group.selectAll(".query-circle")
            .transition()
            .attr("r", function (d) {
                return isNaN(d.r) ? 0 : d.r;
            })
            .style("display",
                function () {
                    return !_this.topic_search ? "none" : "initial";
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
        var ws = JSON.parse(JSON.stringify(topic_words));
        //console.log(max, min);
        for (var i = 0; i < ws.length; i++) {
            ws[i].size = (ws[i].weight);
            delete ws[i].weight;
        }
        //console.log(ws)
        var fill = "rgb(100,100,100)"

        function weight(d) {
            return (d.weight);
        }

        function fontsize(d) {
            var k = 14 + 32 * (d.size - min + 1) / (max - min + 1);
            return k;
        }

        _this.word_cloud_container
            .attr("transform",
                "translate(" + [_this.config.panel_width / 2, _this.config.cloud_height / 2] + ")");

        function draw(words) {

            //console.log("draw words", words)
            var selection = _this.word_cloud_container.selectAll("text")
                .data(words, function (d) {
                    return d.text + d.size;
                });

            var enter = selection.enter()
                .append("text")
                .style("fill", fill)
                .attr("text-anchor", "middle")
                .text(function (d) {
                    return d.label
                })
                .attr("transform", function (d) {
                    var k = "translate(" + 0 + "," + 0 + ") " +
                        "rotate(" + d.rotate + ")"
                    //console.log(k);
                    return k;
                })
                .style("opacity", 0)

            enter
                .style("font-size", function (d) {
                    return d.size;
                })
                .transition()
                .style("opacity", 1)
                .attr("transform", function (d) {
                    var k = "translate(" + d.x + "," + d.y + ") " +
                        "rotate(" + d.rotate + ")"
                    //console.log(k);
                    return k;
                })
            selection.transition()
                .style("opacity", 1)
                .attr("transform", function (d) {
                    var k = "translate(" + d.x + "," + d.y + ") " +
                        "rotate(" + d.rotate + ")"
                    //console.log(k);
                    return k;
                })
                .style("font-size", function (d) {
                    return d.size;
                })

            selection.exit()
                .transition()
                .style('opacity', 0)
                .attr('font-size', 1)
                .remove();
        }

        d3.layout.cloud()
            .size([_this.config.panel_width, _this.config.cloud_height])
            .words(ws)
            .rotate(function () {
                return 0
            })
            .padding(5)
            .font("Impact")
            .fontSize(fontsize)
            .text(function (d) {
                return d.label;
            })
            .on("end", draw)
            .start();
    }


    var get_topic_node_position = function (topic_i, node_data) {
        function trace_back(node) {
            var res = [];
            if (node.parent) {
                res = res.concat(res, trace_back(node.parent))
                for (var i = 0; i < node.parent.children.length; i++) {
                    if (node == node.parent.children[i]) {
                        res.push(i);
                        break;
                    }
                }
                return res;
            } else {
                return [];
            }

        }

        var trace = trace_back(node_data);
        trace.push(topic_i);
        return trace;
    }

    var display_file_list = function (node_data, i) {
        var trace = get_topic_node_position(i, node_data);
        var prefix = "disassembled/topicsDocsDistrib";
        var suffix = trace.join("_"); //suffix used as key to trace topic objects
        var path = _this.data_dir + prefix + suffix + ".json";

        _this.document_list_container.append("div")
            .attr("class", "loading")
            .text("loading");

        _this.document_list_container.style("visibility", "visible")

        function new_document_data_callback(doc_num) {


            var distribution = _this.topic_doc_distribution[suffix];
            //console.log("distr", distribution)
            var source_dict = {
                "UK": "GTR",
                "EU-fp7": "FP7",
                "EU-h": "H2020",
                "US": "NSF",
                "CN": "NSFC"
            }

            var display = [];
            for (var i = 0; i < distribution.length; i++) {
                var key = distribution[i].docClass + "-" + distribution[i].docId;
                if (typeof _this.documents[key] !== "undefined" || _this.documents[key]) {
                    if (distribution[i].docClass == "US") {

                    } else if (distribution[i].docClass == "CN") {

                    } else {
                        display.push({
                            grant_id: _this.documents[key].grantId,
                            title: _this.documents[key].title,
                            source: source_dict[distribution[i].docClass],
                            relevance: distribution[i].topicWeight * 100
                        });
                    }
                }

            }

            if (display.length < doc_num) {
                return;
            }
            _this.document_list_container.selectAll("div")
                .remove();

            display = display.sort(function (a, b) {
                return b.relevance - a.relevance
            })
            //console.log(display)
            var tbody = _this.document_list_container.select("tbody");
            tbody.selectAll("tr").remove();
            var selection = tbody.selectAll("tr")
                .data(display, function (d) {
                    return d.source + " " + d.grant_id
                });

            var new_tr = selection.enter().append("tr")
            new_tr.append("td").text(function (d) {
                return d.grant_id;
            });
            new_tr.append("td").text(function (d) {
                return d.title;
            });
            new_tr.append("td").text(function (d) {
                return d.source;
            });
            new_tr.append("td").text(function (d) {
                return Math.floor(d.relevance) + "%";
            });

            selection.exit().remove();


        }


        //function to load topic data if not already loaded
        function get_all_topic_information(suffix, callback) {
            var distribution = _this.topic_doc_distribution[suffix];
            var dir_dict = {
                "UK": "uk/",
                "EU-fp7": "eu-fp7/fp7_",
                "EU-h": "eu-h/h2020_",
                "US": "us/",
                "CN": "cn/"
            }

            for (var i = 0; i < distribution.length; i++) {
                var path = "data/grants/" + dir_dict[distribution[i].docClass] + distribution[i].docId + ".json";
                var key = distribution[i].docClass + "-" + distribution[i].docId;
                //console.log(!_this.documents[key], _this.documents[key], path)
                if (!_this.documents[key]) {

                    function load(doc_key, doc_num) {
                        d3.json(path, function (data) {


                            _this.documents[doc_key] = data;
                            //console.log(_this.documents)
                            callback(doc_num);
                        })
                    }

                    load(key, distribution.length)
                }
            }
            callback();

        }


        //load disassembled topic doc distribution file if not already loaded
        if (!_this.topic_doc_distribution[suffix]) {
            d3.json(path, function (data) {
                //data is a list of {docId, docClass, topicWeight}
                _this.topic_doc_distribution[suffix] = data
                    .sort(function (a, b) {
                        return b.topicWeight - a.topicWeight;
                    })
                    .slice(0, 100)
                    .filter(function (d) {
                        return d.topicWeight > 0.01;
                    });

                get_all_topic_information(suffix, new_document_data_callback)
            })
        } else {
            get_all_topic_information(suffix, new_document_data_callback)
        }


        //console.log("documents", _this.documents)
    }

    var switch_pie_display = function (container, node_data, d, i) {
        container.selectAll(".arc").style("display",
            function () {
                return _this.topic_search ? "none" : "initial";
            })
        container.selectAll(".query-circle").style("display",
            function () {
                return !_this.topic_search ? "none" : "initial";
            })

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
            draw_query_distribution(data_group, i, node_data.data.query_result, node_data.depth);
            //console.log("draw pi i=", i)
            draw_pie_in_group(data_group, node_data.data.topicClassesDistrib[i], node_data.data.topicClassesDistrib, node_data.depth);

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
                    show_cloud(node_data.data.topics[i]);
                    _this.view.selected_hex = {
                        data: node_data,
                        hex: d
                    }

                    zoom_to_depth(node_data.depth, d.absolute_x, d.absolute_y);
                })
                .on("click", function () {
                    show_cloud(node_data.data.topics[i]);
                    //console.log(node_data.data)
                    _this.view.selected_hex = {
                        data: node_data,
                        hex: d
                    }

                    console.log(node_data.data.topicClassesDistrib[i], i)
                    display_file_list(node_data, i);
                    _this.render();
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

        //update
        selection.selectAll("g")
            .each(function (d, i) {
                switch_pie_display(d3.select(this), node_data, d, d.pos)

            })

        selection.selectAll("g.data")
            .each(function (d, i) {
                draw_pie_in_group(
                    d3.select(this),
                    node_data.data.topicClassesDistrib[d.pos],
                    node_data.data.topicClassesDistrib,
                    node_data.depth)
            })


        //update search query pies
        selection.selectAll("g.data")
            .each(function (d, i) {
                draw_query_distribution(d3.select(this), d.pos, node_data.data.query_result, node_data.depth);
            })

        // //update on click select
        selection.select("polygon")
            .transition()
            .each(function (d) {
                if (_this.view.selected_hex && d == _this.view.selected_hex.hex) {
                    d3.select(this)
                        .style("fill", _this.colors.selected)
                        .style("stroke-width", 2)
                        .style("stroke", "rgba(100,100,100,0.7")
                } else {
                    d3.select(this)
                        .style("fill", _this.colors.background)
                        .style("stroke-width", 1)
                        .style("stroke", _this.colors.border)
                }
            })

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
            //console.log(zoom_depth())
            drag_graph(_this.view_wrap, true);
            _this.render()
        })
        return _this;
    }

}