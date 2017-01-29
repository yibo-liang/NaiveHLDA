/**
 * Created by Devid on 2017/1/25.
 */


var render_info = {
    hexmap_data: null,
    topic_data: null,
    svgheight: window.innerHeight
    || document.documentElement.clientHeight
    || document.body.clientHeight,
    svgwidth: window.innerWidth
    || document.documentElement.clientWidth
    || document.body.clientWidth,
    hexagon_scale: 80,
    zoom_scale: 1,
    zoom_power: 1,
    zoom_base: Math.sqrt(3),
    zoom_ease: d3.easeLinear,
    min_hex_r: 80,
    view: {

        drag_pos: {
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
}

function center_to(dx, dy) {
    var super_group = d3.select("g.super_group");
    render_info.view.x = -dx;
    render_info.view.y = -dy;
    drag_graph(super_group, true);
}

function zoom_to_depth(depth, dx, dy) {
    var super_group = d3.select("g.super_group")
    render_info.zoom_power = (depth + 1) * 2;


    render_info.zoom_power = Math.min(Math.max(render_info.zoom_power, 1), 7);

    render_info.zoom_scale = Math.pow(render_info.zoom_base, render_info.zoom_power - 1)
    console.log(render_info.view.x, render_info.view.y, "---")
    render_info.view.x = -dx;
    render_info.view.y = -dy;
    console.log(dx, dy)
    console.log(render_info.zoom_scale, render_info.zoom_power)
    render_hexmap_toplevel(super_group, null, true);
    drag_graph(super_group, true);
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


var to_render_coordinate = function (hexmap_data) {

    var offsetx = render_info.svgwidth / 2;
    var offsety = render_info.svgheight / 2;

    function copy(obj) {
        return JSON.parse(JSON.stringify(obj))
    }

    var res = [];

    for (var i = 0; i < hexmap_data.length; i++) {
        var d = {
            hexAggloPositioning: (hexmap_data[i].hexAggloPositioning),
            topicId: (hexmap_data[i].topicId),
            words: (hexmap_data[i].words),
            distances: (hexmap_data[i].distances),
            clusterAgglomerative: (hexmap_data[i].clusterAgglomerative),
        };
        var coor = hexmap_data[i].hexAggloCoord;
        d.submodels = hexmap_data[i].submodels;
        d.x = (coor.x * render_info.hexagon_scale) //* render_info.zoom_scale;
        d.y = (coor.y * render_info.hexagon_scale) //* render_info.zoom_scale;
        d.stage_x = (coor.x * render_info.hexagon_scale + render_info.view.x) * render_info.zoom_scale + offsetx;
        d.stage_y = (coor.y * render_info.hexagon_scale + render_info.view.y) * render_info.zoom_scale + offsety;
        d.absolute_x = d.x;
        d.absolute_y = d.y;
        //delete d.hexAggloCoord;
        // console.log(d.x, d.y)
        res.push(d);
    }
    return res;
}


function filter_invisible_data(hexmap_data, hex_r) {

    var res = [];

    var o = render_info.zoom_scale * 2 * render_info.min_hex_r;
    //var o=-30;
    //console.log(hex_r * render_info.zoom_scale, render_info.min_hex_r)
    if (hex_r * render_info.zoom_scale < render_info.min_hex_r) return res;

    for (var i = 0; i < hexmap_data.length; i++) {
        var d = hexmap_data[i];
        var x = d.stage_x;
        var y = d.stage_y;


        if (x > -o && y > -o && x < (render_info.svgwidth + o) && y < (render_info.svgheight + o)) {
            res.push(d)
        }
    }
    return res;
}

function render_hex_map_sublevel(g, super_hex, sub_topic_data, depth, transition) {
    //console.log(sub_topic_data, "DEPTH", depth)
    if (!sub_topic_data) return;
    if (depth >= 5) return;
    var sub_hex_r = Math.pow(1 / 3, depth);
    //console.log("cx cy ", cx, cy);
    function render_hex(d, i) {


        d3.select(this)
            .style("transform", function () {
                return "translate(" + d.x + "px," + d.y + "px) "
                    + "scale(" + 1 / 3 + "," + 1 / 3 + ")";
            })


        var k = d3.select(this).select("polygon.hex-" + depth);
        k
            .attr("points", function (d, i) {
                //console.log("dxdy", d.x, d.y)
                return hexagon_points(0, 0, 1 * render_info.hexagon_scale)
            })
            .style("fill", "rgba(99,99,99,0.5)")
            .style("stroke", "black")
            .style("stroke-width", 1)
            .each(function (d) {
                d3.select(this)
                    .transition(500)
                    .style("opacity", function () {
                        if (sub_hex_r * render_info.hexagon_scale * render_info.zoom_scale >= 3 * render_info.min_hex_r) {
                            return 0.025;
                        }
                        return 1
                    })
            })
            .on("dblclick", function (d) {
                console.log("click dpth = " + depth);
                zoom_to_depth(depth + 1, d.absolute_x, d.absolute_y);
            })

        ;
        //console.log("render next", sub_topic_data)
        if (sub_topic_data.model && sub_topic_data.model.submodels.length > 0)
            render_hex_map_sublevel(d3.select(this), k, sub_topic_data.model.submodels[i], depth + 1, transition);
    }

    var hex_coordinates = [];
    for (var i = 0; i < 6; i++) {
        var a = (i + 0) / 6 * Math.PI * 2;
        var x = Math.cos(a) * render_info.hexagon_scale / Math.sqrt(3);
        var y = Math.sin(a) * render_info.hexagon_scale / Math.sqrt(3);
        hex_coordinates.push({
            x: x,
            y: y,
            stage_x: super_hex.datum().stage_x + x * render_info.zoom_scale,
            stage_y: super_hex.datum().stage_y + y * render_info.zoom_scale,
            absolute_x: super_hex.datum().absolute_x + x * Math.pow(1 / 3, depth - 1),
            absolute_y: super_hex.datum().absolute_y + y * Math.pow(1 / 3, depth - 1),
            id: super_hex.datum().topicId + "-" + i
        })
    }
    hex_coordinates.push({
        x: 0,
        y: 0,
        stage_x: 0,
        stage_y: 0,
        absolute_x: super_hex.datum().absolute_x,
        absolute_y: super_hex.datum().absolute_y,
        id: super_hex.datum().topicId + "-" + 6
    })
    //console.log(hex_coordinates)
    hex_coordinates = filter_invisible_data(hex_coordinates, sub_hex_r * render_info.hexagon_scale);

    var hexagons = g.selectAll("g.hex-" + depth)
        .data(hex_coordinates, function (d) {
            return d.id;
        });


    var g2 = hexagons.enter()
        .append("g")
        .attr("class", "hex-" + depth)

    g2.append("polygon")
        .attr("class", "hex-" + depth)
        .style("fill", "rgb(255,255,255)")

    g2.each(render_hex)
        .style("opacity", "0")
        .transition()
        .style("opacity", "1");

    hexagons.exit()
        .transition(500)
        .style("opacity", 0)
        .remove()

    hexagons.each(render_hex)
}

function render_hexmap_toplevel(svg, data, transition) {

    if (render_info.hexmap_data == null) {
        render_info.hexmap_data = data;
    }
    var hexmap_data = to_render_coordinate(render_info.hexmap_data["hexmapData"]);
    hexmap_data = filter_invisible_data(hexmap_data, 1 * render_info.hexagon_scale);


    var polygons = svg.selectAll("g.hex-0")
        .data(hexmap_data, function (d) {
            return d.topicId;
        });

    function render_hex(d, i) {
        var k = d3.select(this).select("polygon.hex-0");
        d3.select(this)
            .style("transform", function () {
                return "translate(" + d.x + "px," + d.y + "px) "
            })

        var k2 = k;
        k2
            .attr("points", function (d) {
                return hexagon_points(0, 0, 1 * render_info.hexagon_scale)
            })
            .style("fill", "rgba(99,99,99,0.5)")
            .style("stroke", "black")
            .style("stroke-width", 1)
            .each(function (d) {
                d3.select(this)
                    .transition(500)
                    .style("opacity", function () {
                        if (1 * render_info.hexagon_scale * render_info.zoom_scale >= 3 * render_info.min_hex_r) {
                            return 0.025;
                        }
                        return 1
                    })
            })
            .on("dblclick", function (d) {
                console.log("click dpth = " + 0);
                if (render_info.zoom_power < 2) {
                    zoom_to_depth(0, d.absolute_x, d.absolute_y);
                } else {
                    zoom_to_depth(1, d.absolute_x, d.absolute_y);
                }
            })


        render_hex_map_sublevel(d3.select(this), k, render_info.hexmap_data["hexmapData"][i], 1, transition)

    }

    var g = polygons.enter()
        .append("g")
        .attr("class", "hex-0")


    g.append("polygon")
        .attr("class", "hex-0")

    g.each(render_hex);

    polygons.exit()
        .transition()
        .style("opacity", 0)
        .remove();

    polygons.each(render_hex)

}

function data_prepare(svg) {
    if (!render_info.hexmap_data || !render_info.topic_data) return;

    for (var i = 0; i < render_info.hexmap_data["hexmapData"].length; i++) {
        var d = render_info.topic_data["submodels"][i];
        //console.log(d)
        render_info.hexmap_data["hexmapData"][i].model = d;
    }
    //console.log("data prepared", render_info.hexmap_data)

    render_hexmap_toplevel(svg);
}


function drag_graph(super_group, transition) {
    var offsetx = render_info.svgwidth / 2;
    var offsety = render_info.svgheight / 2;

    if (transition) {
        super_group
            .transition()
            .duration(500)
            .ease(render_info.zoom_ease)
            .style("transform", "translate("
                + (render_info.view.x * render_info.zoom_scale + offsetx)
                + "px,"
                + (render_info.view.y * render_info.zoom_scale + offsety)
                + "px)"
                + " scale(" + render_info.zoom_scale + "," + render_info.zoom_scale + ")");
    } else {
        super_group
            .style("transform", "translate("
                + (render_info.view.x * render_info.zoom_scale + offsetx)
                + "px,"
                + (render_info.view.y * render_info.zoom_scale + offsety)
                + "px)"
                + " scale(" + render_info.zoom_scale + "," + render_info.zoom_scale + ")");

    }
}

function render(container_id, hex_data_url, topic_data_url) {
    var svg = d3.select(container_id).append("svg");
    svg.style("height", "100%")
        .style("width", "100%")
        .attr("id", "hex_svg");
    //svg dragging

    var super_group = svg.append("g").attr("class", "super_group")
    drag_graph(super_group);

    svg
        .on("mousedown", function () {
            render_info.view.dragging = true;
            var pos = d3.mouse(this);
            render_info.view.drag_start_pos.x = pos[0];
            render_info.view.drag_start_pos.y = pos[1];

            render_info.view.drag_pos.x = render_info.view.x;
            render_info.view.drag_pos.y = render_info.view.y;

        })
        .on("mouseup", function () {
            render_info.view.dragging = false;
            console.log("mouseup")
        })
        .on("mousemove", function () {
            if (render_info.view.dragging) {
                var pos = d3.mouse(this);

                var dx = pos[0] - render_info.view.drag_start_pos.x;
                var dy = pos[1] - render_info.view.drag_start_pos.y;
                //console.log("mousemove", dy, dx);
                var scale = render_info.zoom_scale;
                render_info.view.x = render_info.view.drag_pos.x + dx / scale;
                render_info.view.y = render_info.view.drag_pos.y + dy / scale;

                drag_graph(super_group);
                render_hexmap_toplevel(super_group)
            }
        })


    bind_mousewheel("hex_svg", function (delta) {

        render_info.zoom_power = Math.min(Math.max(delta * 1 + render_info.zoom_power, 1), 7);
        render_info.zoom_scale = Math.pow(render_info.zoom_base, render_info.zoom_power - 1)
        console.log(delta, render_info.zoom_scale, render_info.zoom_power)
        render_hexmap_toplevel(super_group, null, true);
        drag_graph(super_group, true);
    })


    d3.json(hex_data_url, function (data) {
        console.log("hex data loaded")
        render_hexmap_toplevel(super_group, data)
        data_prepare(super_group);
    })

    d3.json(topic_data_url, function (data) {
        console.log("topic model data loaded")
        render_info.topic_data = data;
        data_prepare(super_group);
    })
}

