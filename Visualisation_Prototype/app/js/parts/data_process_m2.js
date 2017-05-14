/**
 * Created by Devid on 06/05/2017.
 */

function add_data_process_m2(_this) {

    _this.set_data_directory = function (dirs) {
        _this.data_dir = dirs;
        return _this;
    };
    _this.data_count = -1;
    _this.load_topic_model = function (filename_list, callback) {
        _this.topic_data = [];

        for (var i = 0; i < filename_list.length; i++) {
            (function (i) {
                var filename = filename_list[i];
                d3.json(_this.data_dir[i] + filename, function (data) {
                    _this.topic_data[i] = d3.hierarchy(data, function (d) {
                        return d.submodels;
                    });
                    //console.log("topic data loaded", data);
                    _this.prepare_data(); //try prepare data
                    if (callback) callback(_this);
                });
            })(i);
        }

        return _this;

    };

    _this.load_hexmap_data = function (filename_list, callback) {

        _this.data_count = filename_list.length;
        _this.hexmap_data = [];
        for (var i = 0; i < filename_list.length; i++) {
            (function (i) {
                var filename = filename_list[i];
                d3.json(_this.data_dir[i] + filename, function (data) {
                    _this.hexmap_data[i] = data;
                    //console.log("hexmap data loaded", data)
                    _this.prepare_data(); //try prepare data
                    if (callback) callback(_this);
                });
            })(i);
        }

        return _this;
    };


    _this.load_compare_data = function (filename_list, callback) {

        _this.data_count = filename_list.length;
        _this.compare_data = [];
        for (var i = 0; i < filename_list.length; i++) {
            (function (i) {
                var filename = filename_list[i];
                d3.json(_this.data_dir[i] + filename, function (data) {
                    _this.compare_data[i] = data;
                    console.log("compare data loaded", data)
                    if (callback) callback(_this);
                });
            })(i);
        }

        return _this;
    };

    _this.topic_value_maximums = [];
    _this.linearTopicMaxValue = function (topic_data) {
        //console.log("node.data.topicClassesDistrib=", node.data.topicClassesDistrib)
        for (var l = 0; l < topic_data.length; l++) {
            var level_data = topic_data[l].data;
            //console.log("leveldata=", level_data)
            for (var i in level_data.topicClassesDistrib) {
                var d = level_data.topicClassesDistrib[i];
                var sum = 0;
                //console.log(i)
                for (var ci = 0; ci < d.length; ci++) {
                    //console.log("d[ci].classID=", d[ci].classID, d[ci].weightedValueSum, ci)
                    sum += d[ci].weightedValueSum * (_this.view.pie_selected(d[ci].classID) ? 1 : 0);
                }
                //.log(sum, depth)
                if (!_this.topic_value_maximums[l] || sum > _this.topic_value_maximums[l]) {
                    _this.topic_value_maximums[l] = sum;

                }
            }
        }
       // console.log(_this.topic_value_maximums)


    }
    _this.boundary_box = null;

    _this.calculate_boundary_box = function () {
        var l = Math.floor(_this.get_zoom_depth())
        if (l > _this.topic_data.length - 1) l = _this.topic_data.length - 1;
        var scale = Math.pow(1 / 3, l)

        var boundary_box = {
            min_x: 9999,
            min_y: 9999,
            max_x: -9999,
            max_y: -9999
        };
        var topic_data = _this.topic_data[l];
        var topic_count = 0;
        for (var key in topic_data.data.topics) {
            //console.log(key);
            topic_count++;
        }
        for (var i = 0; i < topic_count; i++) {
            var d = topic_data.data.hexagons[i];
            //console.log(topic_count,"hex:", d, i)
            if (d.absolute_x > boundary_box.max_x) boundary_box.max_x = d.absolute_x;
            if (d.absolute_y > boundary_box.max_y) boundary_box.max_y = d.absolute_y;
            if (d.absolute_x < boundary_box.min_x) boundary_box.min_x = d.absolute_x;
            if (d.absolute_y < boundary_box.min_y) boundary_box.min_y = d.absolute_y;
        }
        boundary_box.min_x *= scale;
        boundary_box.min_y *= scale;
        boundary_box.max_x *= scale;
        boundary_box.max_y *= scale;

        //console.log(JSON.stringify(boundary_box))

        _this.boundary_box = boundary_box;
    }

    _this.prepare_data = function () {

        //function to find cluster neighbour and borders for top level


        function determineRr(hexagons) {
            //Determines hexagon radius 'r' from min distance of neighbours
            //Find distance between immediate neighbours
            var d2 = 0, dMin2 = 100000000000000000000000000000;
            for (var n = 0; n < hexagons.length; n++) {
                for (var m = n + 1; m < hexagons.length; m++) {
                    var dx = hexagons[n].x - hexagons[m].x;
                    var dy = hexagons[n].y - hexagons[m].y;

                    d2 = dx * dx + dy * dy;
                    if (d2 < dMin2) dMin2 = d2;
                }
            }
            return Math.sqrt(dMin2) / 2;
        }

        function addImmediateNeighboursAndBorders(hexagons) {
            //Function that finds list of immediate hexagon neighbours
            var r = determineRr(hexagons);

            var dMin2 = r * r * 4; //squarded distance between immediate neighbours

            function addNeighbour(relativePosition, n, i, dx, dy) {
                if (hexagons[n].cluster_id !== hexagons[m].cluster_id) {
                    hexagons[n].borders.push(i);

                }

                hexagons[n].neighbours[i] = {};
                hexagons[n].neighbours[i].type = relativePosition;
                hexagons[n].neighbours[i].topic_id = hexagons[m].topic_id;
                hexagons[n].neighbours[i].dx = dx;
                hexagons[n].neighbours[i].dy = dy;
                hexagons[n].neighbours[i].d2 = d2;
                hexagons[n].neighbours[i].sideNo = i;
            }

            for (var n = 0; n < hexagons.length; n++) {
                hexagons[n].neighbours = [];
                hexagons[n].borders = [];
                for (var m = 0; m < hexagons.length; m++) {
                    var dx = hexagons[m].x - hexagons[n].x;
                    var dy = hexagons[m].y - hexagons[n].y;
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
                    if (!hexagons[n].neighbours[i]) hexagons[n].borders.push(i);
                }
            }
        }

        function allDataLoaded() {
            if (_this.data_count < 0) return false;

            for (var i = 0; i < _this.data_count; i++) {
                if (!_this.hexmap_data[i] || !_this.topic_data[i]) {
                    return false;
                }
            }
            return true;
        }

        if (allDataLoaded()) {
            for (var lvl = 0; lvl < _this.topic_data.length; lvl++) {
                var topic_data = _this.topic_data[lvl];
                var hexmap_data = _this.hexmap_data[lvl];
                topic_data.level = lvl;
                topic_data.data.hexagons = [];

                var topic_count = 0;
                for (var key in topic_data.data.topics) {
                    //console.log(key);
                    topic_count++;
                }

                for (var i = 0; i < topic_count; i++) {
                    var hex_coor = hexmap_data["hexmapData"][i].hexAggloCoord;

                    var x = hex_coor.x * _this.config.hexagon_scale;
                    var y = hex_coor.y * _this.config.hexagon_scale;
                    topic_data.data.hexagons[i] = {
                        cluster_id: hexmap_data["hexmapData"][i].clusterAgglomerative,
                        topic_id: hexmap_data["hexmapData"][i].topicId,
                        x: x,
                        y: y,
                        absolute_x: x,
                        absolute_y: y,
                        pos: i
                    };
                    //update boundary box value

                    // if (_this.topic_data.children.length > 0)
                    //     set_all_position(_this.topic_data.children[i], _this.topic_data.data.hexagons[i]);
                }


                delete topic_data.data.submodels;
                addImmediateNeighboursAndBorders(topic_data.data.hexagons);


            }


            _this.linearTopicMaxValue(_this.topic_data);
            _this.calculate_boundary_box();
            if (_this.render_on_load) {
                _this.postload();

                // enter_render(_this.topic_data, _this.view_wrap);
                // update_render(_this.topic_data, _this.view_wrap);
                // enable_minimap();
                // enable_pie_selection();
            }
            //console.log("Data prepared", _this.topic_data)
        }
    };

}
/**
 * Created by Devid on 2017/5/10.
 */
