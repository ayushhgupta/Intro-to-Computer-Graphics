var gl;
var canvas;

var sqbuf;
var sqindexBuf;
var sqnormalBuf;
var sqtexBuf;

var aPositionLocation;
var aTexCoordLocation;
var uBgTextureLocation;
var uFgTextureLocation;
var uModeLoc;
var uFiltLoc;
var uCBLoc;
var opsLoc;
var imgSizeLoc;

var bg_file;
var fg_file;
var bg_tex;
var fg_tex;

var blend_mode = -1; // -1 -> no img; 0 -> bg; 1 -> blended;
var filter_mode = 0; // 0 -> normal; 1 -> grayscale; 2 -> sepia; 
var contrastBrightness = [1.0, 0.0]; // contrast, brightness
var ops = [0, 0, 0, 0]; // 0 -> box blur; 1 -> sharpen 2 -> gradient; 3 -> laplacian

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
out vec2 fragTexCoords;

void main() {
	fragTexCoords = (aPosition.xy + 1.0) / 2.0 ;
	fragTexCoords.y = 1.0 - fragTexCoords.y;
  gl_Position = vec4(aPosition,1.0,1.0);
}`;

const fragShaderCode = `#version 300 es
precision highp float;

out vec4 fragColor;

in vec2 fragTexCoords;

uniform int imgMode;
uniform int filter_mode;
uniform vec2 contrastBrightness;
uniform vec4 ops;
uniform sampler2D bgTexture;
uniform sampler2D fgTexture;
uniform vec2 imageSize;

vec4 bg;
vec4 fg;
vec4 texCol;

vec4 grayscale(vec4 color) {
  float gray = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  return vec4(vec3(gray), 1.0);
}

vec4 sepia(vec4 color) {
  vec4 sepia;
  sepia.r = dot(color.rgb, vec3(0.393, 0.769, 0.189));
  sepia.g = dot(color.rgb, vec3(0.349, 0.686, 0.168));
  sepia.b = dot(color.rgb, vec3(0.272, 0.534, 0.131));
  return sepia;
}

vec4 adjustContrast(vec4 color, float contrast) {
  color.r = (color.r - 0.5) * contrast + 0.5;
  color.g = (color.g - 0.5) * contrast + 0.5;
  color.b = (color.b - 0.5) * contrast + 0.5;
  return color;
}

vec4 adjustBrightness(vec4 color, float brightness) {
  color.r = color.r + brightness;
  color.g = color.g + brightness;
  color.b = color.b + brightness;
  return color;
}

vec4 convolution(mat3 kernel) {
  vec4 color = vec4(0.0);
  vec2 onePixel = vec2(1.0) / imageSize;
  for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        vec4 sampleCol = texture(bgTexture, fragTexCoords + vec2(i, j) * 2.0 * onePixel);
        color += sampleCol * kernel[i + 1][j + 1];
      }
  }
  color.a = 1.0;
  return color;
}

void main() {
	fragColor = vec4(0,0,0,1);

  bg = texture(bgTexture, fragTexCoords);
  fg = texture(fgTexture, fragTexCoords);

  if(ops[0] == 1.0) {
    mat3 kernel = mat3(1, 1, 1, 1, 1, 1, 1, 1, 1) / 9.0;
    bg = convolution(kernel);
  }
  if(ops[1] == 1.0) {  
    mat3 kernel = mat3(0, -1, 0, -1, 5, -1, 0, -1, 0);
    bg = convolution(kernel);
  }
  if(ops[2] == 1.0) { 
    vec2 onePixel = 2.0 * vec2(1.0) / imageSize;
    vec4 up = texture(bgTexture, fragTexCoords + vec2(0.0, 1.0) * onePixel);
    vec4 down = texture(bgTexture, fragTexCoords + vec2(0.0, -1.0) * onePixel);
    vec4 right = texture(bgTexture, fragTexCoords + vec2(1.0, 0.0) * onePixel);
    vec4 left = texture(bgTexture, fragTexCoords + vec2(-1.0, 0.0) * onePixel);

    vec4 dy = (up - down) / 2.0;
    vec4 dx = (right - left) / 2.0;

    vec4 gradient = sqrt(dy * dy + dx * dx);
    gradient.a = 1.0;
    bg = gradient;
  }
  if(ops[3] == 1.0) { 
    mat3 kernel = mat3(0, -1, 0, -1, 4, -1, 0, -1, 0);
    bg = convolution(kernel);
  }
  
  texCol = vec4(0,0,0,1);

  if (imgMode == 0) {
    texCol = bg;
  } else if (imgMode == 1) {
    texCol = (bg * (1.0 - fg.a) + fg * fg.a);
  } else {
    fragColor = texCol;
    return;
  }

  if (filter_mode == 1) {
    texCol = grayscale(texCol);
  } else if (filter_mode == 2) {
    texCol = sepia(texCol);
  }

  texCol = adjustBrightness(texCol, contrastBrightness[1]);
  texCol = adjustContrast(texCol, contrastBrightness[0]);

  fragColor = vec4(texCol.rgb, 1.0);
}`;

function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders() {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function initTexture(file) {
	var tex = gl.createTexture();
	tex.image = new Image();
  tex.image.src = file;
	tex.image.onload = function () {
    console.log("Texture Loaded");
    handleLoadedTexture(tex);
	};
	return tex;
}

function handleLoadedTexture(texture) {
	gl.bindTexture(gl.TEXTURE_2D, texture);
	// gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // flip the image's y axis
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		texture.image
	);
	// console.log(bg_file);
	gl.generateMipmap(gl.TEXTURE_2D);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); 
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(
		gl.TEXTURE_2D,
		gl.TEXTURE_MIN_FILTER,
		gl.LINEAR_MIPMAP_NEAREST
	);

	drawScene();
}

function initSquareBuffer() {
	var size = 1.0;
  var vertices = [
    -size,
    -size, // bottom left
    size,
    -size, // bottom right
    size,
    size, // top right
    -size,
    size, // top left
  ];
  sqbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  sqbuf.itemSize = 2;
  sqbuf.numItems = 4;

  var indices = [0, 1, 2, 0, 2, 3];
  sqindexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqindexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );  
  sqindexBuf.itemSize = 1;
  sqindexBuf.numItems = 6;
}

function drawSquare(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, sqbuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    sqbuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
    
  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqindexBuf);

	
  gl.drawElements(gl.TRIANGLES, sqindexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

////////////////////////////////////////////////////////////////////////
// The main drawing routine, but does nothing except clearing the canvas
//
function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0.9, 0.9, 0.9, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // for texture binding
  gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_2D, bg_tex); 
  gl.uniform1i(uBgTextureLocation, 0);

  gl.activeTexture(gl.TEXTURE1); 
  gl.bindTexture(gl.TEXTURE_2D, fg_tex); 
  gl.uniform1i(uFgTextureLocation, 1);

  gl.uniform1i(uModeLoc, blend_mode);
  gl.uniform1i(uFiltLoc, filter_mode);
  gl.uniform2f(uCBLoc, contrastBrightness[0], contrastBrightness[1]);
  gl.uniform4f(opsLoc, ops[0], ops[1], ops[2], ops[3]); // 0 -> no op; 1 -> box blur; 2 -> sharpen; 3 -> edge detect
  gl.uniform2f(imgSizeLoc, gl.viewportWidth, gl.viewportHeight);

	drawSquare();
}

// This is the entry point from the html
function webGLStart() {
  // console.log('restarted');
  canvas = document.getElementById("myCanvas");
  initGL(canvas); // intialize webgl
  shaderProgram = initShaders(); // initialize shader code, load, and compile
  
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  uModeLoc = gl.getUniformLocation(shaderProgram, "imgMode");
  uFiltLoc = gl.getUniformLocation(shaderProgram, "filter_mode");
  uCBLoc = gl.getUniformLocation(shaderProgram, "contrastBrightness");
  opsLoc = gl.getUniformLocation(shaderProgram, "ops");
  uBgTextureLocation = gl.getUniformLocation(shaderProgram, "bgTexture");
  uFgTextureLocation = gl.getUniformLocation(shaderProgram, "fgTexture");
  imgSizeLoc = gl.getUniformLocation(shaderProgram, "imageSize");

  gl.enableVertexAttribArray(aPositionLocation);
  
  initSquareBuffer();

  const backgroundImage = document.getElementById('bgimg');
  backgroundImage.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        textureFile = event.target.result;
        bg_tex = initTexture(event.target.result);
        console.log(textureFile);
      };
      reader.readAsDataURL(file);
    }
  });

  const foregroundImage = document.getElementById('fgimg');
  foregroundImage.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        textureFile = event.target.result;
        fg_tex = initTexture(textureFile);
        console.log(textureFile);
      };
      reader.readAsDataURL(file);
    }
  });

  var modeInput = document.getElementsByName("imMode");
  for(let radio of modeInput) {
    radio.addEventListener('change', function() {
      blend_mode = radio.value == "bg" ? 0 : 1;
      console.log(radio.value);
      drawScene();
    });
  }

  var filterInp = document.getElementsByName("filter");
  for(let radio of filterInp) {
    radio.addEventListener('change', function() {
      console.log(radio.value);
      filter_mode = radio.value == "greyscale" ? 1 : radio.value == "sepia" ? 2 : 0; 
      drawScene();
    });
  }

  const contrastSlider = document.getElementById('contSlider');
  contrastSlider.addEventListener('input', function(event) {
    contrastBrightness[0] = event.target.value;
    console.log(contrastBrightness);
    drawScene();
  });

  const brightnessSlider = document.getElementById('brightSlider');
  brightnessSlider.addEventListener('input', function(event) {
    contrastBrightness[1] = event.target.value;
    console.log(contrastBrightness);
    drawScene();
  });

  var opsInp = document.getElementsByName("ops");
  for(let op of opsInp) {
    op.addEventListener('change', function() {
      console.log(op.value);
      ops[op.value] = (ops[op.value] + 1) % 2;
      console.log(ops);
      drawScene();
    });
  }

  const resetBtn = document.getElementById('reset');
  resetBtn.addEventListener('click', function(event) {
    contrastBrightness = [1.0, 0.0];
    filter_mode = 0;
    blend_mode = 0;
    ops = [0, 0, 0, 0];

    document.getElementById("bgOnly").checked = true;
    document.getElementById("blended").checked = false;
    document.getElementsByName("filter").forEach(radio => {radio.checked = false;});
    document.getElementById("contSlider").value = 1.0;
    document.getElementById("brightSlider").value = 0.0;
    document.getElementsByName("ops").forEach(radio => {radio.checked = false;});

    drawScene();
  });

  var saveBtn = document.getElementById('save');
  saveBtn.addEventListener('click', function(event) {
    event.preventDefault();

    drawScene();
    let canvasUrl = canvas.toDataURL("image/png");
    var createEl = document.createElement('a');
    createEl.href = canvasUrl;
    createEl.download = "processed_output.png";
    createEl.click();
    createEl.remove();
  });

	drawScene(); // start drawing now

}


