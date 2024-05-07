
var gl;
var canvas;
var matrixStack = [];

var zAngle = 2.0;
var yAngle = 5.0;
var prevMouseX = 0.0;
var prevMouseY = 0.0;

var buf;
var indexBuf;
var cubeNormalBuf;
var texBuf;

var sqbuf;
var sqindexBuf;
var sqnormalBuf;
var sqtexBuf;

var aPositionLocation;
var aNormalLocation;
var aTexCoordLocation;
var uVMatrixLocation;
var uMMatrixLocation;
var uPMatrixLocation;
var uWNMatrixLocation;
var uEyePositionLocation;
var uobjectTypeLocation;
var uColorLocation;
var uLightLocation;

var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var WNMatrix = mat4.create(); //world normal matrix

var spBuf;
var spIndexBuf;
var spNormalBuf;
var spTexBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];
var spTexCoords = [];

var objVertexPositionBuffer;
var objVertexNormalBuffer;
var objVertexIndexBuffer;
var objVertexTexCoordBuffer;

var uTextureLocation;
var cubeMapTexture;
var uCubemapTextureLocation;
var tableTexture;
var rubicTex;
var sampleTexture;  

var objectType;

var tableTextureFile = "texture_and_other_files/wood_texture.jpg";
var rubicTextureFile = "texture_and_other_files/rcube.png";
var cubeMapPath = "texture_and_other_files/Nvidia_cubemap/";
var posx, posy, posz, negx, negy, negz;

var posx_file = cubeMapPath.concat("posx.jpg");
var posy_file = cubeMapPath.concat("posy.jpg");
var posz_file = cubeMapPath.concat("posz.jpg");
var negx_file = cubeMapPath.concat("negx.jpg");
var negy_file = cubeMapPath.concat("negy.jpg");
var negz_file = cubeMapPath.concat("negz.jpg");

var lightPos = [0.0, 8.0, 15.0];
var eyePos = [1.0, 1.5, 6.0]; // camera/eye position
var xCam = 0;
var yCam = 0;
var zCam = 0;

var theta = 0.0;

input_JSON = "texture_and_other_files/teapot.json";

//////////////////////////////////////////////////////////////////////////
const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoords;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out vec2 fragTexCoord;
out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec3 posInEyeSpace;
out mat4 viewMatrix;
out mat3 normalMatrix;
out vec3 normal;

void main() {
  mat4 projectionModelView;
  projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  fragTexCoord = aTexCoords;
  
  posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition,1.0)).xyz;
  mat3 normalMatrix = transpose(inverse(mat3(uVMatrix * uMMatrix)));
  viewMatrix = uVMatrix;
  normal = normalize(vec3(normalMatrix * aNormal));
  
  //Computation is done at world space
  mat4 uWNMatrix = mat4(transpose(inverse(uMMatrix)));
  v_worldPosition = mat3(uMMatrix) * aPosition;
  v_worldNormal = mat3(uWNMatrix) * aNormal;

  gl_Position =  projectionModelView * vec4(aPosition,1.0);

}`;

const fragShaderCode = `#version 300 es
precision highp float;

in vec2 fragTexCoord;
uniform sampler2D imageTexture;
uniform samplerCube cubeMap;
uniform vec3 eyePos;
uniform int objectType;
in vec3 v_worldPosition;
in vec3 v_worldNormal;
out vec4 fragColor;

in vec3 normal;
in vec3 posInEyeSpace;
in mat4 viewMatrix;
in mat3 normalMatrix;
uniform vec4 objColor;
uniform vec3 lightPos;

void main() {
  fragColor = vec4(0,0,0,1);

  vec4 textureColor =  texture(imageTexture, fragTexCoord); 

  vec3 worldNormal = normalize(v_worldNormal);
  vec3 eyeToSurfaceDir = normalize(v_worldPosition - eyePos);
  
  vec3 directionReflection = reflect(eyeToSurfaceDir, worldNormal);
  vec4 cubeMapReflectCol = texture(cubeMap, directionReflection);

  vec3 directionRefraction = refract(eyeToSurfaceDir,worldNormal,0.82);
  vec4 cubeMapRefractCol = texture(cubeMap, directionRefraction);

  vec3 L = normalize(vec3(viewMatrix * vec4(lightPos, 1.0)) - posInEyeSpace);
  vec3 R = normalize(-reflect(L,normal));
  vec3 V = normalize(-posInEyeSpace);
  float diff = max(dot(normal, L), 0.0);
  float spec = max(dot(R, V), 0.0);
  float amb=0.15;

  switch(objectType) {
    case 1:
      // code block
      fragColor = textureColor;
      break;
    case 2:
      fragColor = cubeMapReflectCol;
      break;
    case 3:
        fragColor = (cubeMapReflectCol+textureColor)/2.0;
        break;
    case 4:
        fragColor = cubeMapRefractCol;
        break;
    default:
        fragColor = objColor * ( amb + 1.0 * diff ) + 5.0*pow(spec, 30.0);
        fragColor.a = 1.0;
        fragColor = (fragColor + cubeMapReflectCol)/2.0;
  }
}`;

function pushMatrix(stack, m) {
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
}

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

  // check for compiiion and linking status
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

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function initSphere(nslices, nstacks, radius) {
  for (var i = 0; i <= nslices; i++) {
    var angle = (i * Math.PI) / nslices;
    var comp1 = Math.sin(angle);
    var comp2 = Math.cos(angle);

    for (var j = 0; j <= nstacks; j++) {
      var phi = (j * 2 * Math.PI) / nstacks;
      var comp3 = Math.sin(phi);
      var comp4 = Math.cos(phi);

      var xcood = comp4 * comp1;
      var ycoord = comp2;
      var zcoord = comp3 * comp1;
      var utex = 1 - j / nstacks;
      var vtex = 1 - i / nslices;

      spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
      spNormals.push(xcood, ycoord, zcoord);
      spTexCoords.push(utex, vtex);
    }
  }

  // now compute the indices here
  for (var i = 0; i < nslices; i++) {
    for (var j = 0; j < nstacks; j++) {
      var id1 = i * (nstacks + 1) + j;
      var id2 = id1 + nstacks + 1;

      spIndicies.push(id1, id2, id1 + 1);
      spIndicies.push(id2, id2 + 1, id1 + 1);
    }
  }
}

function initSphereBuffer() {
  var nslices = 50;
  var nstacks = 50;
  var radius = 1.0;

  initSphere(nslices, nstacks, radius);

  // buffer for vertices
  spBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = spVerts.length / 3;

  // buffer for indices
  spIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = spIndicies.length;

  // buffer for normals
  spNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = spNormals.length / 3;

  // buffer for texture coordinates
  spTexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spTexCoords), gl.STATIC_DRAW);
  spTexBuf.itemSize = 2;
  spTexBuf.numItems = spTexCoords.length / 2;
}

function drawSphere(color, sampTex) {
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    spBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    spBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
  gl.vertexAttribPointer(
    aTexCoordLocation,
    spTexBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // Draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  
  gl.uniform3fv(uEyePositionLocation, eyePos);
  gl.uniform1i(uobjectTypeLocation, objectType);
  gl.uniform4fv(uColorLocation, color);
  gl.uniform3fv(uLightLocation,lightPos);

  // for texture binding
  gl.activeTexture(gl.TEXTURE2); // set texture unit 2 to use
  gl.bindTexture(gl.TEXTURE_2D, sampTex); // bind the texture object to the texture unit
  gl.uniform1i(uTextureLocation, 2); // pass the texture unit to the shader

  //Bind the cube map texture to the shader
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
  gl.uniform1i(uCubemapTextureLocation, 1); 

  gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

function initCubeBuffer() {
  var vertices = [
    // Front face
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Back face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    // Top face
    -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Bottom face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Right face
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // Left face
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  ];
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  buf.itemSize = 3;
  buf.numItems = vertices.length / 3;

  var normals = [
    // Front face
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    // Back face
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    // Top face
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    // Bottom face
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    // Right face
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    // Left face
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];
  cubeNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  cubeNormalBuf.itemSize = 3;
  cubeNormalBuf.numItems = normals.length / 3;

  var indices = [
    0,
    1,
    2,
    0,
    2,
    3, // Front face
    4,
    5,
    6,
    4,
    6,
    7, // Back face
    8,
    9,
    10,
    8,
    10,
    11, // Top face
    12,
    13,
    14,
    12,
    14,
    15, // Bottom face
    16,
    17,
    18,
    16,
    18,
    19, // Right face
    20,
    21,
    22,
    20,
    22,
    23, // Left face
  ];
  indexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );
  indexBuf.itemSize = 1;
  indexBuf.numItems = indices.length;

  // texture coordinates
  var texCoords = [
    // Front face
    0.0,0.0, 1.0,0.0, 1.0,1.0, 0.0,1.0,
    // Back face
    0.0,0.0, 1.0,0.0, 1.0,1.0, 0.0,1.0,
    // Top face
    0.0,0.0, 1.0,0.0, 1.0,1.0, 0.0,1.0,
    // Bottom face
    0.0,0.0, 1.0,0.0, 1.0,1.0, 0.0,1.0,
    // Right face
    0.0,0.0, 1.0,0.0, 1.0,1.0, 0.0,1.0,
    // Left face
    0.0,0.0, 1.0,0.0, 1.0,1.0, 0.0,1.0,
  ];
  texBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
  texBuf.itemSize = 2;
  texBuf.numItems = texCoords.length / 2;

}

function drawCube(color)  { 
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(
    aPositionLocation,
    buf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf );
  gl.vertexAttribPointer(
    aNormalLocation,
    buf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
  gl.vertexAttribPointer(
    aTexCoordLocation,
    texBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  ); 
  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  
  gl.uniform3fv(uEyePositionLocation, eyePos);
  gl.uniform1i(uobjectTypeLocation, objectType);
  gl.uniform4fv(uColorLocation, color);
  gl.uniform3fv(uLightLocation,lightPos);

  // for texture binding
  // gl.activeTexture(gl.TEXTURE2); 
  // gl.bindTexture(gl.TEXTURE_2D, sampTex); 
  // gl.uniform1i(uTextureLocation, 2); 

  // gl.activeTexture(gl.TEXTURE3);
  // gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
  // gl.uniform1i(uCubemapTextureLocation, 3);

  gl.drawElements(gl.TRIANGLES, indexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function initSquareBuffer() {
  var vertices = [
    -0.5,
    -0.5,
    0.0, // bottom left
    0.5,
    -0.5,
    0.0, // bottom right
    0.5,
    0.5,
    0.0, // top right
    -0.5,
    0.5,
    0.0, // top left
  ];
  sqbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  sqbuf.itemSize = 3;
  sqbuf.numItems = 4;

  var normals = [
    0.0,
    0.0,
    1.0, // bottom left
    0.0,
    0.0,
    1.0, // bottom right
    0.0,
    0.0,
    1.0, // top right
    0.0,
    0.0,
    1.0, // top left
  ];
  sqnormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqnormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  sqnormalBuf.itemSize = 3;
  sqnormalBuf.numItems = 4;

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

  // texture coordinates

  var texCoords = [
    0.0,
    0.0, // bottom left
    1.0,
    0.0, // bottom right
    1.0,
    1.0, // top right
    0.0,
    1.0, // top left
  ];
  sqtexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqtexBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
  sqtexBuf.itemSize = 2;
  sqtexBuf.numItems = 4;
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

  gl.bindBuffer(gl.ARRAY_BUFFER, sqnormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    sqbuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, sqtexBuf);
  gl.vertexAttribPointer(
    aTexCoordLocation,
    sqtexBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
    
  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqindexBuf);
    
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
  
  gl.uniform3fv(uEyePositionLocation, eyePos);
  gl.uniform1i(uobjectTypeLocation, objectType);
  gl.uniform4fv(uColorLocation, color);
  gl.uniform3fv(uLightLocation,lightPos);

  // for texture binding
  // gl.activeTexture(gl.TEXTURE0); 
  // gl.bindTexture(gl.TEXTURE_2D, sampTex); 
  // gl.uniform1i(uTextureLocation, 0);

  gl.drawElements(gl.TRIANGLES, sqindexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function initObject() {
  // XMLHttpRequest objects are used to interact with servers
  // It can be used to retrieve any type of data, not just XML.
  var request = new XMLHttpRequest();
  request.open("GET", input_JSON);
  // MIME: Multipurpose Internet Mail Extensions
  // It lets users exchange different kinds of data files
  request.overrideMimeType("application/json");
  request.onreadystatechange = function () {
    //request.readyState == 4 means operation is done
    if (request.readyState == 4) {
      processObject(JSON.parse(request.responseText));
    }
  };
  request.send();
}

function processObject(objData) {
  objVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexPositions),
    gl.STATIC_DRAW
  );
  objVertexPositionBuffer.itemSize = 3;
  objVertexPositionBuffer.numItems = objData.vertexPositions.length / 3;

  objVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(objData.indices),
    gl.STATIC_DRAW
  );
  objVertexIndexBuffer.itemSize = 1;
  objVertexIndexBuffer.numItems = objData.indices.length;

  objVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexNormals),
    gl.STATIC_DRAW
  );
  objVertexNormalBuffer.itemSize = 3;
  objVertexNormalBuffer.numItems = objData.vertexNormals.length / 3;

  objVertexTexCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTexCoordBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(objData.vertexTextureCoords),
    gl.STATIC_DRAW
  );
  objVertexTexCoordBuffer.itemSize = 2;
  objVertexTexCoordBuffer.numItems = objData.vertexTextureCoords.length / 2;

}

function drawObject(color) {

  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    3,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
  gl.vertexAttribPointer(
    aNormalLocation,
    3,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTexCoordBuffer);
  gl.vertexAttribPointer(
    aTexCoordLocation,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );

  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);

  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.uniform3fv(uEyePositionLocation, eyePos);
  gl.uniform1i(uobjectTypeLocation, objectType);
  gl.uniform4fv(uColorLocation, color);
  gl.uniform3fv(uLightLocation,lightPos);

  // for texture binding
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
  gl.uniform1i(uTextureLocation, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
  gl.uniform1i(uCubemapTextureLocation, 1);

  gl.drawElements(
    gl.TRIANGLES,
    2976,
    gl.UNSIGNED_INT,
    0
  );
}

function initTextures(textureFile) {
  var tex = gl.createTexture();
  tex.image = new Image();
  tex.image.src = textureFile;
  tex.image.onload = function () {
    handleTextureLoaded(tex);
  };
  return tex;
}

function handleTextureLoaded(texture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // use it to flip Y if needed
  gl.texImage2D(
    gl.TEXTURE_2D, // 2D texture
    0, // mipmap level
    gl.RGB, // internal format
    gl.RGB, // format
    gl.UNSIGNED_BYTE, // type of data
    texture.image // array or <img>
  );

  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );

  drawScene();
}

function initCubeMap() {
  const faceInfos = [
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: posx_file
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url: negx_file
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url: posy_file
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: negy_file
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: posz_file
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: negz_file
    }
  ];


  cubemapTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);

  faceInfos.forEach((faceInfo) => {
    const { target, url } = faceInfo;
    //setup each face
    gl.texImage2D(
      target,
      0,
      gl.RGBA,
      512,
      512,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    //load images
    const image = new Image();
    image.src = url;
    image.addEventListener("load", function () {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
      gl.texImage2D(
        target,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    });
  });
  //Mipmap for texturing
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

function drawSkybox() {

	var size = 200
  // Back side of the cube
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 0, -size/2+0.5]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);

	gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_2D, negz); 
  gl.uniform1i(uTextureLocation, 0);

  color = [1.0, 1.0, 0.0, 1.0];
  drawSquare(color);
  mMatrix = popMatrix(matrixStack);

  // Front side of the cube
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 0, size/2-0.5]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);
  color = [1.0, 1.0, 0.0, 1.0];

	gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_2D, posz); 
  gl.uniform1i(uTextureLocation, 0);

  drawSquare(color);
  mMatrix = popMatrix(matrixStack);

  // Left side of the cube
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-99.5, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(270), [0, 1, 0]);
  mMatrix = mat4. rotate(mMatrix, degToRad(180), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [size, size, size]);

	gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_2D, negx); 
  gl.uniform1i(uTextureLocation, 0);

  color = [1.0, 1.0, 0.0, 1.0];
  drawSquare(color);
  mMatrix = popMatrix(matrixStack);

  // Right side of the cube
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [99.5, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(90), [0, 1, 0]);
  mMatrix = mat4. rotate(mMatrix, degToRad(180), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [200, 200, 200]);
  color = [1.0, 1.0, 0.0, 1.0];

	gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_2D, posx); 
  gl.uniform1i(uTextureLocation, 0);

  drawSquare(color);
  mMatrix = popMatrix(matrixStack);

  // Top side of the cube
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 99.5, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(270), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [200, 200, 200]);

	gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_2D, posy); 
  gl.uniform1i(uTextureLocation, 0);

  color = [1.0, 1.0, 0.0, 1.0];
  drawSquare(color);
  mMatrix = popMatrix(matrixStack);

  // Bottom side of the cube
  pushMatrix(matrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, -99.5, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(90), [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [200, 200, 200]);

	gl.activeTexture(gl.TEXTURE0); 
  gl.bindTexture(gl.TEXTURE_2D, negy); 
  gl.uniform1i(uTextureLocation, 0);

  color = [1.0, 1.0, 0.0, 1.0];
  drawSquare(color);
  mMatrix = popMatrix(matrixStack);
}

function drawTable() {
	objectType = 3;
			
    // Table top
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.0, -0.4, -1.0]);
    mMatrix = mat4.scale(mMatrix, [4.0, 0.3, 3.5]);
    drawSphere(color, tableTexture);
    mMatrix = popMatrix(matrixStack);
		
    //Table legs
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [2.3, -3.2, -0.23]);
    mMatrix = mat4.scale(mMatrix, [0.4, 6.0, 0.3]);
    drawCube(color,tableTexture);
    mMatrix = popMatrix(matrixStack);
		
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-2.5, -3.2, -0.23]);
    mMatrix = mat4.scale(mMatrix, [0.4, 6.0, 0.3]);
    drawCube(color,tableTexture);
    mMatrix = popMatrix(matrixStack);
		
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [2.3, -3.2, -2.9]);
    mMatrix = mat4.scale(mMatrix, [0.4, 6.0, 0.3]);
    drawCube(color,tableTexture);
    mMatrix = popMatrix(matrixStack);
		
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-2., -3.4, -3]);
    mMatrix = mat4.scale(mMatrix, [0.4, 6.0, 0.3]);
    drawCube(color,tableTexture);
    mMatrix = popMatrix(matrixStack);
}

function drawBall(color, size, pos){
	objectType = 5;
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, pos);
	mMatrix = mat4.scale(mMatrix, size);
	drawSphere(color, tableTexture);
	mMatrix = popMatrix(matrixStack);
} 

//////////////////////////////////////////////////////////////////////
//The main drawing routine
function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

  var animate = function() {

		gl.clearColor(0.6, 0.6, 0.6, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
    
		theta -= 0.025;
		
		var zRotationAngle = 5*Math.cos(degToRad(theta))-1;
    var xRotationAngle = 5*Math.sin(degToRad(theta));

    eyePos[2]=zRotationAngle;
    eyePos[0]=xRotationAngle;

    //set up the model matrix
    mat4.identity(mMatrix);
		
    //set up projection matrix
    mat4.identity(pMatrix);
    mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);
		
    // set up the view matrix, multiply into the modelview matrix
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, [xCam, yCam, zCam], [0, 1, 0], vMatrix);

    // global rotation, controlled by mouse
    mMatrix = mat4.rotate(mMatrix, degToRad(zAngle), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(yAngle), [1, 0, 0]);

    objectType = 1;
    drawSkybox();
		
		// Rubric cube
    objectType = 1;
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.3, 0.0, 1.7]);
    mMatrix = mat4.rotate(mMatrix, degToRad(150), [0, 1, 0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.6, 0.6]);

		gl.activeTexture(gl.TEXTURE2); 
		gl.bindTexture(gl.TEXTURE_2D, rubicTex); 
		gl.uniform1i(uTextureLocation, 2); 
	
		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
		gl.uniform1i(uCubemapTextureLocation, 3);
	
    drawCube(color);
    mMatrix = popMatrix(matrixStack);
		
    // Teapot
    objectType = 2;
    pushMatrix(matrixStack, mMatrix);
    mat4.translate(mMatrix, [0.1, 0.7, -1.5]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.1, 0.1]);
    color = [1.0, 1.0, 1.0, 1.0];
    drawObject(color);
    mMatrix = popMatrix(matrixStack);

		// Table
		drawTable();
		
    // Refracting cube
    objectType = 4;
    pushMatrix(matrixStack, mMatrix);
    color = [1.0, 1.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [-2, 0.36, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(75), [0, 1, 0]);
    mMatrix = mat4.scale(mMatrix, [0.7, 1.2, 0.8]);
    drawCube(color);
    mMatrix = popMatrix(matrixStack);
		
    //Spherical balls with phong shading
		color = [0.3, 0.7, 0.1, 1.0]
		var postn = [-0.6, 0.2, 1.2]
		var size = [0.45, 0.45, 0.45]
		drawBall(color, size, postn);
		color = [0.3, 0.2, 0.9, 1.0]
		var postn = [1.4, 0.2, 0.5]
		var size = [0.3, 0.3, 0.3]
		drawBall(color, size, postn);
		
    animation = window.requestAnimationFrame(animate);
  };
  animate();

}

function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);

  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    prevMouseX = event.clientX;
    prevMouseY = canvas.height - event.clientY;
  }
}

function onMouseMove(event) {
  // make mouse interaction only within canvas
  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    var mouseX = event.clientX;
    var diffX = mouseX - prevMouseX;
    zAngle = zAngle + diffX / 5;
    prevMouseX = mouseX;

    var mouseY = canvas.height - event.clientY;
    var diffY = mouseY - prevMouseY;
    yAngle = yAngle - diffY / 5;
    prevMouseY = mouseY;

    drawScene();
  }
}

function onMouseUp(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("canvas");
  document.addEventListener("mousedown", onMouseDown, false);

  initGL(canvas);
  shaderProgram = initShaders();

  //get locations of attributes declared in the vertex shader
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  aTexCoordLocation = gl.getAttribLocation(shaderProgram, "aTexCoords");

  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uEyePositionLocation = gl.getUniformLocation(shaderProgram, "eyePos");
  uobjectTypeLocation = gl.getUniformLocation(shaderProgram, "objectType");
  uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");
  uLightLocation = gl.getUniformLocation(shaderProgram, "lightPos");
  
  //texture location in shader
  uTextureLocation = gl.getUniformLocation(shaderProgram, "imageTexture");
  uCubemapTextureLocation = gl.getUniformLocation(shaderProgram, "cubeMap");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);
  gl.enableVertexAttribArray(aTexCoordLocation);

  initCubeMap();
  posx = initTextures(posx_file);
  posy = initTextures(posy_file);
  posz = initTextures(posz_file);
  negz = initTextures(negz_file);
  negx = initTextures(negx_file);
  negy = initTextures(negy_file);
  tableTexture = initTextures(tableTextureFile);
  rubicTex = initTextures(rubicTextureFile);

  //initialize buffers for the square
  initSphereBuffer();
  initCubeBuffer();
  initSquareBuffer();
  initObject();

  drawScene();
}
