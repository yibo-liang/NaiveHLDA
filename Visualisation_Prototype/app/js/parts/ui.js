/**
 * Created by Devid on 06/05/2017.
 */



//
function moushwheel_event_handler(e, callback) {
    // cross-browser wheel delta
    var e = window.event || e; // old IE support
    var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));

    callback(delta);

}

function bind_mousewheel(dom_id, MouseWheelHandler) {
    var dom = document.getElementById(dom_id);

    if (!dom.MouseWheelHandler) {

        dom.MouseWheelHandler = function (e) {
            moushwheel_event_handler(e, MouseWheelHandler);
        }

        if (dom.addEventListener) {
            // IE9, Chrome, Safari, Opera
            dom.addEventListener("mousewheel", dom.MouseWheelHandler, false);
            // Firefox
            dom.addEventListener("DOMMouseScroll", dom.MouseWheelHandler, false);
        }
// IE 6/7/8
        else dom.attachEvent("onmousewheel", dom.MouseWheelHandler);
    } else {
        dom.MouseWheelHandler = function (e) {
            moushwheel_event_handler(e, MouseWheelHandler);
        }
    }

}


function add_ui(_this) {

    _this.panel_container = null;
    _this.mini_map_container = null;
    _this.word_cloud_container = null;
    _this.document_list_container = null;


    _this.svg = null;
    _this.view_wrap = null;

    _this.render_on_load = true;


    _this.country_colours = {EU: "#5B5EA6", UK: "#D65076", US: "#118499", CN: "#FF7735"};

    _this.colors = {
        background: "rgba(255,255,255,0.95)",
        selected: "rgba(244,244,244,1)",
        border: "rgba(233,233,233, 1)",
        cluster_border: "rgba(88,88,88,1)"
    };

    _this.view = {
        selected_hex: null,

        offsetx: 0,
        offsety: 0,

        minimap_height: 140,
        minimap_scale: null,
        minimap_offsetx: null,
        minimap_offsety: null,

        zoom_scale: 1,
        zoom_power: 1,
        zoom_base: Math.sqrt(3),
        zoom_ease: d3.easeLinear,
        drag_enabled: true,
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

        cloud_id: null,
        pie_selection: [
            {name: "US", value: true},
            {name: "UK", value: true},
            {name: "EU", value: true},
            {name: "CN", value: true}
        ],
        pie_selection_key: "1111",
        pie_select_change: function (name, value) {
            for (var i = 0; i < _this.view.pie_selection.length; i++) {
                if (_this.view.pie_selection[i].name == name) {
                    _this.view.pie_selection[i].value = value;
                    break;
                }
            }

            var get_key = function () {
                var key = ""
                for (var i = 0; i < _this.view.pie_selection.length; i++) {
                    var e = ( _this.view.pie_selection[i].value ? 1 : 0);
                    key += e;
                }
                return key;
            }
            _this.view.pie_selection_key = get_key();
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


    var init_ui = function () {
        var client_rect = _this.container._groups[0][0].getBoundingClientRect();
        _this.config.panel_width = client_rect.width * 0.3;
        _this.config.width = client_rect.width - _this.config.panel_width;
        _this.config.height = client_rect.height;

        //adding panel_container
        _this.config.hexagon_scale = (_this.config.width - 100) / 9;
        _this.config.min_hex_r = _this.config.hexagon_scale;

        var vertical_hex_offset = _this.config.hexagon_scale;
        var horizontal_hex_offset = Math.sqrt(3) / 2 * vertical_hex_offset;
        _this.view.offsetx = _this.config.width / 2 - horizontal_hex_offset / 2;
        _this.view.offsety = _this.config.height / 2 - vertical_hex_offset / 2;

        console.log("offsets", _this.view.offsetx, _this.view.offsety)

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
                //console.log("show search words")
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
                //disable search for experiment
                //{text: "Search Words", onclick: show_search_words, active: false}
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

        {
            //Main view
            //adding svg
            _this.hexmap_container = _this.container.append("div")
                .style("height", _this.config.height + "px")
                .style("width", _this.config.width + "px")
                .attr("class", "hexmap-container")
                .attr("id", "hexmap_container")

            _this.svg = _this.hexmap_container
                .append("svg")
                .attr("height", _this.config.height + "px")
                .attr("width", _this.config.width + "px")
                .attr("class", "hexmap")
                .attr("id", "hex_svg")

            document.getElementById('hex_svg').draggable = false;

            //a group wrap for dragging and zooming
            _this.view_wrap = _this.svg.append("g")
                .attr("class", "view_wrap")
                .style("transform", "translate("
                    + (_this.view.x * _this.view.zoom_scale + _this.view.offsetx) + "px,"
                    + (_this.view.y * _this.view.zoom_scale + _this.view.offsety) + "px)"
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
                //.append("g");


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

            //console.log(_this.view.dragging, pos[0]+","+pos[1]);
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

                //console.log(_this.view.dragging, pos[0]+","+pos[1]);

                _this.drag_graph(_this.view_wrap);
                _this.render();

            }
        }

        function drag_finish() {
            if (_this.view.dragging) {
                _this.render();
            }

            //console.log(_this.view.x, _this.view.y)
            _this.view.dragging = false;
            //console.log(_this.view.dragging);
        }

        //binding mouse events for dragging effect
        if (_this.view.drag_enabled) {
            _this.svg
                .on("mousedown", drag_start)
                .on("mouseup", drag_finish)
                .on("mouseleave", drag_finish)
                .on("mousemove", dragging)
        }

    }

    _this.init_list.push(init_ui)

    var enable_minimap = function () {

        if (_this.topic_data.length) return;

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
                _this.drag_graph(_this.view_wrap, true);
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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

        if (_this.topic_data.length) return;

        var mini_view = _this.mini_map_container.select("div.mini-map-view");
        var scale = 1 / _this.view.zoom_scale;
        mini_view
            .transition()
            .ease(_this.view.zoom_ease)
            .style("transform", "scale(" + scale + "," + scale + ") "
                + "translate(" + (-_this.view.x * _this.view.minimap_scale / scale) + "px,"
                + (-_this.view.y * _this.view.minimap_scale / scale) + "px)")
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
                return _this.country_colours[d.name]
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
                _this.linearTopicMaxValue(_this.topic_data, 0);
                //console.log(_this.topic_value_maximums)
                _this.render()

                update_checkbox()
            })


    }

    _this.drag_graph = function (super_group, transition) {
        if (transition) {
            super_group
                .transition()
                .duration(_this.config.transition_duration)
                .ease(_this.view.zoom_ease)
                .style("transform", "translate("
                    + (_this.view.x * _this.view.zoom_scale + _this.view.offsetx) + "px,"
                    + (_this.view.y * _this.view.zoom_scale + _this.view.offsety) + "px)"
                    + " scale(" + _this.view.zoom_scale + "," + _this.view.zoom_scale + ")");
        } else {
            super_group
                .style("transform", "translate("
                    + (_this.view.x * _this.view.zoom_scale + _this.view.offsetx) + "px,"
                    + (_this.view.y * _this.view.zoom_scale + _this.view.offsety) + "px)"
                    + " scale(" + _this.view.zoom_scale + "," + _this.view.zoom_scale + ")");

        }
        change_minimap_view();
    }

	function drawWordCloud(odata, svg, limit, visible) {
		var parent = svg.node().parentNode;
		

		var width = parent.getBoundingClientRect().width;
		var height = parent.getBoundingClientRect().height;
		if (typeof limit != "undefined") {
			var data = odata.splice(0, limit);
		}
		for (var i = 0; i < data.length; i++) {
			data[i]["value"] = (data[i]["weight"]);
		}
		if (typeof visible == "undefined") {
			visible = window.visible_words;
		}
		console.log("data",data)
		//console.log(JSON.stringify(data))
		var xScale = d3.scaleLinear()
			.domain([0, d3.max(data,
				function (d) {
					return (d.value);
				}
			)
			])
			.range([5, 60]);

		d3.layout.cloud().size([width, height])
			.timeInterval(20)
			.words(data)
			.fontSize(function (d) {
				//console.log(xScale(+d.value),d.value)
				return xScale(+d.value);
			})
			.padding(3)
			.text(function (d) {
				return d.label;
			})
			.rotate(function () {
				return 0;//~~(Math.random() * 2) * 90;
			})
			.font("Arial")
			.random(function (d) {
				return 1;
			})
			.on("end", draw)
			.start();

		function draw(data) {
			console.log("draw",data)
			svg.selectAll("g").remove();
			svg.data = data;
			svg
				.attr("width", width)
				.attr("height", height)
				.append("g")
				//.attr("transform", "translate(" + [width >> 1, height >> 1] + ")")
				.selectAll("text")
				.data(data)
				.enter().append("text")
				.style("font-size", function (d) {
					//console.log(d.value,xScale(d.value) )
					return xScale(d.value) + "px";
				})
				.style("font-family", "Impact")
				.style("fill", function (d, i) {
					return "black";
				})
				.style("opacity", function (d, i) {
					return i < visible ? "1" : "0";
				})
				.attr("text-anchor", "middle")
				.attr("transform", function (d) {
					return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
				})
				.text(function (d) {
					//console.log(d.word)
					return d.label;
				});
			svg.selectAll("g")
				.each(function (d) {
					var bound = d3.select(this)
						.node()
						.getBoundingClientRect();
					var bound_p = d3.select(this)
						.node()
						.parentNode
						.getBoundingClientRect()
					console.log(bound, bound_p)
					var xscale = width / bound.width;
					var yscale = height / bound.height;
					var _scale = Math.min(xscale, yscale);
					var new_w = bound.width * _scale;
					var new_h = bound.height * _scale;


					var bx = bound.x - bound_p.x;
					var by = bound.y - bound_p.y;
					console.log(bx, by);
					//var dx =  width / 2 /_scale;
					//var dy =  height / 2/_scale;
					var dx = -bx + (width - new_w) / 2;
					var dy = -by + (height - new_h) / 2;

					console.log(_scale, dx, dy, "|", height, new_h, width, new_w);
					d3.select(this)
						.style("transform",
							"scale(" + _scale + "," + _scale + ") " +
							"translate(" + dx + "px," + dy + "px)");
				})
		}

		d3.layout.cloud().stop();
	}
	
    _this.show_cloud = function (topic_words, id) {
        if (!_this.view.cloud_id || id !== _this.view.cloud_id) {
            _this.view.cloud_id = id;
        } else {
            return;
        }
        var max = d3.max(topic_words, weight);
        var min = d3.min(topic_words, weight);
        var ws = JSON.parse(JSON.stringify(topic_words));
        //console.log(max, min);
        for (var i = 0; i < ws.length; i++) {
            ws[i].size = (ws[i].weight);
            //ws[i].weight;
        }
        //console.log(ws)
        var fill = "rgb(100,100,100)"

        function weight(d) {
            return (d.weight);
        }

        function fontsize(d) {
            var k = 4+ 32 * (d.size - min + 1) / (max - min + 1);
			console.log(d,k);
            return k;
        }
		drawWordCloud(ws, _this.word_cloud_container, 25, 25);
        //_this.word_cloud_container
        //    .attr("transform",
        //       "translate(" + [_this.config.panel_width / 2, _this.config.cloud_height / 2] + ")");
		
		
				/*
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
                    return fontsize(d)+"px";
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
            .font("Arial")
            .fontSize(fontsize)
            .text(function (d) {
                return d.label;
            })
            .on("end", draw)
            .start();
			
			*/
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

    _this.display_file_list = function (node_data, i) {
        var trace = get_topic_node_position(i, node_data);
        var prefix = "disassembled/topicsDocsDistrib";
        var suffix = trace.join("_"); //suffix used as key to trace topic objects
        //console.log(node_data.level ,i);
        //console.log(!!_this.data_dir.length)
        var path = typeof _this.data_dir == "object"
            ? _this.data_dir[node_data.level] + prefix + suffix + ".json"
            : _this.data_dir + prefix + suffix + ".json";

        _this.document_list_container.append("div")
            .attr("class", "loading")
            .text("loading");

        _this.document_list_container.style("visibility", "visible")

        function new_document_data_callback(doc_num) {


            var distribution = _this.topic_doc_distribution[suffix];
            //console.log("callback ")
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
                if (typeof _this.documents[key] !== "undefined" && _this.documents[key] !== null) {
                    if (distribution[i].docClass == "US") {
                        //console.log(key,_this.documents[key])
                        display.push(
                            {
                                grant_id: _this.documents[key].id,
                                title: _this.documents[key].title,
                                source: source_dict[distribution[i].docClass],
                                relevance: distribution[i].topicWeight * 100
                            }
                        )
                    } else if (distribution[i].docClass == "CN") {
                        //console.log(key)
                        display.push(
                            {
                                grant_id: _this.documents[key].id,
                                title: _this.documents[key].title,
                                source: source_dict[distribution[i].docClass],
                                relevance: distribution[i].topicWeight * 100
                            }
                        )
                    } else {
                        display.push({
                            grant_id: _this.documents[key].grantId,
                            title: _this.documents[key].title,
                            source: source_dict[distribution[i].docClass],
                            relevance: distribution[i].topicWeight * 100
                        });
                    }
                } else {
                    //console.log(key)
                }

            }

            if (display.length < doc_num - 1) {
                return;
            }
            //console.log(display)
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
            //console.log("distribution",distribution)
            for (var i = 0; i < distribution.length; i++) {
                var path = "data/grants/" + dir_dict[distribution[i].docClass] + distribution[i].docId + ".json";

                var key = distribution[i].docClass + "-"
                    + distribution[i].docId;
                //console.log(key, path)
                if (!_this.documents[key]) {

                    function load(doc_key, doc_num) {
                        d3.json(path, function (data) {

                            //console.log(data)
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
            //console.log(path)
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
                //console.log(_this.topic_doc_distribution[suffix], suffix)
                get_all_topic_information(suffix, new_document_data_callback)
            })
        } else {
            get_all_topic_information(suffix, new_document_data_callback)
        }


        //console.log("documents", _this.documents)
    }


    _this.postload_list.push(enable_minimap);
    _this.postload_list.push(enable_pie_selection);
}