/**
 * Created by Devid on 2017/5/11.
 */

function add_zooming_m1(_this){


    _this.enable_zooming = function () {
        _this.mousewheel_delta=0;
        bind_mousewheel("hex_svg", function (delta) {
            _this.mousewheel_delta += delta;
            //console.log(zoom_depth())
            setTimeout(function () {
                if (_this.mousewheel_delta > 3) _this.mousewheel_delta = 1;
                _this.view.zoom_power = Math.min(Math.max(_this.mousewheel_delta * 0.5 + _this.view.zoom_power, 1), 7);
                _this.view.zoom_scale = Math.pow(_this.view.zoom_base, _this.view.zoom_power - 1)
                _this.view.zoom_scale = Math.min(Math.max(_this.view.zoom_scale, 1), 27);
                _this.drag_graph(_this.view_wrap, true);
                _this.render()
                _this.mousewheel_delta=0;
            }, 1)
        })
        return _this;
    }


    _this.get_zooming_opacity = function (node_data) {
        if (_this.topic_data.length){
            if (_this.get_zoom_depth() !== node_data.level && node_data.level !== _this.config.max_depth) {
                return 0.05
            }
            return 1;
        }else{
            if (_this.get_zoom_depth() !== node_data.depth && node_data.depth !== _this.config.max_depth) {
                return 0.05
            }
            return 1;
        }
    }

    _this.get_zoom_depth = function () {
        var k = Math.log(_this.view.zoom_scale) / Math.log(_this.view.zoom_base);
        var result = Math.ceil((k + 1) / 2) - 1;
        //console.log(result);
        return result;
    };

    _this.zoom_to_depth = function (node_data, dx, dy) {
        var depth =node_data.depth;
        var dpower = (depth + 1) * 2 + 1;
        if (-dx == _this.view.x && -dy == _this.view.y || dpower < _this.view.zoom_power) {
            _this.view.zoom_power = (depth + 1) * 2 + 1;
            _this.view.zoom_power = Math.min(Math.max(_this.view.zoom_power, 1), 7);
            _this.view.zoom_scale = Math.pow(_this.view.zoom_base, _this.view.zoom_power - 1)
        }

        _this.view.x = -dx;
        _this.view.y = -dy;
        _this.drag_graph(_this.view_wrap, true);
        _this.render();
    };

}