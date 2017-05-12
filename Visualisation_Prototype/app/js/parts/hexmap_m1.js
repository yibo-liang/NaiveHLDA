/**
 * Created by Devid on 06/05/2017.
 */

function add_hexmap_model_1(_this) {
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
        var display_r = Math.pow(1 / 3, depth) * _this.config.hexagon_scale * _this.view.zoom_scale;
        //console.log(display_r)
        var padding = -display_r * 0.75// -_this.config.min_hex_r * 1 ;
        var res = [];

        for (var i = 0; i < hexagons.length; i++) {
            var coor = {
                x: (hexagons[i].absolute_x + _this.view.x) * _this.view.zoom_scale + _this.view.offsetx,
                y: (hexagons[i].absolute_y + _this.view.y) * _this.view.zoom_scale + _this.view.offsety
            }

            if (_this.get_zoom_depth() < depth) { // too small to see
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

    var enter_render = function (node_data, super_wrapper_group) {
        var node_data_children = node_data.children;

        var scale = node_data.depth > 0 ? 1 / 3 : 1; //scale for sub level
        var shrink = _this.get_hexagon_padding_scale(node_data);

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
                _this.draw_topic(d3.select(this), node_data, d, d.pos)
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
        var shrink = _this.get_hexagon_padding_scale(node_data)
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
                _this.draw_topic(d3.select(this), node_data, d, d.pos)
            })
            .transition()
            .duration(_this.config.transition_duration)
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
                _this.draw_query_distribution(d3.select(this), d.pos, node_data.data.query_result, node_data.depth);
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

        //sub models
        var next = super_wrapper_group
            .select("g.children-" + node_data.depth)

        next.selectAll("g.level-wrap-" + (node_data.depth + 1))
            .each(function (d, i) {
                update_render(node_data_children[i], d3.select(this))
            })


        selection.each(function (d, i) {
            _this.update_boarder(d3.select(this), node_data, d.borders)
        })


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