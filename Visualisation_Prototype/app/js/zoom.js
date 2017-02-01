/**
 * Created by Devid on 2017/1/25.
 */

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
