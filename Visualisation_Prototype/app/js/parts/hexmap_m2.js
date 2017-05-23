/**
 * Created by Devid on 2017/5/10.
 */
/**
 * Created by Devid on 06/05/2017.
 */

function add_hexmap_model_2(_this) {

    var assign_subtopics = function (level) {
        console.log("assign level ", level)
        if (level >= 2) return;
        var select = _this.view.selected_hex_at_level[level];
        console.log("subtopic of ",select)
        var num_topics = 10;
        var subtopic_similarity = _this.compare_data[level][parseInt(select.hex.pos)];
        var subtopics = subtopic_similarity.map(function (d, i) {
            return {id: i, value: d};
        })

        var a = subtopics.sort(function (a, b) {
            return b.value - a.value;
        }).slice(0, num_topics);
        console.log(JSON.stringify(a));
        _this.overview.subtopics_at_level[level] = a;
    }
    _this.view.selected_hex_at_level = [];
    _this.zooming_states = {
        current: "s0",
        s0: function () {
            //_this.overview.subtopics = [];
            _this.overview.popup_subtopics = true;

            _this.overview.popup_clusters = [];
            _this.overview.level = 0;
            _this.set_zoom_depth(0)
            console.log(_this.get_zoom_depth())
        },
        s1a: function () {
            _this.overview.popup_subtopics = false;
            _this.set_zoom_depth(1)
            _this.overview.level = 1;
            console.log(_this.get_zoom_depth())
            d3.select("g.subtopics")
                .selectAll("g.subtopic-cluster")
                .style("pointer-events", "none")
        },
        s1b: function () {
            _this.overview.popup_subtopics = true;
            _this.hover_overview_hexagon_id = null;
            _this.overview.level = 1;
            _this.set_zoom_depth(1)
            console.log(_this.get_zoom_depth())

            d3.select("g.subtopics")
                .selectAll("g.subtopic-cluster")
                .style("pointer-events", "auto")
        },
        s2a: function () {
            _this.overview.popup_subtopics = false;
            _this.overview.level = 2;
            _this.set_zoom_depth(2)
            console.log(_this.get_zoom_depth())

            d3.select("g.subtopics")
                .selectAll("g.subtopic-cluster")
                .style("pointer-events", "none")
        },
        s2b: function () {
            _this.overview.popup_subtopics = true;
            _this.hover_overview_hexagon_id = null;
            _this.overview.level = 2;
            _this.set_zoom_depth(2)
            console.log(_this.get_zoom_depth())

            d3.select("g.subtopics")
                .selectAll("g.subtopic-cluster")
                .style("pointer-events", "auto")
        }
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

        _this.overview.subtopics_at_level = [];

        _this.overview.popup_subtopics = true;

        var container = _this.hexmap_container;
        _this.overview.container = container
            .append("div")
            .attr("class", "overview-container")

        _this.overview.map = _this.overview.container
            .append("canvas")
            .attr("class", "overview")
            .attr("height", _this.config.height + "px")
            .attr("width", _this.config.width + "px")

        if (!_this.overview.supertopic_container) {
            _this.overview.supertopic_container =
                _this.overview.container.append("div").attr("class", "overview-supertopic-container")
                    .append("svg")
                    .attr("class", "overview-supertopic-svg")
                    .attr("id", "overview_supertopic_svg")
                    .attr("width", _this.config.width + "px")
                    .attr("height", _this.config.height + "px");


            //transparent background for hide popup subtopics
            _this.overview.supertopic_container_background = _this.overview.supertopic_container
                .append("rect")
                .attr("width", _this.config.width)
                .attr("height", _this.config.height)
                .attr("style", "fill:rgba(0,0,0,0)")


        }

        console.log("add overview done")
    }


    var render_subtopic_popup = function (level) {

        var select = _this.view.selected_hex_at_level[level];

        console.log(select, level)

        function distance(x1, y1, x2, y2) {
            var dx = x1 - x2;
            var dy = y1 - y2;
            var dist = Math.sqrt(dx * dx + dy * dy);
            return dist;
        }

        function is_colliding(hex_a, hex_b, offset_a, offset_b) {
            var ox1 = 0;
            var oy1 = 0;
            var ox2 = 0;
            var oy2 = 0;
            if (!!offset_a && !!offset_b) {
                ox1 = offset_a.x;
                oy1 = offset_a.y;
                ox2 = offset_b.x;
                oy2 = offset_b.y;
            }

            var min_dist = _this.config.hexagon_scale * 2;


            var dist = distance(
                hex_a.x + ox1, hex_a.y + oy1,
                hex_b.x + ox2, hex_b.y + oy2
            );

            if (dist <= min_dist * 1.01) {
                //console.log("close hex",hex_a.x, hex_a.y, hex_b.x, hex_b.y, dist)
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

        function is_cluster_colliding2(cluster_a, cluster_b) {
            var offset_a = {
                x: cluster_a.offsetx,
                y: cluster_a.offsety
            }
            var offset_b = {
                x: cluster_b.offsetx,
                y: cluster_b.offsety
            }
            for (var a = 0; a < cluster_a.length; a++) {
                for (var b = 0; b < cluster_b.length; b++) {
                    var hex_a = cluster_a[a];
                    var hex_b = cluster_b[b];
                    if (is_colliding(hex_a, hex_b, offset_a, offset_b)) {
                        return true;
                    }
                }
            }
            return false;
        }

        function is_cluster_colliding_any(clusters, i) {
            var cluster = clusters[i];
            for (var k = 0; k < clusters.length; k++) {
                if (i !== k) {
                    var another = clusters[k];
                    if (is_cluster_colliding2(cluster, another)) {
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
                        if (i !== j && is_cluster_colliding(result_groups[i], result_groups[j])) {
                            merged = true;
                            result_groups[i] = result_groups[i].concat(result_groups[j]);
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

        function pack_cluster(clusters, repeat) {
            //centroid point of all and each of the clusters
            var xsum_all = 0;
            var ysum_all = 0;
            var count = 0;
            for (var i = 0; i < clusters.length; i++) {
                var cluster = clusters[i];

                var xsum = 0;
                var ysum = 0;

                for (var k = 0; k < cluster.length; k++) {
                    var hex = cluster[k];
                    xsum_all += hex.absolute_x;
                    ysum_all += hex.absolute_y;
                    xsum += hex.absolute_x;
                    ysum += hex.absolute_y;
                    count++;
                }
                cluster.finalised = false;
                if (!repeat) {
                    cluster.offsetx = 0;
                    cluster.offsety = 0;
                }
                cluster.cx = xsum / cluster.length;
                cluster.cy = ysum / cluster.length;
            }
            var cx = xsum_all / count;
            var cy = ysum_all / count;

            //sort clusters by distance to centroid point
            clusters = clusters.sort(function (a, b) {
                var diff = distance(a.cx, a.cy, cx, cy) - distance(b.cx, b.cy, cx, cy);
                if (repeat) diff = -diff;
                return diff;
            })

            //packing by moving one step at a time.
            var step = 5;
            var all_finalised = false;
            var count = 0;
            // for (var i = 0; i < clusters.length; i++) {
            //
            //     var cluster = clusters[i];
            //     while(!cluster.finalised){
            //         var dx = cluster.cx + cluster.offsetx - cx;
            //         var dy = cluster.cy + cluster.offsety - cy;
            //         var radian = Math.atan2(dy, dx);
            //
            //         step = Math.sqrt(dx * dx + dy * dy) / 20;
            //         step = step > 10 ? 10 : step;
            //         if (step < 0.5) {
            //             cluster.finalised = true;
            //             break;
            //         }
            //
            //         var stepx = step * Math.cos(radian)
            //         var stepy = step * Math.sin(radian)
            //
            //         cluster.offsetx -= stepx;
            //         cluster.offsety -= stepy;
            //
            //         if (is_cluster_colliding_any(clusters, i)) {
            //             //revert if step causes collision, and finalise it
            //             cluster.offsetx += stepx;
            //             cluster.offsety += stepy;
            //             cluster.finalised = true;
            //             break;
            //         }
            //     }
            // }
            while (!all_finalised) {
                all_finalised = true;
                count++;
                for (var i = 0; i < clusters.length; i++) {
                    var cluster = clusters[i];
                    if (!cluster.finalised) {
                        var dx = cluster.cx + cluster.offsetx - cx;
                        var dy = cluster.cy + cluster.offsety - cy;
                        var radian = Math.atan2(dy, dx);

                        step = Math.sqrt(dx * dx + dy * dy) / 50;
                        step = step > 10 ? 10 : step;
                        if (step < 0.5) {
                            cluster.finalised = true;
                            break;
                        }

                        var stepx = step * Math.cos(radian)
                        var stepy = step * Math.sin(radian)

                        cluster.offsetx -= stepx;
                        cluster.offsety -= stepy;
                        var collide = is_cluster_colliding_any(clusters, i);
                        if (collide) {
                            //revert if step causes collision, and finalise it
                            cluster.offsetx += stepx;
                            cluster.offsety += stepy;
                            cluster.finalised = true;
                        }

                    }
                    all_finalised = all_finalised && cluster.finalised;

                }
            }
            //console.log("Packing finished after ", count, " iterations")


        }

        function clusters_boundary(clusters) {
            var min_x = 99999;
            var min_y = 99999;
            var max_x = -99999;
            var max_y = -99999;

            for (var i = 0; i < clusters.length; i++) {
                var cluster = clusters[i];
                var offsetx = cluster.offsetx;
                var offsety = cluster.offsety;
                //console.log("offsets ", offsetx, offsety)
                for (var k = 0; k < cluster.length; k++) {
                    var hex = cluster[k];
                    var x = hex.absolute_x + offsetx;
                    var y = hex.absolute_y + offsety;
                    if (x > max_x) max_x = x;
                    if (x < min_x) min_x = x;
                    if (y > max_y) max_y = y;
                    if (y < min_y) min_y = y;
                }
            }
            for (var i = 0; i < clusters.length; i++) {

                var cluster = clusters[i];

                cluster.offsetx_origin = cluster.offsetx;
                cluster.offsety_origin = cluster.offsety;

                cluster.offsetx += -min_x;
                cluster.offsety += -min_y

                cluster.i = (+new Date()) + level + "-" + i;
            }

            return {
                x: 0,
                y: 0,
                width: max_x - min_x,
                height: max_y - min_y
            }
        }

        var num_topics = 10;

        var padding = _this.overview.padding;
        var ox = padding.left + (_this.config.width - padding.right - padding.left) / 2;
        var oy = padding.top + (_this.config.height - padding.bottom - padding.top) / 2;
        //console.log("render select lvl", level, _this.overview.level)
        var clusters = _this.overview.popup_clusters ? _this.overview.popup_clusters : [];
        console.log("cluster = ", clusters, "select = ", select, "subtopics = ", _this.overview.subtopics);
        if (clusters.length == 0 && select) {
            //render once for level unless something changed
            console.log("render sub topic overview hightlight")


            var hexagons = _this.topic_data[level + 1].data.hexagons;
            console.log("hexagons", hexagons)
            var sub_topic_hexagons = [];
            var subtopics = _this.overview.subtopics_at_level[level];
            for (var i = 0; i < subtopics.length; i++) {
                var id = subtopics[i].id;
                sub_topic_hexagons.push(hexagons[id]);
            }
            console.log("sub_topic_hexagons", sub_topic_hexagons)
            clusters = clustering_subtopics(sub_topic_hexagons);
            _this.overview.popup_clusters = clusters;
            pack_cluster(clusters);
            pack_cluster(clusters, true);
        }

        var scale = _this.overview.scale;
        var lvl_scale = Math.pow(1 / 3, level + 1);
        var overall_scale = scale * lvl_scale;
        console.log("render clusters ", clusters)
        var boundary = clusters_boundary(clusters)
        _this.overview.subtopic_clusters = clusters;
        _this.overview.subtopic_boundary = boundary;

        //console.log("popup overval scale enter", overall_scale);
        var subtopic_container;
        if (!_this.overview.subtopic_container) {
            console.log("first time render")
            subtopic_container = _this.overview.supertopic_container
                .append("g")
                .attr("class", "subtopics")
                .style("transform", function () {
                    var str = "translate(" + ox + "px," + oy + "px) "
                        + "scale(" + overall_scale + "," + overall_scale + ")";
                    return str;
                })
            _this.overview.subtopic_container = subtopic_container;
        } else {
            console.log("multi time render", level, _this.overview.level)
            subtopic_container = _this.overview.subtopic_container;
            //if (_this.overview.level !== level) {
            lvl_scale = Math.pow(1 / 3, level + 1);
            overall_scale = scale * lvl_scale;
            subtopic_container
                .transition()
                .ease(d3.easeLinear)
                .delay(_this.config.transition_duration * 1)
                .duration(_this.config.transition_duration * 1)
                .style("transform", function () {
                    var str = "translate(" + ox + "px," + oy + "px) "
                        + "scale(" + overall_scale + "," + overall_scale + ")";
                    return str;
                })

            //
            //}
        }
        _this.overview.level = level;
        var cluster_enter = subtopic_container
            .selectAll("g.subtopic-cluster")
            .data(clusters, function (d) {
                return d.i;
            })
            .enter()
            .append("g")
            .attr("class", "subtopic-cluster")

        cluster_enter.each(function (d, i) {
            d3.select(this).selectAll("g.subtopic-hex")
                .data(d)
                .enter()
                .append("g")
                .attr("class", "subtopic-hex")
                .style("transform", function (d) {
                    return "translate(" + d.absolute_x + "px," + d.absolute_y + "px)"
                })
                .each(function (x, k) {
                    var data = _this.topic_data[level + 1];
                    x.visible = true;
                    _this.draw_topic(
                        d3.select(this), data, x, x.pos,
                        false, true,
                        {
                            dbclick: function (d, node_data, i) {
                                //console.log("click dpth = " , node_data);
                                _this.show_cloud(node_data.data.topics[i]);
                                _this.view.selected_hex = {
                                    data: node_data,
                                    hex: d
                                }
                                _this.view.selected_hex_at_level[node_data.level] = _this.view.selected_hex;
                                assign_subtopics(node_data.level);
                                _this.zoom_to_depth(node_data, d.absolute_x, d.absolute_y);
                            },
                            click: function (d, node_data, i) {
                                _this.show_cloud(node_data.data.topics[i]);
                                //console.log(node_data, _this.get_zooming_opacity(node_data))
                                _this.view.selected_hex = {
                                    data: node_data,
                                    hex: d
                                }
                                _this.view.selected_hex_at_level[node_data.level] = _this.view.selected_hex;
                                console.log("click", _this.view.selected_hex_at_level)
                                //console.log(node_data.data.topicClassesDistrib[i], i)
                                assign_subtopics(node_data.level);
                                _this.display_file_list(node_data, i);

                            }
                        }
                    )
                    ;
                })
        })

        var cluster_update = subtopic_container
            .selectAll("g.subtopic-cluster")
            .data(clusters, function (d) {
                return d.i;
            })

        cluster_update
            .exit()
            .remove()


        //update with packing animation

        //if (_this.overview.subtopics) {

        var scale = _this.overview.scale;
        var lvl_scale = Math.pow(1 / 3, level + 1);
        var overall_scale = scale * lvl_scale;

        var boundary = _this.overview.subtopic_boundary;
        var dx = boundary.width;
        var dy = boundary.height;

        var padding = _this.overview.padding;
        var subtopic_scale = Math.min(
            (_this.config.height - padding.top - padding.bottom) / dy,
            (_this.config.width - padding.left - padding.right) / dx
        );
        if (_this.overview.popup_subtopics) {
            d3.select("g.subtopics")
                .transition()
                .ease(d3.easeLinear)
                .delay(_this.config.transition_duration * 1)
                .duration(_this.config.transition_duration * 1)
                .style("transform", function () {
                    var tempx = (_this.config.width - boundary.width * subtopic_scale ) / 2;
                    var tempy = (_this.config.height - boundary.height * subtopic_scale ) / 2;
                    //console.log(tempx, tempy, boundary.width, boundary.height);
                    var str = "translate(" + tempx + "px," + tempy + "px) "
                        + "scale(" + subtopic_scale + "," + subtopic_scale + ")";
                    //console.log("enlarge " + str);
                    return str;
                })

            d3.select("g.subtopics")
                .selectAll("g.subtopic-cluster")
                .data(_this.overview.subtopic_clusters)
                .transition()
                .ease(d3.easeLinear)
                .delay(_this.config.transition_duration * 1)
                .duration(_this.config.transition_duration * 1)
                .style("transform", function (d) {
                    return "translate(" + d.offsetx + "px," + d.offsety + "px)";
                })
        } else {

            //console.log("popup overval scale update", overall_scale);
            d3.select("g.subtopics")
                .transition()
                .ease(d3.easeLinear)
                .duration(_this.config.transition_duration * 1)
                .style("transform", function () {

                    var str = "translate(" + ox + "px," + oy + "px) "
                        + "scale(" + overall_scale + "," + overall_scale + ")";
                    return str;
                })
            var update = d3.select("g.subtopics")
                .selectAll("g.subtopic-cluster")

            update.transition()
                .ease(d3.easeLinear)
                .duration(_this.config.transition_duration * 1)
                .style("transform", function (d) {
                    return "translate(" + 0 + "px," + 0 + "px)";
                })


        }
        //update pie chart for the selection of subtopics
        _this.overview.supertopic_container
            .selectAll("g.subtopic-hex")
            .each(function (d, i) {
                //console.log("d=",d);
                var node_data = _this.topic_data[level + 1];
                _this.draw_pie_in_group(
                    d3.select(this),
                    node_data.data.topicClassesDistrib[d.pos],
                    node_data.data.topicClassesDistrib,
                    node_data.depth
                )
            })
        // }


    }

    var render_supertopic_overview = function (level) {


        var shrink_scale = 0.75;
        var select = _this.view.selected_hex_at_level[level];

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
                .data(data, function (d) {
                    return d.hex.topic_id;
                })
                .enter()

            var padding = _this.config.hexagon_scale * shrink_scale;

            var container = enter.append("g")
                .attr("class", "super-topic-container")
                .style("transform", "translate(" + padding + "px," + padding + "px)"
                    + " scale(" + shrink_scale + "," + shrink_scale + ")")

            container.each(function (d) {
                // _this.draw_topic(
                //     container, d.data, d.hex, d.hex.pos, true, false,
                //     {
                //         dbclick: function (d, node_data, i) {
                //
                //         },
                //         click: function (d, node_data, i) {
                //
                //         }
                //     }
                // )
                _this.draw_topic(
                    container, d.data, d.hex, d.hex.pos, true, false,
                    {
                        dbclick: function (d, node_data, i) {
                            //console.log("click dpth = " , node_data);
                            _this.show_cloud(node_data.data.topics[i]);
                            _this.view.selected_hex = {
                                data: node_data,
                                hex: d
                            }
                            _this.view.selected_hex_at_level[node_data.level] = _this.view.selected_hex;
                            assign_subtopics(node_data.level);
                            _this.zoom_to_depth(node_data, d.absolute_x, d.absolute_y);
                        },
                        click: function (d, node_data, i) {
                            _this.show_cloud(node_data.data.topics[i]);
                            //console.log(node_data, _this.get_zooming_opacity(node_data))
                            _this.view.selected_hex = {
                                data: node_data,
                                hex: d
                            }
                            _this.view.selected_hex_at_level[node_data.level] = _this.view.selected_hex;
                            console.log("click", _this.view.selected_hex_at_level)
                            //console.log(node_data.data.topicClassesDistrib[i], i)
                            assign_subtopics(node_data.level);
                            _this.display_file_list(node_data, i);
                            _this.render();
                        }
                    }
                )

            })

            var update = _this.overview.supertopic_container
                .selectAll("g.super-topic-container")
                .data(data, function (d) {
                    return d.hex.topic_id;
                })

            update
                .exit()
                .remove();
        }

        // sub topic hightlight

        render_subtopic_popup(level);
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

        var dx = (_this.boundary_box.max_x - _this.boundary_box.min_x);
        var dy = (_this.boundary_box.max_y - _this.boundary_box.min_y);

        var padding = _this.overview.padding;
        var scale = Math.min(
            (_this.config.height - padding.top - padding.bottom) / dy,
            (_this.config.width - padding.left - padding.right) / dx
        );

        _this.overview.scale = scale;

        render_supertopic_overview(level - 1);

        //console.log(dx, dy, "dxdy")

        //var data = _this.hexmap_data[level];
        var hexagons = _this.topic_data[level].data.hexagons;
        // console.log(data, hexagons)


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
        ctx.lineWidth = "3"
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
        if (_this.overview.subtopics)
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

        ctx.strokeStyle = "rgba(99,99,99,0.8)"
        ctx.lineWidth = "3"
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


        var zoomin = function () {
            console.log("zoom in current was ", _this.zooming_states.current)

            var level = _this.overview.level;
            var subtopics = _this.overview.subtopics_at_level[level];
            var old = _this.zooming_states.current;
            if (_this.zooming_states.current == "s0") {
                _this.zooming_states.current = "s1a";
            } else if (_this.zooming_states.current == "s1a") {
                if (subtopics) {
                    _this.zooming_states.current = "s1b";
                } else {
                    _this.zooming_states.current = "s2a";
                }
            } else if (_this.zooming_states.current == "s1b") {
                _this.overview.popup_clusters = [];
                _this.zooming_states.current = "s2a";
            } else if (_this.zooming_states.current == "s2a") {
                if (subtopics) {
                    _this.zooming_states.current = "s2b";
                }
            }
            if (_this.zooming_states.current !== old) {
                console.log("zoom to " + _this.zooming_states.current)
                _this.zooming_states[_this.zooming_states.current]();
                _this.drag_graph(_this.view_wrap, true);
                _this.render();
            }
            //
            // if (!_this.overview.popup_subtopics) {
            //     _this.overview.popup_subtopics = true;
            // } else {
            //     var lvl = _this.get_zoom_depth();
            //     if (!_this.overview.subtopics || _this.overview.level !== lvl) {
            //         _this.overview.subtopics = null;
            //     }
            //     _this.view.zoom_power = (_this.get_zoom_depth() + 1) * 2 + 1;
            //     _this.view.zoom_power = Math.min(Math.max(_this.view.zoom_power, 1), 7);
            //     _this.view.zoom_scale = Math.pow(_this.view.zoom_base, _this.view.zoom_power - 1)
            //     _this.overview.popup_subtopics = true;
            //
            //
            // }
        }

        var zoomout = function () {
            console.log("zoomout")
            var old = _this.zooming_states.current;
            var level = _this.overview.level
            var subtopics = _this.overview.subtopics_at_level[level - 1];
            switch (_this.zooming_states.current) {
                case "s1a":
                    _this.zooming_states.current = "s0";
                    break;
                case "s1b":
                    _this.zooming_states.current = "s1a";
                    break;
                case "s2a":
                    if (subtopics) {
                        _this.overview.popup_clusters = [];
                        _this.zooming_states.current = "s1b";
                    } else {
                        _this.zooming_states.current = "s1a";
                    }
                    break;
                case "s2b":
                    _this.zooming_states.current = "s2a";
                    break;

            }
            if (old !== _this.zooming_states.current) {
                console.log("zoom to " + _this.zooming_states.current)
                _this.zooming_states[_this.zooming_states.current]();
                _this.drag_graph(_this.view_wrap, true);
                _this.render();
            }

            // if (!_this.overview.popup_subtopics || !_this.view.selected_hex) {
            //     _this.overview.subtopics = null;
            //     _this.view.zoom_power = (_this.get_zoom_depth() - 1) * 2 + 1;
            //     _this.view.zoom_power = Math.min(Math.max(_this.view.zoom_power, 1), 7);
            //     _this.view.zoom_scale = Math.pow(_this.view.zoom_base, _this.view.zoom_power - 1)
            //     _this.overview.popup_subtopics = true;
            //     _this.drag_graph(_this.view_wrap, true);
            //     _this.render()
            // } else if (_this.overview.popup_subtopics) {
            //     _this.overview.popup_subtopics = false;
            // }
        }

        var click = function () {

            // var hex_id = _this.hover_overview_hexagon_id;
            zoomout();

        }

        var mousemove = function () {
            if (_this.overview.popup_subtopics) {
                //no reaction if subtopics are poped up
                return;
            }

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


        _this.overview.supertopic_container_background
            .on("mousemove", mousemove)
            .on("click", function () {
                click();
            })


        //mouse wheel
        bind_mousewheel("overview_supertopic_svg", function (delta) {

            _this.mousewheel_delta += delta;

            if (_this.wheel_timeout_cache) {
                clearTimeout(_this.wheel_timeout_cache);
            }
            _this.wheel_timeout_cache = setTimeout(function () {
                console.log("delta=", delta)
                if (_this.mousewheel_delta < 0) {
                    zoomout();
                } else if (_this.mousewheel_delta > 0) {
                    zoomin();
                }

                _this.mousewheel_delta = 0;
            }, 50)
        })

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
                    _this.draw_topic(
                        d3.select(this), node_data, d, d.pos, undefined, undefined,
                        {
                            dbclick: function (d, node_data, i) {
                                //console.log("click dpth = " , node_data);
                                _this.show_cloud(node_data.data.topics[i]);
                                _this.view.selected_hex = {
                                    data: node_data,
                                    hex: d
                                }
                                _this.view.selected_hex_at_level[node_data.level] = _this.view.selected_hex;
                                assign_subtopics(node_data.level);
                                _this.zoom_to_depth(node_data, d.absolute_x, d.absolute_y);
                            },
                            click: function (d, node_data, i) {
                                _this.show_cloud(node_data.data.topics[i]);
                                //console.log(node_data, _this.get_zooming_opacity(node_data))
                                _this.view.selected_hex = {
                                    data: node_data,
                                    hex: d
                                }
                                _this.view.selected_hex_at_level[node_data.level] = _this.view.selected_hex;
                                console.log("click", _this.view.selected_hex_at_level)
                                //console.log(node_data.data.topicClassesDistrib[i], i)
                                assign_subtopics(node_data.level);
                                _this.display_file_list(node_data, i);
                                _this.render();
                            }
                        }
                    )
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
                    //_this.draw_topic(d3.select(this), node_data, d, d.pos)
                    _this.draw_topic(
                        d3.select(this), node_data, d, d.pos, undefined, undefined,
                        {
                            dbclick: function (d, node_data, i) {
                                //console.log("click dpth = " , node_data);
                                _this.show_cloud(node_data.data.topics[i]);
                                _this.view.selected_hex = {
                                    data: node_data,
                                    hex: d
                                }
                                _this.view.selected_hex_at_level[node_data.level] = _this.view.selected_hex;
                                assign_subtopics(node_data.level);
                                _this.zoom_to_depth(node_data, d.absolute_x, d.absolute_y);
                            },
                            click: function (d, node_data, i) {
                                _this.show_cloud(node_data.data.topics[i]);
                                //console.log(node_data, _this.get_zooming_opacity(node_data))
                                _this.view.selected_hex = {
                                    data: node_data,
                                    hex: d
                                }
                                _this.view.selected_hex_at_level[node_data.level] = _this.view.selected_hex;
                                console.log("click", _this.view.selected_hex_at_level)
                                //console.log(node_data.data.topicClassesDistrib[i], i)
                                assign_subtopics(node_data.level);
                                _this.display_file_list(node_data, i);
                                _this.render();
                            }
                        }
                    )
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