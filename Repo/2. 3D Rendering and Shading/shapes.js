var gl;
var canvas;

var buf;
var indexBuf;
var normalBuf;

var spBuf;
var spIndexBuf;
var spNormalBuf;

var aNormalLocation;
var aPositionLocation;
var uColorLocation;
var uLightLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;

var spVerts = [];
var spIndicies = [];
var spNormals = [];

var degree1 = [0.0, 0.0, 0.0];
var degree0 = [0.0, 0.0, 0.0];
var prevMouseX = 0.0;
var prevMouseY = 0.0;

// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix

var lightPos = [4.0, 25.0, 50.0];

// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.0, 2.0];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];

var matrixStack = [];
function pushMatrix(stack, m) {
    //necessary because javascript only does shallow push
    var copy = mat4.create(m);
    stack.push(copy);
}

function popMatrix(stack) {
    if (stack.length > 0) return stack.pop();
    else console.log("stack has no matrix to pop!");
}

// Vertex shader code
const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out mat4 vMMatrix;
out vec3 posInEyeSpace;

void main() {
  mat4 projectionModelView;
  projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  
  posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition,1.0)).xyz;
  gl_PointSize=5.0;
  vMMatrix=uVMatrix;
}`;

// Fragment shader code
const fragShaderCode = `#version 300 es
precision mediump float;
in mat4 vMMatrix;
in vec3 posInEyeSpace;

out vec4 fragColor;

uniform vec3 lightPos;
uniform vec4 objColor;

vec3 normal, L, R, V;

void main() {
  fragColor = objColor;
  normal = normalize(cross(dFdx(posInEyeSpace), dFdy(posInEyeSpace)));
  L = normalize(vec3(vMMatrix * vec4(lightPos, 1.0)) - posInEyeSpace);
  R = normalize(-reflect(L,normal));
  V = normalize(-posInEyeSpace);
  float lambertian = max(dot(normal, L), 0.0); 
  float specular = 0.0;
  float specAngle = max(dot(R, V), 0.0);
  specular = pow(specAngle, 16.0);
  fragColor.rgb = fragColor.rgb * (lambertian + specular + 0.3);
  fragColor.a = 1.0;
}`;

const gourVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform vec3 lightPos;
uniform vec4 objColor;

vec3 normal, L, R, V, posInEyeSpace;
mat3 normalMatrix;

out vec4 verColor;

void main() {
    mat4 projectionModelView;
    projectionModelView=uPMatrix*uVMatrix*uMMatrix;
    gl_Position = projectionModelView*vec4(aPosition,1.0);
    
    posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition,1.0)).xyz;
    mat3 normalMatrix = transpose(inverse(mat3(uMMatrix)));
    normal = normalize(normalMatrix * aNormal);

    L = normalize(vec3(uVMatrix * vec4(lightPos, 1.0)) - posInEyeSpace);
    R = normalize(-reflect(L,normal));
    V = normalize(-posInEyeSpace);
    float lambertian = max(dot(normal, L), 0.0); 
    float specular = 0.0;
    float specAngle = max(dot(R, V), 0.0);
    specular = pow(specAngle, 16.0);
    verColor.rgb = objColor.rgb * (lambertian + specular + 0.2);
    verColor.a = 1.0;
}`;

const gourFragShaderCode = `#version 300 es
precision mediump float;

in vec4 verColor;

out vec4 fragColor;

void main() {
    fragColor = verColor;
}`;

const phongVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

out mat4 vMMatrix;
out vec3 posInEyeSpace;
out vec3 normal;
out mat3 normalMatrix;

void main() {
  mat4 projectionModelView;
  projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  
  posInEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition,1.0)).xyz;
  gl_PointSize=5.0;
  vMMatrix=uVMatrix;
  normalMatrix = transpose(inverse(mat3(uVMatrix * uMMatrix)));
  normal = normalize(normalMatrix * aNormal);
}`;

const phongFragShaderCode = `#version 300 es
precision mediump float;
in mat4 vMMatrix;
in vec3 posInEyeSpace;
in vec3 aNormal;
in mat3 normalMatrix;
in vec3 normal;

out vec4 fragColor;

uniform vec3 lightPos;
uniform vec4 objColor;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

vec3 L, R, V;

void main() {
    fragColor = objColor;
    L = normalize(vec3(vMMatrix * vec4(lightPos, 1.0)) - posInEyeSpace);
    R = normalize(-reflect(L,normal));
    V = normalize(-posInEyeSpace);
    float lambertian = max(dot(normal, L), 0.0); 
    float specular = 0.0;
    float specAngle = max(dot(R, V), 0.0);
    specular = pow(specAngle, 16.0);
    fragColor.rgb = fragColor.rgb * (lambertian + specular + 0.1);
    fragColor.a = 1.0;
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

function initShaders(verShadCode, fragShadCode) {
    shaderProgram = gl.createProgram();

    var vertexShader = vertexShaderSetup(verShadCode);
    var fragmentShader = fragmentShaderSetup(fragShadCode);

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
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

function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
}

function initSphere(nslices, nstacks, radius) {
    var theta1, theta2;

    for (i = 0; i < nslices; i++) {
        spVerts.push(0);
        spVerts.push(-radius);
        spVerts.push(0);

        spNormals.push(0);
        spNormals.push(-1.0);
        spNormals.push(0);
    }

    for (j = 1; j < nstacks - 1; j++) {
        theta1 = (j * 2 * Math.PI) / nslices - Math.PI / 2;
        for (i = 0; i < nslices; i++) {
            theta2 = (i * 2 * Math.PI) / nslices;
            spVerts.push(radius * Math.cos(theta1) * Math.cos(theta2));
            spVerts.push(radius * Math.sin(theta1));
            spVerts.push(radius * Math.cos(theta1) * Math.sin(theta2));

            spNormals.push(Math.cos(theta1) * Math.cos(theta2));
            spNormals.push(Math.sin(theta1));
            spNormals.push(Math.cos(theta1) * Math.sin(theta2));
        }
    }

    for (i = 0; i < nslices; i++) {
        spVerts.push(0);
        spVerts.push(radius);
        spVerts.push(0);

        spNormals.push(0);
        spNormals.push(1.0);
        spNormals.push(0);
    }

    // setup the connectivity and indices
    for (j = 0; j < nstacks - 1; j++)
        for (i = 0; i <= nslices; i++) {
            var mi = i % nslices;
            var mi2 = (i + 1) % nslices;
            var idx = (j + 1) * nslices + mi;
            var idx2 = j * nslices + mi;
            var idx3 = j * nslices + mi2;
            var idx4 = (j + 1) * nslices + mi;
            var idx5 = j * nslices + mi2;
            var idx6 = (j + 1) * nslices + mi2;

            spIndicies.push(idx);
            spIndicies.push(idx2);
            spIndicies.push(idx3);
            spIndicies.push(idx4);
            spIndicies.push(idx5);
            spIndicies.push(idx6);
        }
}

function initSphereBuffer() {
    var nslices = 30; // use even number
    var nstacks = nslices / 2 + 1;
    var radius = 1.0;
    initSphere(nslices, nstacks, radius);

    spBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
    spBuf.itemSize = 3;
    spBuf.numItems = nslices * nstacks;

    spNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
    spNormalBuf.itemSize = 3;
    spNormalBuf.numItems = nslices * nstacks;

    spIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(spIndicies),
        gl.STATIC_DRAW
    );
    spIndexBuf.itemsize = 1;
    spIndexBuf.numItems = (nstacks - 1) * 6 * (nslices + 1);
}

// Cube generation function with normals
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
    normalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    normalBuf.itemSize = 3;
    normalBuf.numItems = normals.length / 3;
  
  
    var indices = [
      0, 1, 2, 0, 2, 3, // Front face
      4, 5, 6, 4, 6, 7, // Back face
      8, 9, 10, 8, 10, 11, // Top face
      12, 13, 14, 12, 14, 15, // Bottom face
      16, 17, 18, 16, 18, 19, // Right face
      20, 21, 22, 20, 22, 23, // Left face
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
  }

function drawCube(color) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(
        aPositionLocation,
        buf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuf);
    gl.vertexAttribPointer(
        aNormalLocation,
        normalBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // draw elementary arrays - triangle indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);

    gl.uniform4fv(uColorLocation, color);
    gl.uniform3fv(uLightLocation, lightPos);
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

    gl.drawElements(gl.TRIANGLES, indexBuf.numItems, gl.UNSIGNED_SHORT, 0);
    // gl.drawArrays(gl.LINE_STRIP, 0, buf.numItems); // show lines
    //gl.drawArrays(gl.POINTS, 0, buf.numItems); // show points
}

function drawSphere(color) {
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
        spNormalBuf.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    // draw elementary arrays - triangle indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf); // bind indices

    gl.uniform4fv(uColorLocation, color);
    gl.uniform3fv(uLightLocation, lightPos);
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

    gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
    // gl.drawArrays(gl.LINE_STRIP, 0, spBuf.numItems); // show lines
    //gl.drawArrays(gl.POINTS, 0, spBuf.numItems); // show points
}

//////////////////////////////////////////////////////////////////////
//Main drawing routine

// colors
const red = [0.9, 0.3, 0.3, 1];
const blue = [0.4, 0.75, 0.9, 1];
const yellow = [0.8, 0.8, 0.5, 1];
const green = [0.4, 1.0, 0.4, 1];
const silver = [0.8, 0.8, 0.8, 1];
const pink = [0.9, 0.4, 0.9, 1];
const orange = [1.0, 0.7, 0.35, 1];
const purple = [0.5, 0.5, 0.8, 1];
const oceanBlue = [0.5, 0.8, 1, 1];
const olive = [0.51, 0.48, 0.2, 1];

function view1() {
    shaderProgram = initShaders(vertexShaderCode, fragShaderCode);

    //get locations of attributes and uniforms declared in the shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");
    uLightLocation = gl.getUniformLocation(shaderProgram, "lightPos");

    //enable the attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);

    mMatrix = mat4.rotate(mMatrix, degToRad(degree0[0]), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree1[0]), [1, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0.5]);
    mMatrix = mat4.rotate(mMatrix, degToRad(13), [1, 0, 0]);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 1.0, 0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.6, 0.6]);
    drawSphere(oceanBlue);
    mMatrix = popMatrix(matrixStack);
    
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.45, 0]);
    mMatrix = mat4.scale(mMatrix, [1.0, 1.75, 1.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(30), [0, 1, 0]);
    drawCube(olive);
    mMatrix = popMatrix(matrixStack);
}

function view2() {
    shaderProgram = initShaders(gourVertexShaderCode, gourFragShaderCode);

    //get locations of attributes and uniforms declared in the shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");
    uLightLocation = gl.getUniformLocation(shaderProgram, "lightPos");

    //enable the attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);

    mMatrix = mat4.rotate(mMatrix, degToRad(degree0[1]), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree1[1]), [1, 0, 0]);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.4, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    drawSphere(silver);

    mMatrix = mat4.translate(mMatrix, [-1, 1.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.9, 0.9, 0.9]);
    mMatrix = mat4.rotate(mMatrix, degToRad(40), [0.3, -0.4, -0.7]);
    drawCube(green);

    mMatrix = mat4.translate(mMatrix, [0.0, 1.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.6, 0.6]);
    mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.5, -0.0, -0.7]);
    drawSphere(silver);

    mMatrix = mat4.translate(mMatrix, [0.5, 1.40, 0.0]);
    mMatrix = mat4.scale(mMatrix, [1.1, 1.1, 1.1]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-40), [0.4, -1.5, 1.2]);
    mMatrix = mat4.translate(mMatrix, [0.2, 0.0, 0.0]);
    drawCube(green);

    mMatrix = mat4.translate(mMatrix, [-0.9, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.45, 0.45, 0.45]);
    mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.5, -0.0, -0.7]);
    drawSphere(silver);

    mMatrix = popMatrix(matrixStack);
}

function view3() {
    shaderProgram = initShaders(phongVertexShaderCode, phongFragShaderCode);

    //get locations of attributes and uniforms declared in the shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");
    uLightLocation = gl.getUniformLocation(shaderProgram, "lightPos");

    //enable the attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);


    mMatrix = mat4.rotate(mMatrix, degToRad(degree0[2]), [0, 1, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(degree1[2]), [1, 0, 0]);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.55, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.22, 0.22, 0.22]);
    mMatrix = mat4.rotate(mMatrix, degToRad(35), [0.2, 1, 0]);
    drawSphere(green);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 1.0, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.9, 0.3, 0]);
    mMatrix = mat4.scale(mMatrix, [5.5, 0.2, 1.8]);
    drawCube(red);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1.8, 1.75, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.9, 0.3, 0]);
    mMatrix = mat4.scale(mMatrix, [0.7, 0.7, 0.7]);
    drawSphere(purple);
    mMatrix = mat4.translate(mMatrix, [3.6/0.7, 0.0, 0.0]);
    drawSphere(blue);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1.8, 2.5, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.9, 0.3, 0]);
    mMatrix = mat4.scale(mMatrix, [1.8, 0.2, 4.5]);
    drawCube(yellow);
    mMatrix = mat4.translate(mMatrix, [3.6/1.6, 0.0, 0.0]);
    drawCube(green);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1.8, 3.3, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.9, 0.3, 0]);
    mMatrix = mat4.scale(mMatrix, [0.7, 0.7, 0.7]);
    drawSphere(pink);
    mMatrix = mat4.translate(mMatrix, [3.6/0.7, 0.0, 0.0]);
    drawSphere(orange);
    mMatrix = popMatrix(matrixStack);
  
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 4.0, 0.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(0), [0.9, 0.3, 0]);
    mMatrix = mat4.scale(mMatrix, [5.5, 0.2, 1.8]);
    drawCube(red);
    mMatrix = popMatrix(matrixStack);

    mMatrix = mat4.translate(mMatrix, [0.0, 5.0, 0.0]);
    drawSphere(silver);

    mMatrix = popMatrix(matrixStack);
    
}

function drawScene() {
    gl.enable(gl.SCISSOR_TEST);
    // set up the view matrix, multiply into the modelview matrix
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);
    
    //set up perspective projection matrix
    mat4.identity(pMatrix);
    mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

    //set up the model matrix
    mat4.identity(mMatrix);

    gl.viewport(0, 0, 400, 400);
    gl.scissor(0, 0, 400, 400);
    gl.clearColor(0.85, 0.8, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    pushMatrix(matrixStack, mMatrix);
    view1();
    mMatrix = popMatrix(matrixStack);

    gl.viewport(400, 0, 400, 400);
    gl.scissor(400, 0, 400, 400);
    gl.clearColor(0.9, 0.8, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    pushMatrix(matrixStack, mMatrix);
    view2();
    mMatrix = popMatrix(matrixStack);
    
    gl.viewport(800, 0, 400, 400);
    gl.scissor(800, 0, 400, 400);
    gl.clearColor(0.8, 1, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    pushMatrix(matrixStack, mMatrix);
    view3();
    mMatrix = popMatrix(matrixStack);
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
    var mouseX = event.layerX;
    var mouseY = event.layerY;
    if (
        event.layerX <= canvas.width / 3  &&
        event.layerX >= 0 &&
        event.layerY <= canvas.height &&
        event.layerY >= 0
    ) {
        var mouseX = event.clientX;
        var diffX1 = mouseX - prevMouseX;
        prevMouseX = mouseX;
        degree0[0] = degree0[0] + diffX1 / 5;

        var mouseY = canvas.height - event.clientY;
        var diffY2 = mouseY - prevMouseY;
        prevMouseY = mouseY;
        degree1[0] = degree1[0] - diffY2 / 5;

        drawScene();
    }

    if (
        event.layerX <= (canvas.width / 3) * 2 &&
        event.layerX >= canvas.width / 3 &&
        event.layerY <= canvas.height &&
        event.layerY >= 0
    ) {
        var mouseX = event.clientX;
        var diffX2 = mouseX - prevMouseX;
        prevMouseX = mouseX;
        degree0[1] = degree0[1] + diffX2 / 5;

        var mouseY = canvas.height - event.clientY;
        var diffY2 = mouseY - prevMouseY;
        prevMouseY = mouseY;
        degree1[1] = degree1[1] - diffY2 / 5;

        drawScene();
    }

    if (
        event.layerX <= canvas.width &&
        event.layerX >= (canvas.width / 3) * 2 &&
        event.layerY <= canvas.height &&
        event.layerY >= 0
    ) {
        var mouseX = event.clientX;
        var diffX3 = mouseX - prevMouseX;
        prevMouseX = mouseX;
        degree0[2] = degree0[2] + diffX3 / 5;

        var mouseY = canvas.height - event.clientY;
        var diffY2 = mouseY - prevMouseY;
        prevMouseY = mouseY;
        degree1[2] = degree1[2] - diffY2 / 5;

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
    canvas = document.getElementById("canvas1");
    document.addEventListener("mousedown", onMouseDown, false);

    // initialize WebGL
    initGL(canvas);


    initCubeBuffer();
    initSphereBuffer();


    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.SCISSOR_TEST);

    lightSlider = document.getElementById("lightSlider");
    lightSlider.addEventListener("input", lightSliderChanged);

    zoomSlider = document.getElementById("zoomSlider");
    zoomSlider.addEventListener("input", zoomSliderChanged);

    drawScene();
}


var lightSlider;
function lightSliderChanged() {
    var value = parseFloat(lightSlider.value);
    // console.log("Current slider value is", value);
    lightDeg = value;
    var A = 60;
    lightPos[2] = A*Math.cos(degToRad(lightDeg));
    lightPos[0] = A*Math.sin(degToRad(lightDeg));
    console.log(lightPos);
    drawScene();
}

var zoomSlider;
function zoomSliderChanged() {
    var value = parseFloat(zoomSlider.value);
    // console.log("Current slider value is", value);
    eyePos[2] = value;
    drawScene();
}
