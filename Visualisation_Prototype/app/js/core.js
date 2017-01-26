/**
 * Created by Devid on 2017/1/25.
 */


var svgheight = 500;
var svgwidth = 800;

var hexmap_data = [];

var render_info = {
    hexmap_data: null,
    topic_data: null,
    svgheight: window.innerHeight
    || document.documentElement.clientHeight
    || document.body.clientHeight,
    svgwidth: window.innerWidth
    || document.documentElement.clientWidth
    || document.body.clientWidth,
    hexagon_scale: 120,
    zoom_scale: 1,
    zoom_power: 1,
    min_hex_r: 120,
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

var hexagon_points = function (centre_x, centre_y, r) {
    var points = "";
    for (var i = 0; i < 6; i++) {
        var rs = i / 6;
        var x = centre_x + Math.cos(Math.PI * 2 * rs + Math.PI / 6) * r * render_info.zoom_scale;
        var y = centre_y + Math.sin(Math.PI * 2 * rs + Math.PI / 6) * r * render_info.zoom_scale;
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
            hexAggloCoord: copy(hexmap_data[i].hexAggloCoord),
            clusterAgglomerative: (hexmap_data[i].clusterAgglomerative),
        };
        d.submodels = hexmap_data[i].submodels;
        d.x = (d.hexAggloCoord.x * render_info.hexagon_scale + render_info.view.x) * render_info.zoom_scale + offsetx;
        d.y = (d.hexAggloCoord.y * render_info.hexagon_scale + render_info.view.y) * render_info.zoom_scale + offsety;
        delete d.hexAggloCoord;
        // console.log(d.x, d.y)
        res.push(d);
    }
    return res;
}


function filter_invisible_data(hexmap_data, hex_r) {

    var res = [];

    var o = render_info.zoom_scale * 2 * 80;
    //console.log(hex_r * render_info.zoom_scale, render_info.min_hex_r)
    if (hex_r * render_info.zoom_scale < render_info.min_hex_r) return res;

    for (var i = 0; i < hexmap_data.length; i++) {
        var d = hexmap_data[i];
        var x = d.x;
        var y = d.y;


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
    var base_r = Math.pow(1 / 3, depth - 1);
    var hex_r = base_r * (Math.sqrt(3) / 3) * render_info.zoom_scale;
    var sub_hex_r = Math.pow(1 / 3, depth);
    //console.log("cx cy ", cx, cy);
    function render_hex(d, i) {
        var k = d3.select(this).select("polygon.hex-" + depth);
        var k2 = k;
        if (transition) {
            k2 = k.transition().ease(d3.easeLinear)
                .delay(300);
        } else {

        }
        //.transition()
        //.ease(d3.easeLinear)
        k2.style("opacity", 1)
            .attr("points", function (d, i) {
                //console.log("dxdy", d.x, d.y)
                return hexagon_points(d.x, d.y, sub_hex_r * render_info.hexagon_scale)
            })
            .style("fill", "rgba(0,0,0,0)")
            .style("stroke", "black")
            .style("stroke-width", 1)
            .style("opacity", function () {
                if (sub_hex_r * render_info.hexagon_scale * render_info.zoom_scale >= 3 * render_info.min_hex_r) {
                    return 0.3;
                }
                return 1
            })
        ;
        //console.log("render next", sub_topic_data)
        if (sub_topic_data.model && sub_topic_data.model.submodels.length > 0)
            render_hex_map_sublevel(d3.select(this), k, sub_topic_data.model.submodels[i], depth + 1, transition);
    }

    var hex_coordinates = [];
    for (var i = 0; i < 6; i++) {
        var a = (i + 0) / 6 * Math.PI * 2;
        hex_coordinates.push({
            x: Math.cos(a) * hex_r * render_info.hexagon_scale + super_hex.datum().x,
            y: Math.sin(a) * hex_r * render_info.hexagon_scale + super_hex.datum().y,
            id: super_hex.datum().topicId + "-" + i
        })
    }
    hex_coordinates.push({
        x: super_hex.datum().x,
        y: super_hex.datum().y,
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
        .delay(300)
        .style("opacity", "1");

    hexagons.exit()
        .transition(100)
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
        var k2 = k;
        if (transition) {
            k2 = k.transition().ease(d3.easeLinear)
                .delay(300);
        } else {

        }
        //.transition()
        //.ease(d3.easeLinear)
        k2.style("opacity", 1)
            .attr("points", function (d) {
                return hexagon_points(d.x, d.y, 1 * render_info.hexagon_scale)
            })
            .style("fill", "rgba(255,255,255,0.2)")
            .style("stroke", "black")
            .style("stroke-width", 1)
            .style("opacity", function () {
                if (1 * render_info.hexagon_scale * render_info.zoom_scale >= 3 * render_info.min_hex_r) {
                    return 0;
                }
                return 1
            })
        //.log(k)
        //console.log("render top , then nex", i)

        render_hex_map_sublevel(d3.select(this), k, render_info.hexmap_data["hexmapData"][i], 1, transition)

    }

    var g = polygons.enter()
        .append("g")
        .attr("class", "hex-0")

    g.append("polygon")
        .attr("class", "hex-0")

    g.each(render_hex);

    polygons.exit()
        .each(function () {
            d3.select(this).remove();
        })

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


function render(container_id, hex_data_url, topic_data_url) {
    var svg = d3.select(container_id).append("svg");
    svg.style("height", "100%")
        .style("width", "100%")
        .attr("id", "hex_svg");
    //svg dragging
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
                //console.log(render_info.view);
                var scale = render_info.zoom_scale;
                render_info.view.x = render_info.view.drag_pos.x + dx / scale;
                render_info.view.y = render_info.view.drag_pos.y + dy / scale;

                render_hexmap_toplevel(svg);
            }
        })

    bind_mousewheel("hex_svg", function (delta) {
        render_info.zoom_power = Math.max(delta * 0.25 + render_info.zoom_power, 1);
        render_info.zoom_scale = Math.pow(2, render_info.zoom_power - 1)
        //console.log(delta, render_info.zoom_scale)
        render_hexmap_toplevel(svg, null, true);
    })


    d3.json(hex_data_url, function (data) {
        console.log("hex data loaded")
        render_hexmap_toplevel(svg, data)
        data_prepare(svg);
    })

    d3.json(topic_data_url, function (data) {
        console.log("topic model data loaded")
        render_info.topic_data = data;
        data_prepare(svg);
    })
}

