/**
 * Created by Devid on 2017/1/25.
 */

// Method is assumed to be a standard D3 getter-setter:
// If passed with no arguments, gets the value.
// If passed with arguments, sets the value and returns the target.
function d3_rebind(target, source, method) {
    return function () {
        var value = method.apply(source, arguments);
        return value === source ? target : value;
    };
}
d3.rebind = function (target, source) {
    var i = 1, n = arguments.length, method;
    while (++i < n) target[method = arguments[i]] = d3_rebind(target, source, source[method]);
    return target;
};


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
    },
    colors: {
        background: "rgba(255,255,255,1)",
        border: "rgba(155,155,200, 0.3)",
        cluster_border: "rgba(155,155,188,0.8)"
    }
}

function clickcancel() {
    //cancel click event if double click, or if dragged
    var event = d3.dispatch('click', 'dblclick');

    function cc(selection) {
        var down,
            tolerance = 5,
            last,
            wait = null;
        // euclidean distance
        function dist(a, b) {
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
                    console.log(event)
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
        //console.log(hexmap_data[i])

        d.borders = hexmap_data[i].borders;
        //console.log("hex ,", i, hexmap_data[i]);
        d.model = hexmap_data[i].model
        d.x = (coor.x * render_info.hexagon_scale) //* render_info.zoom_scale;
        d.y = (coor.y * render_info.hexagon_scale) //* render_info.zoom_scale;
        d.stage_x = (coor.x * render_info.hexagon_scale + render_info.view.x) * render_info.zoom_scale + offsetx;
        d.stage_y = (coor.y * render_info.hexagon_scale + render_info.view.y) * render_info.zoom_scale + offsety;
        d.absolute_x = d.x;
        d.absolute_y = d.y;
        d.neighbours = hexmap_data[i].neighbours;
        d.topicClassesDistrib = hexmap_data[i].topicClassesDistrib;
        //delete d.hexAggloCoord;
        // console.log(d.x, d.y)
        res.push(d);
    }
    return res;
}


function filter_invisible_data(hexmap_data, hex_r) {

    var res = [];

    var o = render_info.zoom_scale * 4 * hex_r;
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

function get_value_range(model) {

    var get_sum = function (d) {
        var res;
        if (d.topicClassesDistrib)
            res = d.topicClassesDistrib[0].weightedValueSum + d.topicClassesDistrib[1].weightedValueSum;
        else {
            res = d[0].weightedValueSum + d[1].weightedValueSum;
        }
        //console.log("res", res)
        return res;
    }
    var arr = []

    for (key in model) {
        arr.push(get_sum(model[key]));
    }

    //console.log("getsum", arr)
    return {
        min: Math.min.apply(Math, arr),
        max: Math.max.apply(Math, arr),
    }
}

function draw_pie_in_group(group, pie_data, sibling_models) {
    // require [{name: eu, val: num, proj: num},...]
    var colors = {EU: "#5B5EA6", UK: "#D65076"};

    var sum = pie_data[0].weightedValueSum + pie_data[1].weightedValueSum;

    var pie = d3.pie()
        .value(function (d) {
            return d.weightSum;
        })(pie_data)
    var range = get_value_range(sibling_models);

    var min_radius_percentage = 1 / 5;

    var radius = render_info.hexagon_scale * Math.sqrt(3) / 2;
    //console.log(radius, range)
    radius = radius * min_radius_percentage + radius * (1 - min_radius_percentage) * ((sum - range.min) / (range.max - range.min));

    //console.log("r2", radius)

    var arc = d3.arc()
        .outerRadius(radius)
        .innerRadius(0)

    var pie_g = group.selectAll(".arc")
        .data(pie)
        .enter()

    pie_g.insert("path", ":first-child")
        .attr("class", "arc")
        .attr("d", arc)
        .style("fill", function (d, i) {
            return colors[d.data.classID];
        })
        .style("opacity", "0.5")
}

function render_hex_map_sublevel(g, super_hex, sub_topic_data, depth, transition) {

    if (typeof sub_topic_data == "undefined") return;
    if (!super_hex) return;
    if (depth >= 5) return;
    var sub_hex_r = Math.pow(1 / 3, depth);
    //console.log("cx cy ", cx, cy);
    // console.log("render sub model," ,sub_topic_data);

    function enter_hex(d, i) {
        d3.select(this)
            .style("transform", function () {
                return "translate(" + d.x + "px," + d.y + "px) "
                    + "scale(" + 1 / 3 + "," + 1 / 3 + ")";
            })

        var group_self = d3.select(this)
            .append("g")
            .attr("class", "group-" + depth + "-self");

        group_self.append("polygon")
            .attr("class", "hex-" + depth)
            .attr("points", function (d) {
                return hexagon_points(0, 0, 1 * render_info.hexagon_scale)
            })
            .style("fill", render_info.colors.background)
            .style("stroke", render_info.colors.border)
            .style("stroke-width", 1)
            .style("opacity", 0)
            .transition()
            .style("opacity", 1)

        var pie_group = group_self.append("g")
            .attr("class", "pie")

        var text_group = group_self.append("g")
            .attr("class", "texts")


        var model = sub_topic_data.model ? sub_topic_data.model : sub_topic_data;
        // console.log("-- s m --", sub_topic_data, model,  model["topics"],  model["topics"][(d.topicId)], d.topicId)
        var visible_texts = model["topics"][i]
            .sort(function (a, b) {
                return b.weight - a.weight;
            })
            .slice(0, 3)

        var cc = clickcancel();
        group_self.call(cc);
        cc
            .on("dblclick", function () {
                console.log("click dpth = " + depth);
                zoom_to_depth(depth + 1, d.absolute_x, d.absolute_y);
            })
            .on("click", function () {
                console.log("su r", d, "subd", sub_topic_data)

            })


        //console.log("sub_topic_data", sub_topic_data, sub_topic_data.model);


        text_group.selectAll("text")
            .data(visible_texts)
            .enter()
            .append("text")
            .text(function (d) {
                return d.label + "," + d.weight;
            })
            .style("transform", function (d, i) {
                var new_i;
                var font_size = 24;
                if (i == 0) new_i = 0;
                if (i == 1) new_i = 1;
                if (i == 2) new_i = -1;
                return "translate(" + 0 + "," + (new_i) * font_size + "px)"
            })
            .style("font-size", function (d, i) {
                return i == 0 ? "18" : "14";
            })
            .style("font-weight", function (d, i) {
                return i == 0 ? "600" : "400";
            })
            .style("text-anchor", "middle")
    }


    function render_hex(d, i) {


        var shrink = (render_info.min_hex_r - 0.5) / render_info.min_hex_r;
        d3.select(this)
            .style("transform", function () {
                return "translate(" + d.x + "px," + d.y + "px) "
                    + "scale(" + 1 / 3 * shrink + "," + 1 / 3 * shrink + ")";
            })


        var fade_hide = function (selection) {
            var hide_func = function () {
                //console.log("su r",sub_hex_r * render_info.hexagon_scale * (render_info.zoom_scale))
                if (sub_hex_r * render_info.hexagon_scale * (render_info.zoom_scale) > 3 * render_info.min_hex_r) {
                    return 0;
                }
                return 1

            }
            selection
                .transition()
                .duration(500)
                .style("opacity", hide_func)

        }

        var group_self = d3.select(this).select("g.group-" + depth + "-self");
        //console.log("gs",i ,group_self, depth, d3.select(this).select("g").attr("class"))
        fade_hide(group_self.selectAll("polygon"))
        fade_hide(d3.select(this).select(".texts"))
        fade_hide(d3.select(this).select("g.pie"))


        var sub_hexs = d3.select(this).select("polygon.hex-" + depth);
        //console.log("render next", sub_topic_data)
        var model = sub_topic_data.model ? sub_topic_data.model : sub_topic_data;
        if (model)

            draw_pie_in_group(d3.select(this).select("g.pie"), model.topicClassesDistrib[i], model.topicClassesDistrib);


        if (sub_topic_data.model && sub_topic_data.model.submodels.length > 0) {
            render_hex_map_sublevel(d3.select(this), sub_hexs, sub_topic_data.model.submodels[i], depth + 1, transition);


        }
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
            id: super_hex.datum().topicId + "-" + i,

        })
    }
    hex_coordinates.push({
        x: 0,
        y: 0,
        stage_x: 0,
        stage_y: 0,
        absolute_x: super_hex.datum().absolute_x,
        absolute_y: super_hex.datum().absolute_y,
        id: super_hex.datum().topicId + "-" + 6,
    })
    //console.log(hex_coordinates)
    hex_coordinates = filter_invisible_data(hex_coordinates, sub_hex_r * render_info.hexagon_scale);

    var hexagons = g.selectAll("g.grouop-" + depth)
        .data(hex_coordinates, function (d) {
            return d.id;
        });


    var group_enter = hexagons.enter()
        .append("g")
        .attr("class", "grouop-" + depth)
        .style("opacity", 0)
        .each(enter_hex)

    group_enter
        .style("opacity", "0")
        .transition()
        .style("opacity", "1")
        .each(render_hex);

    hexagons.exit()
        .transition(500)
        .style("opacity", 0)
        .remove()

    hexagons.each(render_hex)
}

function render_hexmap_toplevel(svg, data, transition) {


    var hexmap_data = to_render_coordinate(render_info.hexmap_data["hexmapData"]);
    hexmap_data = filter_invisible_data(hexmap_data, 1 * render_info.hexagon_scale);


    var polygons = svg.selectAll("g.group-0")
        .data(hexmap_data, function (d) {
            return d.topicId;
        });

    function draw_boarders(group_self, borders) {
        //console.log("borders", borders)
        group_self.selectAll("path")
            .data(borders)
            .enter()
            .append("path")
            .attr("d", function (datum, i) {
                var rotate = datum - 1;
                var r = 1 * render_info.hexagon_scale;
                var rs1 = ((rotate - 1) ) / 6;
                var x1 = 0 + Math.cos(Math.PI * 2 * rs1 + Math.PI / 6) * r;
                var y1 = 0 + Math.sin(Math.PI * 2 * rs1 + Math.PI / 6) * r;
                var rs2 = (rotate) / 6;
                var x2 = 0 + Math.cos(Math.PI * 2 * rs2 + Math.PI / 6) * r;
                var y2 = 0 + Math.sin(Math.PI * 2 * rs2 + Math.PI / 6) * r;
                return "M" + x1 + " " + y1 + " L" + x2 + " " + y2;

            })
            .attr("stroke", render_info.colors.cluster_border)
            .attr("stroke-width", "3")
            .attr("stroke-linecap", "round")
            .style("z-index", 999)
    }

    function enter_hex(d, i) {
        var shrink = (render_info.min_hex_r - 1.5) / render_info.min_hex_r;
        d3.select(this)
            .style("transform", function () {
                return "translate(" + d.x + "px," + d.y + "px) "
                    + "scale(" + shrink + "," + shrink + ")"

            })

        var group_self = d3.select(this)
                .append("g")
                .attr("class", "group-0-self")
            ;

        group_self.append("polygon")
            .attr("class", "hex-0")
            .attr("points", function (d) {
                return hexagon_points(0, 0, 1 * render_info.hexagon_scale - 1)
            })
            .style("fill", render_info.colors.background)
            .style("stroke", render_info.colors.border)
            .style("stroke-width", 1)

        var pie_group = group_self.append("g")
            .attr("class", "pie")

        var text_group = group_self.append("g")
            .attr("class", "texts")

        //console.log(d)
        var visible_texts = d.words
            .sort(function (a, b) {
                return b.weight - a.weight;
            })
            .slice(0, 3)

        text_group.selectAll("text")
            .data(visible_texts)
            .enter()
            .append("text")
            .text(function (d) {
                return d.label + "," + d.weight;
            })
            .style("transform", function (d, i) {
                var new_i;
                var font_size = 22;
                if (i == 0) new_i = 0;
                if (i == 1) new_i = 1;
                if (i == 2) new_i = -1;
                return "translate(" + 0 + "," + (new_i) * font_size + "px)"
            })
            .style("font-size", function (d, i) {
                return i == 0 ? "18" : "14";
            })
            .style("font-weight", function (d, i) {
                return i == 0 ? "600" : "400";
            })
            .style("text-anchor", "middle")

        var cc = clickcancel();
        var dx = d.absolute_x;
        var dy = d.absolute_y;
        var data = d;
        group_self.call(cc);
        cc
            .on("dblclick", function (d) {
                console.log("click dpth = " + 0);
                if (render_info.zoom_power < 2) {
                    zoom_to_depth(0, dx, dy);
                } else {
                    zoom_to_depth(1, dx, dy);
                }
            })
            .on("click", function () {
                console.log(data);
            })
    }

    function render_hex(d, i) {
        var k = d3.select(this).select("polygon.hex-0");

        var hide_func = function () {
            //onsole.log("top su r", 1 * render_info.hexagon_scale * (render_info.zoom_scale))
            if (1 * render_info.hexagon_scale * (render_info.zoom_scale) > 3 * render_info.min_hex_r) {
                return 0.025;
            }
            return 1
        }

        var group_self = d3.select(this).select("g.group-0-self");

        if (d.topicClassesDistrib)
            draw_pie_in_group(d3.select(this).select("g.pie"), d.topicClassesDistrib, render_info.hexmap_data["hexmapData"]);

        var fade_hide = function (selection) {
            var hide_func = function () {
                //console.log("su r",sub_hex_r * render_info.hexagon_scale * (render_info.zoom_scale))
                if (1 * render_info.hexagon_scale * (render_info.zoom_scale) > 3 * render_info.min_hex_r) {
                    return 0;
                }
                return 1

            }
            selection
                .transition()
                .duration(500)
                .style("opacity", hide_func)
                .style("visibility", function () {
                    return hide_func() == 0 ? "hidden" : "visible";
                })
        }

        //console.log("gs",i ,group_self, depth, d3.select(this).select("g").attr("class"))
        fade_hide(group_self.selectAll("polygon"))
        fade_hide(d3.select(this).select(".texts"))
        fade_hide(d3.select(this).select("g.pie"))

        render_hex_map_sublevel(d3.select(this), k, d, 1, transition)
    }

    var group_enter = polygons.enter()
        .append("g")
        .attr("class", "group-0")

    group_enter.each(enter_hex);

    polygons.exit()
        .transition()
        .style("opacity", 0)
        .remove();

    polygons.each(render_hex)


    var border_group = polygons.enter()
        .append("g")
        .attr("class", "top-level-border")
        .style("transform", function (d) {
            return "translate(" + d.absolute_x + "px," + d.absolute_y + "px)"
        })

    border_group.each(function (d, i) {
        // console.log(d.borders)
        draw_boarders(d3.select(this), d.borders);
    })


}

function determineRr(hexmapData) {
    //Determines hexagon radius 'r' from min distance of neighbours
    var borders = [];

    //Find distance between immediate neighbours
    var d2 = 0, dMin2 = 100000000000000000000000000000;
    for (var n = 0; n < hexmapData.length; n++) {
        for (var m = n + 1; m < hexmapData.length; m++) {
            var dx = hexmapData[n].hexAggloCoord.x - hexmapData[m].hexAggloCoord.x;
            var dy = hexmapData[n].hexAggloCoord.y - hexmapData[m].hexAggloCoord.y;

            d2 = dx * dx + dy * dy;
            if (d2 < dMin2) dMin2 = d2;
        }
    }
    return Math.sqrt(dMin2) / 2;
}

function addImmediateNeighboursAndBorders(hexmap_data) {
    //Function that finds list of immediate hexagon neighbours
    var r = determineRr(hexmap_data);
    console.log(r)
    var dMin2 = r * r * 4; //squarded distance between immediate neighbours

    function addNeighbour(relativePosition, n, i, dx, dy) {
        if (hexmap_data[n].clusterAgglomerative !== hexmap_data[m].clusterAgglomerative) {
            hexmap_data[n].borders.push(i);

        }

        hexmap_data[n].neighbours[i] = {};
        hexmap_data[n].neighbours[i].type = relativePosition;
        hexmap_data[n].neighbours[i].topicId = hexmap_data[m].topicId;
        hexmap_data[n].neighbours[i].dx = dx;
        hexmap_data[n].neighbours[i].dy = dy;
        hexmap_data[n].neighbours[i].d2 = d2;
        hexmap_data[n].neighbours[i].sideNo = i;
    }

    for (var n = 0; n < hexmap_data.length; n++) {
        hexmap_data[n].neighbours = [];
        hexmap_data[n].borders = [];
        for (var m = 0; m < hexmap_data.length; m++) {
            var dx = hexmap_data[m].hexAggloCoord.x - hexmap_data[n].hexAggloCoord.x;
            var dy = hexmap_data[m].hexAggloCoord.y - hexmap_data[n].hexAggloCoord.y;
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
            if (!hexmap_data[n].neighbours[i]) hexmap_data[n].borders.push(i);
        }
    }
}


function data_prepare(svg) {
    if (!render_info.hexmap_data || !render_info.topic_data) return;

    for (var i = 0; i < render_info.hexmap_data["hexmapData"].length; i++) {
        var topic_i = render_info.hexmap_data["hexmapData"][i].topicId;
        var d = render_info.topic_data["submodels"][parseInt(topic_i)];
        var c = render_info.topic_data["topicClassesDistrib"][parseInt(topic_i)];
        //console.log(d)
        //console.log("d p,",i, parseInt(topic_i))
        render_info.hexmap_data["hexmapData"][i].model = d;
        render_info.hexmap_data["hexmapData"][i].topicClassesDistrib = c;
    }
    console.log("data prepared", render_info.hexmap_data, render_info.topic_data)

    render_hexmap_toplevel(svg);

    // console.log(render_info.hexmap_data)
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
            // console.log("mouseup")
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
        render_info.zoom_scale = Math.pow(render_info.zoom_base, render_info.zoom_power - 1 + 0.0001)

        render_info.zoom_scale = Math.min(Math.max(render_info.zoom_scale, 1), 27);
        //console.log(delta, render_info.zoom_scale, render_info.zoom_power)
        render_hexmap_toplevel(super_group, null, true);
        drag_graph(super_group, true);
    })


    d3.json(hex_data_url, function (data) {
        console.log("hex data loaded", data)
        //error("error")
        if (render_info.hexmap_data == null) {
            render_info.hexmap_data = data;
        }
        addImmediateNeighboursAndBorders(render_info.hexmap_data["hexmapData"]);
        data_prepare(super_group);
        render_hexmap_toplevel(super_group, data)
    })

    d3.json(topic_data_url, function (data) {
        console.log("topic model data loaded")
        render_info.topic_data = data;
        data_prepare(super_group);
        render_hexmap_toplevel(super_group, data)
    })
}

