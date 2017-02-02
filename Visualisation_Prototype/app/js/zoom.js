/**
 * Created by Devid on 2017/1/25.
 */

//d3 v3 module, removed in v4, but useful in our app

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



//
function dummy_handler(e, callback){
    // cross-browser wheel delta
    var e = window.event || e; // old IE support
    var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));

    callback(delta);

}

function bind_mousewheel(dom_id, MouseWheelHandler){
    var dom=document.getElementById(dom_id);

    var dummy=function(e){
        dummy_handler(e, MouseWheelHandler);
    }

    if (dom.addEventListener) {
        // IE9, Chrome, Safari, Opera
        dom.addEventListener("mousewheel", dummy, false);
        // Firefox
        dom.addEventListener("DOMMouseScroll", dummy, false);
    }
// IE 6/7/8
    else dom.attachEvent("onmousewheel", dummy);
}
