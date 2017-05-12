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
        var buffer_range = -display_r * 0.75// -_this.config.min_hex_r * 1 ;

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
        return _this.display_overview;
    }

    var add_overview_map = function () {
        console.log("add overview")
        _this.config.overview_padding = {top: 150, left: 150, bottom: 50, right: 50};
        _this.display_overview = true;

        var container = _this.hexmap_container;
        _this.overview_container = container
            .append("div")
            .attr("class", "overview-container")

        _this.overview_map = _this.overview_container
            .append("canvas")
            .attr("class", "overview")
            .attr("height", _this.config.height + "px")
            .attr("width", _this.config.width + "px")

        console.log("add overview done")
    }

    var render_overview = function (level) {

        _this.calculate_boundary_box();

        _this.overview_container
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
        //console.log(dx, dy, "dxdy")
        var padding = _this.config.overview_padding;

        var data = _this.hexmap_data[level];
        var hexagons = _this.topic_data[level].data.hexagons;
        // console.log(data, hexagons)

        var scale = Math.min(
            (_this.config.height - padding.top - padding.bottom) / dy,
            (_this.config.width - padding.left - padding.right) / dx
        );

        var lvl_scale = Math.pow(1 / 3, level);
        var canvas = _this.overview_map._groups[0][0];
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

            if (_this.hover_overview_hexagon_id && _this.hover_overview_hexagon_id == i) {
                ctx.fillStyle = "rgba(155,155,255,0.75)";
            } else {
                ctx.fillStyle = "rgba(255,255,255,0.75)";
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

        var canvas = _this.overview_map._groups[0][0];
        var ctx = canvas.getContext("2d");

        var padding = _this.config.overview_padding;

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
                var lm_x = hexagons[closest].absolute_x + _this.view.offsetx
                var lm_y = hexagons[closest].absolute_y + _this.view.offsety

                var dx = lm_x - sm_x;
                var dy = lm_y - sm_y;


                console.log(sm_x, sm_y, "|", lm_x, lm_y)
                _this.view.x = -dx * lvl_scale ;
                _this.view.y = -dy * lvl_scale ;

                _this.drag_graph(_this.view_wrap, true);
                _this.render();
                render_overview(level)
            } else {
            }
        }


        _this.overview_map
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


            //exit
            selection.exit()
                .transition()
                .duration(_this.config.transition_duration)
                .style("opacity", 0)
                .remove()


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