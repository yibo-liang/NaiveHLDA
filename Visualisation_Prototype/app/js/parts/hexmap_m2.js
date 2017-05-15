/**
 * Created by Devid on 2017/5/10.
 */
/**
 * Created by Devid on 06/05/2017.
 */

function add_hexmap_model_2(_this) {

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


    var filter_invisible_hexagons = function (hexagons, depth) {

        var lvl_scale = Math.pow(1 / 3, depth);

        var scale = _this.view.zoom_scale;
        // var m = Math.pow(3, depth+1)
        // scale = Math.floor(scale);
        // scale = scale - scale % m;
        var display_r = Math.pow(1 / 3, depth) * _this.config.hexagon_scale * _this.view.zoom_scale;
        //console.log(display_r)
        var buffer_range = -display_r * 1// -_this.config.min_hex_r * 1 ;

        //var padding = -_this.config.min_hex_r * 1;
        var res = [];

        for (var i = 0; i < hexagons.length; i++) {
            var coor = {
                x: (hexagons[i].absolute_x + _this.view.x / lvl_scale) * scale * lvl_scale + _this.view.offsetx,
                y: (hexagons[i].absolute_y + _this.view.y / lvl_scale) * scale * lvl_scale + _this.view.offsety
            }

            if (_this.get_zoom_depth() !== depth) { // too small to see
                hexagons[i].visible = false;
                res.push(hexagons[i])
            } else if (coor.x > buffer_range
                && coor.x < _this.config.width - buffer_range //visible within svg
                && coor.y > buffer_range
                && coor.y < _this.config.height - buffer_range) {
                hexagons[i].visible = true;
                res.push(hexagons[i])
            } else { //out of the visible svg
                hexagons[i].visible = false;
                res.push(hexagons[i])
            }
        }
        return res;
    }


    var get_overview_display = function () {
        if (_this.get_zoom_depth() == 0) return false;
        return _this.overview.display;
    }

    var add_overview_map = function () {
        console.log("add overview")
        _this.overview = {};
        _this.overview.subtopic_level = -1;
        _this.overview.padding = {top: 200, left: 150, bottom: 150, right: 150};
        _this.overview.display = true;
        var container = _this.hexmap_container;
        _this.overview.container = container
            .append("div")
            .attr("class", "overview-container")

        _this.overview.map = _this.overview.container
            .append("canvas")
            .attr("class", "overview")
            .attr("height", _this.config.height + "px")
            .attr("width", _this.config.width + "px")


        console.log("add overview done")
    }


    var render_supertopic_overview = function (level) {

        if (!_this.overview.supertopic_container) {
            _this.overview.supertopic_container =
                _this.overview.container.append("div").attr("class", "overview-supertopic-container")
                    .append("svg")
                    .attr("class", "overview-supertopic-svg")
                    .attr("width", _this.config.width + "px")
                    .attr("height", _this.config.height + "px");


        }
        var shrink_scale = 0.75;
        var select = _this.view.selected_hex;

        var data;


        // Title on left corner
        {
            if (select) {
                data = [select];
            } else {
                data = [];
            }

            var enter = _this.overview.supertopic_container
                .selectAll("g.super-topic-container")
                .data(data)
                .enter()

            var padding = _this.config.hexagon_scale * shrink_scale;

            var container = enter.append("g")
                .attr("class", "super-topic-container")
                .style("transform", "translate(" + padding + "px," + padding + "px)"
                    + " scale(" + shrink_scale + "," + shrink_scale + ")")

            container.each(function (d) {
                _this.draw_topic(container, d.data, d.hex, d.hex.pos, true);

            })

            var update = _this.overview.container
                .selectAll("div.super-topic-container")
                .data(data);

            update.exit()
                .remove();
        }

        // sub topic hightlight
        if (select) {

            function is_colliding(hex_a, hex_b) {


                var lvl_scale = Math.pow(1 / 3, level+1);


                var min_dist = _this.config.hexagon_scale * 2;

                function distance(x1, y1, x2, y2) {
                    var dx = x1 - x2;
                    var dy = y1 - y2;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    return dist;
                }

                var dist = distance(hex_a.x, hex_a.y, hex_b.x, hex_b.y);
                console.log(dist)
                if ( dist <= min_dist * 1.01) {
                    console.log("close hex",hex_a.x, hex_a.y, hex_b.x, hex_b.y, dist)
                    return true;
                }
                return false;
            }

            function is_cluster_colliding(cluster_a, cluster_b) {

                for (var a = 0; a < cluster_a.length; a++) {
                    for (var b = 0; b < cluster_b.length; b++) {
                        var hex_a = cluster_a[a];
                        var hex_b = cluster_b[b];
                        if (is_colliding(hex_a, hex_b)) {
                            return true;
                        }
                    }
                }
                return false;
            }

            function clustering_subtopics(subtopic_hexs) {
                var result_groups = []; // a list of list
                //console.log(subtopic_hexs)
                //prepare clusters, make every single hex a individual cluster
                for (var i = 0; i < subtopic_hexs.length; i++) {
                    var hex = subtopic_hexs[i];
                    result_groups.push([hex]);
                }
                //console.log(result_groups)
                //merge any two cluster if they collide (if the member collide) until no merge
                var merged = true;
                while (merged) {
                    merged = false;


                    for (var i = 0; i < result_groups.length - 1; i++) {
                        for (var j = i + 1; j < result_groups.length; j++) {
                            if (i!==j && is_cluster_colliding(result_groups[i], result_groups[j])) {
                                merged = true;
                                result_groups[i]=result_groups[i].concat(result_groups[j]);
                                result_groups.splice(j, 1);
                                //console.log("merge ", i, " and ", j)
                                break;
                            }
                        }
                        if (merged) break;
                    }
                    //console.log(result_groups)
                }
                return result_groups;

            }


            var num_topics = 10;

            if (!_this.overview.subtopics || _this.overview.level !== level) {
                //render once for level
                console.log("render sub topic overview hightlight")

                var subtopic_similarity = _this.compare_data[level][parseInt(select.hex.topic_id)];
                var subtopics = subtopic_similarity.map(function (d, i) {
                    return {id: i, value: d};
                })

                _this.overview.subtopics = subtopics.sort(function (a, b) {
                    return b.value - a.value;
                }).slice(0, num_topics);
                _this.overview.level = level;

                var ox = padding.left + (_this.config.width - padding.right - padding.left) / 2;
                var oy = padding.top + (_this.config.height - padding.bottom - padding.top) / 2;
                var hexagons = _this.topic_data[level + 1].data.hexagons;

                console.log(hexagons)
                var sub_topic_hexagons = [];
                // for (var i = 0; i < hexagons.length; i++) {
                //     var id = parseInt(hexagons[i].topic_id);
                //     console.log(id)
                //     for(var j=0;j<_this.overview.subtopics.length;j++){
                //         if (id === _this.overview.subtopics[j].id){
                //             sub_topic_hexagons.push(hexagons[i]);
                //             break;
                //         }
                //     }
                //
                // }

                for (var i = 0; i < _this.overview.subtopics.length; i++) {
                    var id = _this.overview.subtopics[i].id;
                    console.log(id, hexagons[id]);
                    sub_topic_hexagons.push(hexagons[id]);
                }


                console.log(sub_topic_hexagons)
                var clusters = clustering_subtopics(sub_topic_hexagons);
                console.log(clusters)


            }


        }


    }

    var render_overview = function (level) {

        _this.calculate_boundary_box();

        _this.overview.container
            .style("visibility", function () {
                return get_overview_display() ? "visible" : "hidden";
            })
            .transition()
            .duration(500)
            .style("opacity", function () {
                return get_overview_display() ? 1 : 0;
            })
        //console.log(level, _this.get_zoom_depth())
        if (level == 0 || level !== _this.get_zoom_depth()) return;


        render_supertopic_overview(level - 1);

        var dx = (_this.boundary_box.max_x - _this.boundary_box.min_x);
        var dy = (_this.boundary_box.max_y - _this.boundary_box.min_y);
        //console.log(dx, dy, "dxdy")
        var padding = _this.overview.padding;

        //var data = _this.hexmap_data[level];
        var hexagons = _this.topic_data[level].data.hexagons;
        // console.log(data, hexagons)

        var scale = Math.min(
            (_this.config.height - padding.top - padding.bottom) / dy,
            (_this.config.width - padding.left - padding.right) / dx
        );

        var lvl_scale = Math.pow(1 / 3, level);
        var canvas = _this.overview.map._groups[0][0];
        //console.log("Scales = ", scale, lvl_scale, _this.config.hexagon_scale)
        var m_hex_r = _this.config.hexagon_scale * scale * lvl_scale;
        //console.log("m_hr", m_hex_r)
        var ox = padding.left + (_this.config.width - padding.right - padding.left) / 2;
        var oy = padding.top + (_this.config.height - padding.bottom - padding.top) / 2;

        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(155,155,155,0.3)"
        ctx.strokeWidth = "1"
        ctx.fillStyle = "rgba(255,255,255,0.75)"


        //draw base hexagons
        for (var i = 0; i < hexagons.length; i++) {
            //console.log(hexagons[i], i)
            if (_this.hover_overview_hexagon_id && _this.hover_overview_hexagon_id == i) {
                ctx.fillStyle = "rgba(155,155,255,0.35)";
            } else {
                ctx.fillStyle = "rgba(255,255,255,0.35)";
            }
            //console.log(ctx.fillStyle)
            ctx.beginPath();


            var r = 0.5 / 6 * Math.PI * 2;
            var x = hexagons[i].absolute_x * scale * lvl_scale + m_hex_r * Math.cos(r) + ox;
            var y = hexagons[i].absolute_y * scale * lvl_scale + m_hex_r * Math.sin(r) + oy;
            ctx.moveTo(x, y)
            //console.log(x, y)
            for (var j = 1; j < 6; j++) {

                var r = (j + .5) / 6 * Math.PI * 2;
                var x = hexagons[i].absolute_x * scale * lvl_scale + m_hex_r * Math.cos(r) + ox;
                var y = hexagons[i].absolute_y * scale * lvl_scale + m_hex_r * Math.sin(r) + oy;
                ctx.lineTo(x, y);
                //console.log(x, y, hexagons[i].absolute_x, hexagons[i].absolute_y)
            }
            // console.log("----------")
            ctx.closePath();
            ctx.stroke()


            ctx.fill();
        }

        //draw selected subtopics
        if(_this.overview.subtopics)
        for (var i = 0; i < _this.overview.subtopics.length; i++) {
            var id = _this.overview.subtopics[i].id;
            var sub_topic_hexagon = (hexagons[id]);
            ctx.beginPath();
            ctx.fillStyle = "rgba(255,1,1,0.15)";
            var r = 0.5 / 6 * Math.PI * 2;
            var x = sub_topic_hexagon.absolute_x * scale * lvl_scale + m_hex_r * Math.cos(r) + ox;
            var y = sub_topic_hexagon.absolute_y * scale * lvl_scale + m_hex_r * Math.sin(r) + oy;
            ctx.moveTo(x, y)
            for (var j = 1; j < 6; j++) {

                var r = (j + .5) / 6 * Math.PI * 2;
                var x = sub_topic_hexagon.absolute_x * scale * lvl_scale + m_hex_r * Math.cos(r) + ox;
                var y = sub_topic_hexagon.absolute_y * scale * lvl_scale + m_hex_r * Math.sin(r) + oy;
                ctx.lineTo(x, y);
            }
            // console.log("----------")
            ctx.closePath();
            ctx.fill();
        }

        function draw_line(ctx, x1, y1, x2, y2) {
            //console.log(x1, y1, x2, y2);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(55,55,55,1)"
        ctx.strokeWidth = "3"
        //draw boarders for clustering
        for (var i = 0; i < hexagons.length; i++) {
            var border_data = hexagons[i].borders;
            var x = hexagons[i].absolute_x * scale * lvl_scale + ox;
            var y = hexagons[i].absolute_y * scale * lvl_scale + oy;
            for (var b = 0; b < border_data.length; b++) {

                var rotate = border_data[b] - 1;
                var r = m_hex_r;
                var rs1 = ((rotate - 1) ) / 6;
                var x1 = 0 + Math.cos(Math.PI * 2 * rs1 + Math.PI / 6) * r + x;
                var y1 = 0 + Math.sin(Math.PI * 2 * rs1 + Math.PI / 6) * r + y;
                var rs2 = (rotate) / 6;
                var x2 = 0 + Math.cos(Math.PI * 2 * rs2 + Math.PI / 6) * r + x;
                var y2 = 0 + Math.sin(Math.PI * 2 * rs2 + Math.PI / 6) * r + y;
                //console.log(rs1, rs2, [x1, y1, x2, y2])
                draw_line(ctx, x1, y1, x2, y2);
            }


        }

    }
    var bind_overview_mouseevents = function (level) {

        var data = _this.hexmap_data[level];
        var hexagons = _this.topic_data[level].data.hexagons;

        var canvas = _this.overview.map._groups[0][0];
        var ctx = canvas.getContext("2d");

        var padding = _this.overview.padding;

        var rangex = (_this.boundary_box.max_x - _this.boundary_box.min_x);
        var rangey = (_this.boundary_box.max_y - _this.boundary_box.min_y);
        var scale = Math.min(
            (_this.config.height - padding.top - padding.bottom) / rangey,
            (_this.config.width - padding.left - padding.right) / rangex
        );

        var lvl_scale = Math.pow(1 / 3, level);


        var ox = padding.left + (_this.config.width - padding.right - padding.left) / 2;
        var oy = padding.top + (_this.config.height - padding.bottom - padding.top) / 2;

        function square_distant(x1, y1, x2, y2) {
            var dx = x2 - x1;
            var dy = y2 - y1;
            return dx * dx + dy * dy;
        }

        var mousemove = function () {
            var mouse = d3.mouse(this);
            //if mouse is on hexagon
            var x = mouse[0];
            var y = mouse[1];

            var rgba = ctx.getImageData(x, y, 1, 1).data;
            if (rgba[3] > 0) {
                _this.overview_mouse_on_hexagon = true;
            } else {
                _this.hover_overview_hexagon_id = null;
                render_overview(level)
                return;
            }


            var min_dist = 9999999;
            // console.log(x, y);
            var closest = -1;
            for (var i = 0; i < hexagons.length; i++) {
                var hx = hexagons[i].absolute_x * scale * lvl_scale + ox;
                var hy = hexagons[i].absolute_y * scale * lvl_scale + oy;
                var dist = square_distant(hx, hy, x, y);
                if (dist < min_dist) {
                    min_dist = dist;
                    closest = i;
                }
            }
            if (closest !== _this.hover_overview_hexagon_id) {
                _this.hover_overview_hexagon_id = closest;

                // all about hovered hexagon
                //overview hexagon

                var sm_x = hexagons[closest].absolute_x * scale * lvl_scale + ox
                var sm_y = hexagons[closest].absolute_y * scale * lvl_scale + oy

                //real view hexagon
                var lm_x = hexagons[closest].absolute_x * _this.view.zoom_scale * lvl_scale + _this.view.offsetx
                var lm_y = hexagons[closest].absolute_y * _this.view.zoom_scale * lvl_scale + _this.view.offsety

                var dx = lm_x - sm_x;
                var dy = lm_y - sm_y;


                //console.log(sm_x, sm_y, "|", lm_x, lm_y)
                _this.view.x = -dx / _this.view.zoom_scale;
                _this.view.y = -dy / _this.view.zoom_scale;

                _this.drag_graph(_this.view_wrap, true);
                _this.render();
                render_overview(level)
            } else {
            }
        }


        _this.overview.map
            .on("mousemove", mousemove)

    }

    var enter_render = function (data, super_wrapper_group) {

        //var node_data_children = node_data.children;

        for (var l = 0; l < _this.topic_data.length; l++) {

            var node_data = data[l];

            var scale = 1; //scale for sub level
            var shrink = _this.get_hexagon_padding_scale(node_data);

            var hexagons = filter_invisible_hexagons(node_data.data.hexagons, l);

            hexagons = hexagons.filter(function (d) {
                return d.visible
            })
            //wrap for all hex
            var hexagons_wrap = super_wrapper_group
                .append("g")
                .attr("class", "hex-wrap-" + l)

            //data selection
            var selection = hexagons_wrap
                .selectAll("g.wrap-single-" + l)
                .data(hexagons, function (d) {
                    return d.pos
                })

            //enter selection

            selection.enter().append("g")
                .attr("class", "wrap-single-" + l)
                .style("transform", function (d, i) {
                    return "translate(" + d.x + "px," + d.y + "px) " +
                        "scale(" + scale * shrink + "," + scale * shrink + ")";
                })
                .each(function (d, i) {
                    _this.draw_topic(d3.select(this), node_data, d, d.pos)
                })


        }
    }

    var update_render = function (data, super_wrapper_group) {

        //var node_data_children = node_data.children;
        var level = _this.get_zoom_depth();
        render_overview(level);
        bind_overview_mouseevents(level)
        for (var l = 0; l < _this.topic_data.length; l++) {

            var node_data = data[l];

            var scale = 1; //scale for sub level
            var shrink = _this.get_hexagon_padding_scale(node_data)
            //rendering
            //hexagon data, position
            //console.log(node_data.depth, level)
            var hexagons = filter_invisible_hexagons(node_data.data.hexagons, l);

            hexagons = hexagons.filter(function (d) {
                return d.visible
            })
            //console.log(hexagons.length)
            //wrap for all hex
            var hexagons_wrap = super_wrapper_group
                .select("g.hex-wrap-" + l)

            hexagons_wrap.style("transform", function (d) {

                var lvl_scale = Math.pow(1 / 3, l);
                //console.log(l, lvl_scale, "scale(" + lvl_scale + "," + lvl_scale + ")")
                return "scale(" + lvl_scale + "," + lvl_scale + ")";
            })

            //data selection
            var selection = hexagons_wrap
                .selectAll("g.wrap-single-" + l)
                .data(hexagons, function (d) {
                    return d.pos
                })

            //exit
            selection.exit()
                .transition()
                .duration(_this.config.transition_duration)
                .style("opacity", 0)
                .remove()

            //enter
            var polygon_wrap_enter = selection.enter().append("g")
                .attr("class", "wrap-single-" + l)
                .style("opacity", 0)
                .style("transform", function (d) {
                    return "translate(" + d.x + "px," + d.y + "px) " +
                        "scale(" + scale * shrink + "," + scale * shrink + ")";
                })
                .each(function (d, i) {
                    //console.log(l,node_data, d )
                    _this.draw_topic(d3.select(this), node_data, d, d.pos)
                })
                .transition()
                .duration(_this.config.transition_duration)
                .style("opacity", 1)

            //update
            selection.selectAll("g")
                .each(function (d, i) {

                    switch_pie_display(d3.select(this), node_data, d, d.pos);

                })


            selection.selectAll("g.data")
                .each(function (d, i) {
                    _this.draw_pie_in_group(
                        d3.select(this),
                        node_data.data.topicClassesDistrib[d.pos],
                        node_data.data.topicClassesDistrib,
                        node_data.depth)
                })


            //update search query pies
            selection.selectAll("g.data")
                .each(function (d, i) {
                    _this.draw_query_distribution(d3.select(this), d.pos, node_data.data.query_result, l);
                })

            // //update on click select
            selection.select("polygon")
                .transition()
                .each(function (d) {
                    if (_this.view.selected_hex && d == _this.view.selected_hex.hex) {
                        d3.select(this)
                            .style("fill", _this.colors.selected)
                            .style("stroke-width", 1.5)
                        //.style("stroke", "rgba(100,100,100,0.7")
                    } else {
                        d3.select(this)
                            .style("fill", _this.colors.background)
                            .style("stroke-width", 1.5)
                        //.style("stroke", _this.colors.border)
                    }
                })

            selection.select("g.data")
                .transition()
                .duration(_this.config.transition_duration)
                .style("opacity", _this.get_zooming_opacity(node_data))


        }

        _this.calculate_boundary_box();
    }

    _this.postload_list.push(function render_once() {

        console.log("render once!");
        add_overview_map()
        enter_render(_this.topic_data, _this.view_wrap);
        update_render(_this.topic_data, _this.view_wrap);
        console.log("render add_overview_map!");
    });
    _this.render = function () {
        //console.log("re-rendering")
        update_render(_this.topic_data, _this.view_wrap);
        return _this;
    }


}