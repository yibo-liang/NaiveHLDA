/**
 * Created by Devid on 06/05/2017.
 */



function add_single_hexagon_render(_this) {

    _this.get_hexagon_padding_scale = function (node_data) {
        return (_this.config.hexagon_scale -
            (node_data.depth == 0 ? _this.config.cluster_border_width / 2 : 0.5))
            / _this.config.hexagon_scale;

    };

    var clickcancel = function () {
        //cancel click event if double click, or if dragged
        var event = d3.dispatch('click', 'dblclick');

        function cc(selection) {
            var down,
                tolerance = 5,
                last,
                wait = null;
            // euclidean distance
            function dist(a, b) {
                if (!a || !b) return 99999;//if a or b is deleted by the time this function is called, return an large number to avoid bug
                return Math.sqrt(Math.pow(a[0] - b[0], 2), Math.pow(a[1] - b[1], 2));
            }

            selection.on('mousedown', function () {
                down = d3.mouse(document.body);
                last = +new Date();
            });
            selection.on('mouseup', function () {
                if (dist(down, d3.mouse(document.body)) > tolerance) {
                    return;
                } else {
                    if (wait) {
                        window.clearTimeout(wait);
                        wait = null;
                        //console.log(event)
                        event._.dblclick[0].value(d3.event);
                    } else {
                        wait = window.setTimeout((function (e) {
                            return function () {
                                if (event._.click)
                                    event._.click[0].value(d3.event);
                                wait = null;
                            };
                        })(d3.event), 300);
                    }
                }
            });
        };
        return d3.rebind(cc, event, 'on');
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

    var draw_boarders = function (container, node_data, borders) {
        //console.log("borders", borders)
        var shrink = _this.get_hexagon_padding_scale(node_data);
        container.selectAll("path")
            .data(borders)
            .enter()
            .append("path")
            .attr("class", "boarder")
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
            .style("opacity", function () {
                return _this.get_zooming_opacity(node_data)
            })

    }

    _this.update_boarder = function (container, node_data, borders) {
        if (node_data.depth == 0)
            container.selectAll("path.boarder")
                .data(borders)
                .transition()
                .style("opacity", function () {
                    return 1
                })
    }

    _this.draw_pie_in_group = function (group, pie_data, sibling_models, depth) {
        function get_value_range(model) {

            if (model.value_range && model.value_range[_this.view.pie_selection_key]) {
                //console.log(model.value_range[_this.view.pie_selection_key])
                return model.value_range[_this.view.pie_selection_key];
            }

            var get_sum = function (d) {
                var res;
                if (d.topicClassesDistrib) {
                    res = 0;
                    for (var i = 0; i < d.topicClassesDistrib.length; i++) {
                        var e = (_this.view.pie_selected(d[i].classID) ? 1 : 0);
                        res += d.topicClassesDistrib[i].weightedValueSum * e;
                    }

                } else {
                    res = 0;
                    for (var i = 0; i < d.length; i++) {
                        var e = (_this.view.pie_selected(d[i].classID) ? 1 : 0);
                        res += d[i].weightedValueSum * e;
                    }
                }
                //console.log("res", res)
                return {result: res, key: key};
            }
            var arr = []

            for (var key in model) {
                var res = get_sum(model[key]).result
                arr.push(res);
                //console.log(key + ", sum=" + s)
            }
            var max = _this.topic_value_maximums[depth];

            var result = {
                min: Math.min.apply(Math, arr),
                max: Math.max(Math.max.apply(Math, arr), max),
            }
            if (!model.value_range)
                model.value_range = {}
            model.value_range[_this.view.pie_selection_key] = result;
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
                var val = parseFloat(d.weightedValueSum) * (_this.view.pie_selected(d.classID) ? 1 : 0);
                //console.log("pie val=" + val)
                return val;
            })
            .sort(null)
            (pie_data)

        var range = get_value_range(sibling_models);

        // var min_radius_percentage = 1 / 5;
        //
        // var radius = _this.config.hexagon_scale * Math.sqrt(3) / 2;
        // radius = radius * min_radius_percentage + radius * (1 - min_radius_percentage) * ((sum - range.min) / (range.max - range.min));
        var max_radius = _this.config.hexagon_scale * Math.sqrt(3) / 2 - 10;
        var k = ((sum - range.min) / (range.max - range.min + 0.001));
        //console.log("k = " + (sum) + "/" + (range.max - range.min) + "=" + k, range.max, range.min)
        var new_r = Math.sqrt(k * max_radius * max_radius) + 10;
        //console.log("new_r=", new_r);
        if (isNaN(new_r)) new_r = 0;

        pie.forEach(function (d, i) {
            d.outerRadius = new_r;
            //console.log(d)
        })

        var arc = d3.arc()
            .outerRadius(new_r)
            .innerRadius(0)
        //console.log("r=" + r)
        function arcTween(d, i) {


            var intro = d3.interpolate(this._current, d);
            this._current = intro(0);
            var intro_r = d3.interpolate(this._current.outerRadius, d.outerRadius);

            return function (t) {
                var data = intro(t);
                var r = intro_r(t);

                var arc = d3.arc()
                    .outerRadius(r)
                    .innerRadius(0)

                var res = arc(data);
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
                var r = Math.sqrt(k * max_radius * max_radius) + 10;
                d.outerRadius = r;
                //console.log(d);
                var t = arc(d, i);
                //console.log("t=", t, d)
                return t;
            })
            .style("fill", function (d, i) {
                return _this.country_colours[d.data.classID];
            })
            .style("display", function () {
                return _this.topic_search ? "none" : "initial";
            })


        //update pie
        var pie_g_update = group.selectAll("path.arc")
            .data(pie)
            .transition()
            .duration(250)
            .attrTween("d", arcTween)
            .style("display", function () {
                return _this.topic_search ? "none" : "initial";
            })
            .style("fill", function (d, i) {
                return _this.country_colours[d.data.classID];
            })

    }

    _this.draw_query_distribution = function (group, idx, sibling_data, depth) {

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

    _this.draw_topic = function (container, node_data, d, i, visible, highlight, click_callbacks) {


        if (d.visible || visible) {

            //draw polygon
            container.append("polygon")
                .attr("points", hexagon_points(0, 0, 1 * _this.config.hexagon_scale))
                .style("fill", _this.colors.background)
                .style("stroke", _this.colors.border)
                .style("stroke-width", 1)

            //draw borders for toplevel
            if (node_data.depth == 0 || node_data.level) {
                if (!highlight)
                    draw_boarders(container, node_data, d.borders);
            }

            //draw pie

            var data_group = container.append("g")
                .attr("class", "data")
                .style("opacity", 0)

            if (_this.topic_search && !visible)
                _this.draw_query_distribution(data_group, i, node_data.data.query_result, node_data.depth);
            //console.log("draw pi i=", i)
            if (!_this.topic_search && !visible || highlight)
                _this.draw_pie_in_group(data_group, node_data.data.topicClassesDistrib[i], node_data.data.topicClassesDistrib, node_data.depth);

            //get rid of dominating words,
            //a word is dominating if it occurs more than 3 times in sibliing topics

            //draw texts
            function sort_topicwords(a, b) {
                return b.weight - a.weight;
            }

            function sibling_occurence(word, node_data) {
                //console.log(word,node_data.data.topics)
                var occur = 0;
                for (var ti in node_data.data.topics) {
                    var t_texts = node_data.data.topics[ti];
                    var sorted = t_texts.sort(sort_topicwords);
                    //console.log(sorted)
                    for (var wi = 0; wi < 3; wi++) {
                        //

                        if (sorted[wi].label == word) {
                            //console.log(sorted[wi].label, word);
                            occur++;
                            break;
                        }
                    }
                }
                //console.log(node_data.data.topics, occur)
                return occur;
            }

            if (!node_data.data.topics[i].sorted) {
                var texts = node_data.data.topics[i].sort(sort_topicwords).slice(0, 3);
                node_data.data.topics[i].sorted = true;
            } else {
                var texts = node_data.data.topics[i].slice(0, 3);
            }
            var visible_texts = texts
            // .sort(sort_topicwords)
            // .slice(0, 8)
            // .filter(function (tw) {
            //     return sibling_occurence(tw.label, node_data) < 3;
            // })
            // .slice(0, 3)


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
                    var font_size = 44;
                    var order = [0, 1, -1]
                    return "translate(" + 0 + "," + (order[i]) * font_size + "px)"
                })
                .style("font-size", function (d, i) {
                    return i == 0 ? "36" : "28";
                })
                .style("font-weight", function (d, i) {
                    return i == 0 ? "600" : "200";
                })
                .style("text-anchor", "middle")

            data_group
                .transition()
                .duration(_this.config.transition_duration)
                .style("opacity", function () {
                    if (visible) return 1;
                    return _this.get_zooming_opacity(node_data)
                })

            var cc = clickcancel();

            var default_dbclick = function (d, node_data, i) {
                //console.log("click dpth = " , node_data);
                _this.show_cloud(node_data.data.topics[i]);
                _this.view.selected_hex = {
                    data: node_data,
                    hex: d
                }

                _this.zoom_to_depth(node_data, d.absolute_x, d.absolute_y);
            }

            var default_click = function (d, node_data, i) {
                _this.show_cloud(node_data.data.topics[i]);
                //console.log(node_data, _this.get_zooming_opacity(node_data))
                _this.view.selected_hex = {
                    data: node_data,
                    hex: d
                }

                //console.log(node_data.data.topicClassesDistrib[i], i)
                _this.display_file_list(node_data, i);
                _this.render();
            }


            if (click_callbacks) {
                default_click = click_callbacks.click;
                default_dbclick = click_callbacks.dbclick;
            }

            container.call(cc);
            cc
                .on("dblclick", function () {
                    default_dbclick(d, node_data, i);
                })
                .on("click", function () {
                    default_click(d, node_data, i);
                })
        }

    }

}