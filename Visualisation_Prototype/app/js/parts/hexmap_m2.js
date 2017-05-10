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
        var padding = -_this.config.min_hex_r * _this.view.zoom_scale * lvl_scale * 1 ;
        var res = [];

        for (var i = 0; i < hexagons.length; i++) {
            var coor = {
                x: (hexagons[i].absolute_x + _this.view.x / lvl_scale) * _this.view.zoom_scale * lvl_scale + _this.view.offsetx,
                y: (hexagons[i].absolute_y + _this.view.y / lvl_scale) * _this.view.zoom_scale * lvl_scale+ _this.view.offsety
            }

            if (_this.get_zoom_depth() < depth) { // too small to see
                hexagons[i].visible = false;
                res.push(hexagons[i])
            } else if (coor.x  > padding
                && coor.x  < _this.config.width - padding //visible within svg
                && coor.y  > padding
                && coor.y  < _this.config.height - padding) {
                hexagons[i].visible = true;
                res.push(hexagons[i])
            } else { //out of the visible svg
                hexagons[i].visible = false;
                res.push(hexagons[i])
            }
        }
        return res;
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
                .duration(500)
                .style("opacity", 1)

            //update
            selection.selectAll("g")
                .each(function (d, i) {
                    switch_pie_display(d3.select(this), node_data, d, d.pos)

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
                .duration(500)
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
        enter_render(_this.topic_data, _this.view_wrap);
        update_render(_this.topic_data, _this.view_wrap);
    });
    _this.render = function () {
        //console.log("re-rendering")
        update_render(_this.topic_data, _this.view_wrap);
        return _this;
    }


}