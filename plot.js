function $(s){return document.getElementById(s);}
const device_pixel_ratio = window.devicePixelRatio;

class Coords{
    constructor(x, y=null){
        if(y===null){
            if(x.x===undefined){
                this.x = x.r;
                this.y = x.i;
            } else {
                this.x = x.x;
                this.y = x.y;
            }
        } else {
            this.x = x;
            this.y = y;
        }
    }
    get r(){return this.x;}
    set r(r){return this.x = r;}
    get i(){return this.y;}
    set i(i){return this.y = i;}
    *[Symbol.iterator](){
        yield this.x;
        yield this.y;
    }
    add(a, b){
        return new Coords(a.x+b.x, a.y+b.y);
    }
    subtract(b){
        return new Coords(this.x-b.x, this.y-b.y);
    }
    multiply(b){
        return new Coords(this.x*b, this.y*b);
    }
    divide(b){
        return new Coords(this.x/b, this.y/b);
    }
}

function floatToString(x){
    x = x.toPrecision(5);
    if(x.search('\\.')<0){
        return x;
    }
    var trunc;
    var exponent = x.search('[eE]');
    if(exponent<0){
        trunc = x.length-1
        while(x[trunc]==='0'){
            trunc--;
        }
        if(x[trunc]==='.'){
            trunc--;
        }
        return x.slice(0, trunc+1);
    }
    trunc = exponent-1;
    while(x[trunc]==='0'){
        trunc--;
    }
    if(x[trunc]==='.'){
        trunc--;
    }
    return x.slice(0, trunc+1)+x.slice(exponent);
}

function getColorIndicesForCoord(x, y, width) {
    var red = y * (width * 4) + x * 4;
    return [red, red + 1, red + 2, red + 3];
}

var mapping = (x) => x;

var zbd, wbd;
function update_bounds(){
    zbd = {top:parseFloat($('maxy').value), left:parseFloat($('minx').value), right:parseFloat($('maxx').value), bottom:parseFloat($('miny').value)};
    wbd = {top:parseFloat($('maxv').value), left:parseFloat($('minu').value), right:parseFloat($('maxu').value), bottom:parseFloat($('minv').value)};
}

var zgraph = $('zgraph');
var zgraph_canvas = zgraph.getContext('2d')//,{ alpha: true });
var wgraph = $('wgraph');
var wgraph_canvas = wgraph.getContext('2d')//,{ alpha: true });

var zgraph_off = document.createElement('canvas');
var zgraph_canvas_off = zgraph_off.getContext('2d');
var wgraph_off = document.createElement('canvas');
var wgraph_canvas_off = wgraph_off.getContext('2d');

function set_draw_settings(setting,value){
    zgraph_canvas[setting] = (wgraph_canvas[setting] = value);
}

function store_graph_images(){
    zgraph_canvas_off.drawImage(zgraph,0,0);
    wgraph_canvas_off.drawImage(wgraph,0,0);
}

function load_graph_images(){
    set_draw_settings('fillStyle','#ffffff')
    zgraph_canvas.fillRect(0, 0, zgraph.width, zgraph.height);
    wgraph_canvas.fillRect(0, 0, wgraph.width, wgraph.height);
    zgraph_canvas.drawImage(zgraph_off,0,0);
    wgraph_canvas.drawImage(wgraph_off,0,0);
}

var all_strokes = []
var stroke = {}

function resize_graphs(redraw = true){
    update_bounds();
    zgraph_off.width  = zgraph.width  = device_pixel_ratio*parseInt(getComputedStyle(zgraph).getPropertyValue('width'));
    zgraph_off.height = zgraph.height = device_pixel_ratio*parseInt(getComputedStyle(zgraph).getPropertyValue('height'));

    wgraph_off.width  = wgraph.width  = device_pixel_ratio*parseInt(getComputedStyle(wgraph).getPropertyValue('width'));
    wgraph_off.height = wgraph.height = device_pixel_ratio*parseInt(getComputedStyle(wgraph).getPropertyValue('height'));
    if(redraw){redraw_graphs();}
}

function clear_graphs(){
    all_strokes = [];
    redraw_graphs();
}

function canvas_to_graph_coords(coords, canvas, bounds){
    return new Coords((coords.x/canvas.width)*(bounds.right-bounds.left)+bounds.left,
                      bounds.top-(coords.y/canvas.height)*(bounds.top-bounds.bottom));
}

function graph_to_canvas_coords(coords, canvas, bounds){
    return new Coords(parseInt(canvas.width*(coords.x-bounds.left)/(bounds.right-bounds.left)),
                      parseInt(canvas.height*(bounds.top-coords.y)/(bounds.top-bounds.bottom)));
}
function map_mouse_to_zgraph(mouse){
    return canvas_to_graph_coords(mouse, zgraph, zbd);
}
function map_mouse_to_wgraph(mouse){
    return graph_to_canvas_coords(mapping(canvas_to_graph_coords(mouse, zgraph, zbd)), wgraph, wbd);
}

function draw_axes(){
    var maxx = parseFloat($('maxx').value);  var minx = parseFloat($('minx').value);
    var maxy = parseFloat($('maxy').value);  var miny = parseFloat($('miny').value);
    var maxu = parseFloat($('maxu').value);  var minu = parseFloat($('minu').value);
    var maxv = parseFloat($('maxv').value);  var minv = parseFloat($('minv').value);

    var dim = [maxx-minx, maxy-miny,
               maxu-minu, maxv-minv];

    function scale_properly(x){
        x = Math.log10(x)
        const mod = ((x%1)+1)%1;
        var scale;
        if(mod < 1.0/6){
            scale = 1;
            if(mod == 0){
                x++;
            }
        }
        else if(mod > 5.0/6){
            x++;
            scale = 1;
        }
        else if(mod < 3.0/6){
            scale = 2;
        }
        else{
            scale = 5;
        }
        return scale*Math.pow(10, Math.ceil(x-2));
    }

    for(let i = 0; i<4; i++){
        dim[i] = scale_properly(dim[i]);
    }

    tick_center = [(maxx+minx)/2, (maxy+miny)/2,
                   (maxu+minu)/2, (maxv+minv)/2];

    for(let i = 0; i<4; i++){
        tick_center[i] = Math.round(tick_center[i]/dim[i])*dim[i];
    }

    var minmax = (min, val, max) => Math.min(Math.max(min, val), max);
    var origin_z = graph_to_canvas_coords(new Coords(0, 0), zgraph, zbd);
    var origin_w = graph_to_canvas_coords(new Coords(0, 0), wgraph, wbd);

    zgraph_canvas.beginPath();                      wgraph_canvas.beginPath();
    zgraph_canvas.moveTo(0,origin_z.y);             wgraph_canvas.moveTo(0,origin_w.y);
    zgraph_canvas.lineTo(zgraph.width,origin_z.y);  wgraph_canvas.lineTo(wgraph.width,origin_w.y);
    zgraph_canvas.moveTo(origin_z.x,0);             wgraph_canvas.moveTo(origin_w.x,0);
    zgraph_canvas.lineTo(origin_z.x,zgraph.height); wgraph_canvas.lineTo(origin_w.x,wgraph.height);
    zgraph_canvas.stroke();                         wgraph_canvas.stroke();

    origin_z.x = minmax(0, origin_z.x, zgraph.width);
    origin_z.y = minmax(0, origin_z.y, zgraph.height);
    origin_w.x = minmax(0, origin_w.x, wgraph.width);
    origin_w.y = minmax(0, origin_w.y, wgraph.height);

    const h_text_offset = 14;
    const v_text_offset = 12;
    const tick_radius = 10;

    var text_pos_top_right = [true,true,true,true];
    if(origin_z.y < zgraph.height/3){
        text_pos_top_right[0] = false;
    }
    if(origin_z.x > 2*zgraph.width/3){
        text_pos_top_right[1] = false;
    }
    if(origin_w.y < wgraph.height/3){
        text_pos_top_right[2] = false;
    }
    if(origin_w.x > 2*wgraph.width/3){
        text_pos_top_right[3] = false;
    }


    set_draw_settings('font',(16*device_pixel_ratio)+"px Times New Roman");// Arial";
    zgraph_canvas.beginPath();       wgraph_canvas.beginPath();
    for(let i = -10; i<10; i++){
        var point = new Coords(tick_center[0]+i*dim[0],tick_center[1]+i*dim[1]);
        var coord = graph_to_canvas_coords(point,zgraph,zbd);
        if(coord.x>=0 && coord.x < zgraph.width){
            zgraph_canvas.textAlign = 'center';
            if(text_pos_top_right[0]){
                //y values are below
                zgraph_canvas.textBaseline = "bottom";
                zgraph_canvas.fillText(floatToString(point.x), coord.x, origin_z.y-v_text_offset);
            } else {
                zgraph_canvas.textBaseline = "top";
                zgraph_canvas.fillText(floatToString(point.x), coord.x, origin_z.y+v_text_offset);
            }
        }
        zgraph_canvas.moveTo(coord.x,origin_z.y-tick_radius);
        zgraph_canvas.lineTo(coord.x,origin_z.y+tick_radius);

        if(coord.y>=0 && coord.y < zgraph.height){
            zgraph_canvas.textBaseline = "middle";
            if(text_pos_top_right[1]){
                zgraph_canvas.textAlign = 'start';
                zgraph_canvas.fillText(floatToString(point.y), origin_z.x+h_text_offset, coord.y);
            } else {
                zgraph_canvas.textAlign = 'end';
                zgraph_canvas.fillText(floatToString(point.y), origin_z.x-h_text_offset, coord.y);
            }
        }
        zgraph_canvas.moveTo(origin_z.x-tick_radius,coord.y);
        zgraph_canvas.lineTo(origin_z.x+tick_radius,coord.y);


        point = new Coords(tick_center[2]+i*dim[2],tick_center[3]+i*dim[3]);
        coord = graph_to_canvas_coords(point,wgraph,wbd);
        if(coord.x>=0 && coord.x < wgraph.width){
            wgraph_canvas.textAlign = 'center';
            if(text_pos_top_right[2]){
                //y values are below
                wgraph_canvas.textBaseline = "bottom";
                wgraph_canvas.fillText(floatToString(point.x), coord.x, origin_w.y-v_text_offset);
            } else {
                wgraph_canvas.textBaseline = "top";
                wgraph_canvas.fillText(floatToString(point.x), coord.x, origin_w.y+v_text_offset);
            }
        }
        wgraph_canvas.moveTo(coord.x,origin_w.y-tick_radius);
        wgraph_canvas.lineTo(coord.x,origin_w.y+tick_radius);

        if(coord.y>=0 && coord.y < wgraph.height){
            wgraph_canvas.textBaseline = "middle";
            if(text_pos_top_right[3]){
                wgraph_canvas.textAlign = 'start';
                wgraph_canvas.fillText(floatToString(point.y), origin_w.x+h_text_offset, coord.y);
            } else {
                wgraph_canvas.textAlign = 'end';
                wgraph_canvas.fillText(floatToString(point.y), origin_w.x-h_text_offset, coord.y);
            }
        }
        wgraph_canvas.moveTo(origin_w.x-tick_radius,coord.y);
        wgraph_canvas.lineTo(origin_w.x+tick_radius,coord.y);
    }
    zgraph_canvas.stroke();       wgraph_canvas.stroke();

}

function toggleAxes(){
    if(toggleAxes.on){
        toggleAxes.on = false;
    }else{
        toggleAxes.on = true;
    }
    redraw_graphs();
}
toggleAxes.on = true;

function zoom_square(){
    var aspect = zgraph.width/zgraph.height;
    var range = parseFloat($('maxy').value)-parseFloat($('miny').value);
    var centerx = .5*parseFloat($('minx').value)+.5*parseFloat($('maxx').value);
    $('minx').value = centerx-range/2*aspect;
    $('maxx').value = centerx+range/2*aspect;

    aspect = wgraph.width/wgraph.height;
    range = parseFloat($('maxv').value)-parseFloat($('minv').value);
    centerx = .5*parseFloat($('minu').value)+.5*parseFloat($('maxu').value);
    $('minu').value = centerx-range/2*aspect;
    $('maxu').value = centerx+range/2*aspect;
    update_bounds();
    redraw_graphs();
}

function zoom(xmin_e, xmax_e, ymin_e, ymax_e, amount){
    $$ = function(e){return parseFloat(e.value)};
    var center = new Coords(($$(xmin_e) + $$(xmax_e))/2,($$(ymin_e) + $$(ymax_e))/2);
    var range = new Coords(amount*($$(xmax_e) - $$(xmin_e))/2, amount*($$(ymax_e) - $$(ymin_e))/2);
    xmin_e.value = center.x - range.x;
    xmax_e.value = center.x + range.x;
    ymin_e.value = center.y - range.y;
    ymax_e.value = center.y + range.y;
    update_bounds();
    redraw_graphs();
};

var previously_pointer = false;
function showcoordinates(e) {
    var mouse = new Coords(e.pageX - zgraph.offsetLeft, e.pageY - zgraph.offsetTop).multiply(device_pixel_ratio);

    var graph_mouse = map_mouse_to_zgraph(mouse);
    var graph_mapped_mouse = mapping(graph_mouse);
    $('debug').innerHTML="{"+graph_mouse.x.toPrecision(5)+","+graph_mouse.y.toPrecision(5)+"} maps to {"+graph_mapped_mouse.x.toPrecision(5)+","+graph_mapped_mouse.y.toPrecision(5)+"}"+previously_pointer;

    if($('drawmode').value === 'pointer'){
        if(!previously_pointer){
            store_graph_images();
            previously_pointer = true;
        } else {
            load_graph_images();
        }
        drawPointer(mouse);
        previously_pointer = true;
    } else if(previously_pointer){
        load_graph_images();
        previously_pointer = false
    }
}
zgraph.addEventListener('mousemove', showcoordinates, false);
zgraph.addEventListener('touchmove', function(e){showcoordinates(e.touches[0]); e.preventDefault();}, false);

function start_draw(e){
    var mode = $('drawmode').value;
    if(mode === 'pointer'){
        return;
    }
    load_graph_images();
    var mouse = new Coords(e.pageX - zgraph.offsetLeft, e.pageY - zgraph.offsetTop).multiply(device_pixel_ratio);
    //add a new stroke
    var color = $('color_select').value;
    set_draw_settings('strokeStyle', color);
    if(mode !== 'pointer'){
        popped_strokes = []; //clear undone strokes
    }
    if(mode === 'freedraw'){
        all_strokes.push({color:color,
                          path:[canvas_to_graph_coords(mouse, zgraph, zbd)],
                          mode:mode});
        zgraph_canvas.beginPath();
        zgraph_canvas.moveTo(...mouse);

        wgraph_canvas.beginPath();
        var start = map_mouse_to_wgraph(mouse);
        wgraph_canvas.moveTo(...start);
    } else if(mode === 'line'){
        all_strokes.push({color:color,
                          start:canvas_to_graph_coords(mouse, zgraph, zbd),
                          end:canvas_to_graph_coords(mouse, zgraph, zbd),
                          mode:mode});
    } else if(mode === 'circle'){
        all_strokes.push({color:color,
                          center:canvas_to_graph_coords(mouse, zgraph, zbd),
                          radius:0,
                          mode:mode});
    }
};

function moveToCoords(coords){
    zgraph_canvas.moveTo(...graph_to_canvas_coords(coords, zgraph, zbd));
    wgraph_canvas.moveTo(...graph_to_canvas_coords(mapping(coords), wgraph, wbd));
}
function lineToCoords(coords){
    zgraph_canvas.lineTo(...graph_to_canvas_coords(coords, zgraph, zbd));
    wgraph_canvas.lineTo(...graph_to_canvas_coords(mapping(coords), wgraph, wbd));
}

function drawFree(stroke){
    set_draw_settings('strokeStyle', stroke.color);
    zgraph_canvas.beginPath();  wgraph_canvas.beginPath();
    moveToCoords(stroke.path[0]);
    for(var j=1; j < stroke.path.length; j++){
        lineToCoords(stroke.path[j]);
    }
    zgraph_canvas.stroke();     wgraph_canvas.stroke();
}

function drawLine(stroke){
    set_draw_settings('strokeStyle', stroke.color);
    zgraph_canvas.beginPath();  wgraph_canvas.beginPath();
    const num_segments = 1000;
    var dz = new Coords((stroke.end.x-stroke.start.x)/num_segments,
              (stroke.end.y-stroke.start.y)/num_segments);
    moveToCoords(stroke.start);
    for(var j=1; j <= num_segments; j++){
        lineToCoords(new Coords(stroke.start.x + j*dz.x,
                      stroke.start.y + j*dz.y));
    }
    zgraph_canvas.stroke();     wgraph_canvas.stroke();
}

function drawCircle(stroke){
    set_draw_settings('strokeStyle', stroke.color);
    zgraph_canvas.beginPath();  wgraph_canvas.beginPath();
    const num_segments = 1000;
    moveToCoords({x:stroke.center.x+stroke.radius,
                  y:stroke.center.y});
    for(var j=1; j <= num_segments; j++){
        lineToCoords(new Coords(stroke.center.x + Math.cos(j*2*Math.PI/num_segments)*stroke.radius,
                                stroke.center.y + Math.sin(j*2*Math.PI/num_segments)*stroke.radius));
    }
    zgraph_canvas.stroke();     wgraph_canvas.stroke();
}

function drawPointer(mouse){
    set_draw_settings('strokeStyle', $('color_select').value);
    zgraph_canvas.beginPath();
    zgraph_canvas.arc(...mouse, 2, 0, 2*Math.PI);
    zgraph_canvas.arc(...mouse, 5, 0, 2*Math.PI);
    zgraph_canvas.arc(...mouse, 10, 0, 2*Math.PI);
    zgraph_canvas.stroke();

    var coords = map_mouse_to_wgraph(mouse);
    wgraph_canvas.beginPath();
    wgraph_canvas.arc(...coords, 2, 0, 2*Math.PI);
    wgraph_canvas.arc(...coords, 5, 0, 2*Math.PI);
    wgraph_canvas.arc(...coords, 10, 0, 2*Math.PI);
    wgraph_canvas.stroke()
}

function onPaint(e) {
    if($('drawmode').value === 'pointer'){
        return;
    }
    var mouse = new Coords(e.pageX - zgraph.offsetLeft, e.pageY - zgraph.offsetTop).multiply(device_pixel_ratio);
    var mode = all_strokes[all_strokes.length-1].mode;
    if(mode === 'freedraw'){
        all_strokes[all_strokes.length-1].path.push(canvas_to_graph_coords(mouse, zgraph, zbd))
        zgraph_canvas.lineTo(mouse.x, mouse.y);
        zgraph_canvas.stroke();
        var coords = map_mouse_to_wgraph(mouse);
        wgraph_canvas.lineTo(coords.x, coords.y);
        wgraph_canvas.stroke();
    } else if(mode === 'line'){
        load_graph_images();
        all_strokes[all_strokes.length-1].end = canvas_to_graph_coords(mouse, zgraph, zbd);
        drawLine(all_strokes[all_strokes.length-1]);
    } else if(mode === 'circle'){
        load_graph_images();
        let diff = canvas_to_graph_coords(mouse,zgraph,zbd).subtract(all_strokes[all_strokes.length-1].center);
        all_strokes[all_strokes.length-1].radius = Math.sqrt(diff.x*diff.x + diff.y*diff.y);
        drawCircle(all_strokes[all_strokes.length-1]);
    }
}
function redraw_graphs(){
    set_draw_settings('fillStyle','#ffffff')
    zgraph_canvas.fillRect(0, 0, zgraph.width, zgraph.height);
    wgraph_canvas.fillRect(0, 0, wgraph.width, wgraph.height);
    zgraph_canvas_off.fillRect(0, 0, zgraph.width, zgraph.height);
    wgraph_canvas_off.fillRect(0, 0, wgraph.width, wgraph.height);

    set_draw_settings('fillStyle','#000000')

    set_draw_settings('strokeCap', 'round');
    set_draw_settings('strokeStyle', '#000000');
    set_draw_settings('lineWidth', 4);
    if(toggleAxes.on){
        draw_axes();
    }
    set_draw_settings('lineWidth', 2);

    zbd = zbd; wbd = wbd;

    var i;
    var coords;
    for(i=0; i < all_strokes.length; i++){
        if(all_strokes[i].mode === 'freedraw'){
            drawFree(all_strokes[i]);
        } else if (all_strokes[i].mode === 'line'){
            drawLine(all_strokes[i]);
        } else if (all_strokes[i].mode === 'circle'){
            drawCircle(all_strokes[i]);
        }
    }
    store_graph_images();
};

function check_function(){
    var expression = complex_expression($("function_input").value);
    if(expression === null){
        $("function_status").style="color:red;";
        $("function_status").innerHTML='Equation Parsed: &#10007';
    }
    else{
        $("function_status").style="color:green;";
        $("function_status").innerHTML='Equation Parsed: &#10004';
        mapping = ((x) => new Coords(expression.fn(x)));
        redraw_graphs();
    };
}

var popped_strokes = [];
function KeyPress(e) {
    var e = window.event ? window.event : e
    if ((e.code === "KeyZ") && e.ctrlKey){
        if (all_strokes.length>0){
            popped_strokes.push(all_strokes.pop());
            redraw_graphs();
        }
        e.preventDefault();
    }
    else if((e.code === "KeyY") && e.ctrlKey){
        if (popped_strokes.length>0){
            all_strokes.push(popped_strokes.pop());
            redraw_graphs();
        }
        e.preventDefault();
    }
};

window.addEventListener('keydown', KeyPress);
window.addEventListener('resize', resize_graphs);
onchange="myFunction()"
for(i of document.getElementsByClassName('bound')){
    i.addEventListener('change',function(e){
        update_bounds();
        redraw_graphs();
    });
}



$('clear_graphs').addEventListener('click', clear_graphs);
$('zoom_square').addEventListener('click', zoom_square);
$('toggle_axes').addEventListener('click', toggleAxes);


$('zoom_z_in').addEventListener('click', function(e){zoom($('minx'),$('maxx'),$('miny'),$('maxy'), 0.9)});
$('zoom_w_in').addEventListener('click', function(e){zoom($('minu'),$('maxu'),$('minv'),$('maxv'), 0.9)});
$('zoom_z_out').addEventListener('click', function(e){zoom($('minx'),$('maxx'),$('miny'),$('maxy'), 1.1)});
$('zoom_w_out').addEventListener('click', function(e){zoom($('minu'),$('maxu'),$('minv'),$('maxv'), 1.1)});



function mousedown(e){
    start_draw(e);
    zgraph.addEventListener('mousemove', onPaint, false);
}

function touchpaint(e){
    onPaint(e.touches[0]);
    e.preventDefault();
}

function touchstart(e){
    start_draw(e.touches[0]);
    zgraph.addEventListener('touchmove', touchpaint, false);
}
zgraph.addEventListener('mousedown', mousedown, false);
zgraph.addEventListener('touchstart', touchstart, false);

function mouseup(e){
    zgraph.removeEventListener('mousemove', onPaint, false);
    if($('drawmode').value !== 'pointer'){
        redraw_graphs();
    } else {
        load_graph_images();
    }
}

function touchend(e){
    zgraph.removeEventListener('touchmove', touchpaint, false);
    if($('drawmode').value !== 'pointer'){
        redraw_graphs();
    } else {
        load_graph_images();
    }
}


zgraph.addEventListener('mouseup', mouseup, false);

zgraph.addEventListener('touchend', touchend, false);

$("function_confirm").addEventListener("click", check_function);

resize_graphs();
zoom_square();