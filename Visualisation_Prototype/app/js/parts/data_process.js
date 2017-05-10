/**
 * Created by Devid on 06/05/2017.
 */

function add_data_process(_this) {

    _this.set_data_directory = function (dir) {
        _this.data_dir = dir;
        return _this;
    };

    _this.load_topic_model = function (filename, callback) {
        d3.json(_this.data_dir + filename, function (data) {
            _this.topic_data = d3.hierarchy(data, function (d) {
                return d.submodels;
            });
            console.log("topic data loaded", data);
            _this.prepare_data(); //try prepare data
            if (callback) callback(_this);
        });
        return _this;
    };

    _this.load_hexmap_data = function (filename, callback) {
        d3.json(_this.data_dir + filename, function (data) {
            _this.hexmap_data = data;
            console.log("hexmap data loaded", data)
            _this.prepare_data(); //try prepare data
            if (callback) callback(_this);
        });
        return _this;
    };

    _this.topic_value_maximums = [];
    _this.linearTopicMaxValue = function (node, depth) {
        //console.log("node.data.topicClassesDistrib=", node.data.topicClassesDistrib)
        for (var i in node.data.topicClassesDistrib) {
            var d = node.data.topicClassesDistrib[i];
            var sum = 0;
            //console.log(i)
            for (var ci = 0; ci < d.length; ci++) {
                //console.log("d[ci].classID=", d[ci].classID, d[ci].weightedValueSum, ci)
                sum += d[ci].weightedValueSum * (_this.view.pie_selected(d[ci].classID) ? 1 : 0);
            }
            //.log(sum, depth)
            if (!_this.topic_value_maximums[depth] || sum > _this.topic_value_maximums[depth]) {
                _this.topic_value_maximums[depth] = sum;

            }
        }
        if (node.children)
            for (var i = 0; i < node.children.length; i++) {
                _this.linearTopicMaxValue(node.children[i], depth + 1);
            }
    }
    _this.boundary_box = null;
    _this.prepare_data = function () {

        //function to find cluster neighbour and borders for top level
        var boundary_box = {
            min_x: 9999,
            min_y: 9999,
            max_x: -9999,
            max_y: -9999
        };

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

        //function to set position recursively, initially
        function set_all_position(data, parent_coor) {
            data.data.hexagons = [];
            for (var i = 0; i < 6; i++) {
                var a = (i) / 6 * Math.PI * 2; //angle of this hex relative to parent center
                var x = _this.config.hexagon_scale * Math.cos(a) * (Math.sqrt(3) / 3);
                var y = _this.config.hexagon_scale * Math.sin(a) * (Math.sqrt(3) / 3);
                data.data.hexagons[i] = {
                    x: x,
                    y: y,
                    absolute_x: parent_coor.absolute_x + x * Math.pow(1 / 3, data.depth - 1),
                    absolute_y: parent_coor.absolute_y + y * Math.pow(1 / 3, data.depth - 1),
                    pos: i
                };

                //update boundary box
                var d = data.data.hexagons[i];
                if (d.absolute_x > boundary_box.max_x) boundary_box.max_x = d.absolute_x;
                if (d.absolute_y > boundary_box.max_y) boundary_box.max_y = d.absolute_y;
                if (d.absolute_x < boundary_box.min_x) boundary_box.min_x = d.absolute_x;
                if (d.absolute_y < boundary_box.min_y) boundary_box.min_y = d.absolute_y;


            }
            data.data.hexagons[6] = {
                x: 0,
                y: 0,
                absolute_x: parent_coor.absolute_x,
                absolute_y: parent_coor.absolute_y,
                pos: 6

            };
            //data.children[6].words = data.data.topics[6];
            //delete data.data.topics;

            delete data.data.submodels;

            if (data.children && data.children.length > 0) {
                for (var i = 0; i < data.children.length; i++) {
                    set_all_position(data.children[i], data.data.hexagons[i]);
                }

            }
            if (data.parent == null)
                data.is_root = true;
            else
                data.is_root = false;
            //delete data.parent;
        }

        //recursively get maximum value on each level


        if (_this.hexmap_data && _this.topic_data) {

            _this.topic_data.data.hexagons = [];
            if (!_this.topic_data.children) {
                _this.topic_data.children = [];
            }

            var topic_count = 0;
            for (var key in _this.topic_data.data.topics) {
                //console.log(key);
                topic_count++;
            }

            for (var i = 0; i < topic_count; i++) {
                var hex_coor = _this.hexmap_data["hexmapData"][i].hexAggloCoord;

                var x = hex_coor.x * _this.config.hexagon_scale;
                var y = hex_coor.y * _this.config.hexagon_scale;
                _this.topic_data.data.hexagons[i] = {
                    cluster_id: _this.hexmap_data["hexmapData"][i].clusterAgglomerative,
                    topic_id: _this.hexmap_data["hexmapData"][i].topicId,
                    x: x,
                    y: y,
                    absolute_x: x,
                    absolute_y: y,
                    pos: i
                };
                //update boundary box value
                var d = _this.topic_data.data.hexagons[i];
                //console.log("hex:", d)
                if (d.absolute_x > boundary_box.max_x) boundary_box.max_x = d.absolute_x;
                if (d.absolute_y > boundary_box.max_y) boundary_box.max_y = d.absolute_y;
                if (d.absolute_x < boundary_box.min_x) boundary_box.min_x = d.absolute_x;
                if (d.absolute_y < boundary_box.min_y) boundary_box.min_y = d.absolute_y;

                if (_this.topic_data.children.length > 0)
                    set_all_position(_this.topic_data.children[i], _this.topic_data.data.hexagons[i]);
            }
            delete _this.topic_data.data.submodels;
            addImmediateNeighboursAndBorders(_this.topic_data.data.hexagons);

            _this.linearTopicMaxValue(_this.topic_data, 0);
            _this.boundary_box = boundary_box;
            if (_this.render_on_load) {
                _this.postload();

                // enter_render(_this.topic_data, _this.view_wrap);
                // update_render(_this.topic_data, _this.view_wrap);
                // enable_minimap();
                // enable_pie_selection();
            }
            console.log("Data prepared", _this.topic_data)
        }


    };

}