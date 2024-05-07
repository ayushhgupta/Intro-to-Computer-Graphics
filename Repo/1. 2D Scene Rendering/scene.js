var gl;
var color;
var matrixStack = [];

var mMatrix = mat4.create();
var uMMatrixLocation;

var circleBuf;
var circleIndexBuf;
var circleVerticesCount = 50;
var circleRadius = 0.5;

var sqVertexPositionBuffer;
var sqVertexIndexBuffer;

var aPositionLocation;
var uColorLoc;

var drawMode;

var animation;
var boatX = 0.0;
var boatY = 0.0;
var boatSpeed = 0.005;
var shineAngle = 0.0;

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
uniform mat4 uMMatrix;

void main() {
  gl_Position = uMMatrix*vec4(aPosition,0.0,1.0);
  gl_PointSize = 2.0;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform vec4 color;

void main() {
  fragColor = color;
}`;

function pushMatrix(stack, m) {
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
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

function initSquareBuffer() {
  // buffer for point locations
  const sqVertices = new Float32Array([
    0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  ]);
  sqVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
  sqVertexPositionBuffer.itemSize = 2;
  sqVertexPositionBuffer.numItems = 4;

  // buffer for point indices
  const sqIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  sqVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sqIndices, gl.STATIC_DRAW);
  sqVertexIndexBuffer.itemsize = 1;
  sqVertexIndexBuffer.numItems = 6;
}

function drawSquare(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    sqVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);

  gl.uniform4fv(uColorLoc, color);

  gl.drawElements(
    drawMode,
    sqVertexIndexBuffer.numItems,
    gl.UNSIGNED_SHORT,
    0
  );
}

function initTriangleBuffer() {
  const triangleVertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
  triangleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
  triangleBuf.itemSize = 2;
  triangleBuf.numItems = 3;

  const triangleIndices = new Uint16Array([0, 1, 2]);
  triangleIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW);
  triangleIndexBuf.itemsize = 1;
  triangleIndexBuf.numItems = 3;
}

function drawTriangle(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    triangleBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);

  gl.uniform4fv(uColorLoc, color);

  gl.drawElements(
    drawMode,
    triangleIndexBuf.numItems,
    gl.UNSIGNED_SHORT,
    0
  );
}

function initCircleBuffer() {
    const circleVerticesArray = [];

    for (let i = 0; i < circleVerticesCount; i++) {
			const angle1 = (i / circleVerticesCount) * 2 * Math.PI;
			const angle2 = ((i + 1) / circleVerticesCount) * 2 * Math.PI;
	
			const x1 = circleRadius * Math.cos(angle1);
			const y1 = circleRadius * Math.sin(angle1);
			const x2 = circleRadius * Math.cos(angle2);
			const y2 = circleRadius * Math.sin(angle2);
	
			circleVerticesArray.push(0.0, 0.0, x1, y1, x2, y2);
    }

    const circleVertices = new Float32Array(circleVerticesArray);

    circleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, circleVertices, gl.STATIC_DRAW);

    circleBuf.itemSize = 2;
    circleBuf.numItems = circleVerticesCount * 3;
}

function drawCircle(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.vertexAttribPointer(aPositionLocation, circleBuf.itemSize, gl.FLOAT, false, 0, 0);

    gl.uniform4fv(uColorLoc, color);

    gl.drawArrays(drawMode, 0, circleBuf.numItems);
}

////////////////////////////////////////////////////////////////////////
function drawHouse() {
		pushMatrix(matrixStack, mMatrix); 
		mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0]);
		pushMatrix(matrixStack, mMatrix); 
		mMatrix = mat4.scale(mMatrix, [1, 0.5, 0]);
		color = [1, 1, 0.8, 1];
		drawSquare(color, mMatrix); //base
		mMatrix = popMatrix(matrixStack); 
		pushMatrix(matrixStack, mMatrix); 
		mMatrix = mat4.translate(mMatrix, [0.0, -0.1, 0]);
		mMatrix = mat4.scale(mMatrix, [0.16, 0.3, 0]);
		color = [1, 0.65, 0, 1];
		drawSquare(color, mMatrix); //door
		mMatrix = popMatrix(matrixStack); 

		mMatrix = mat4.translate(mMatrix, [0.0, 0.05, 0]);
		pushMatrix(matrixStack, mMatrix); 
		mMatrix = mat4.translate(mMatrix, [-0.28, 0, 0]);
		mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 0]);
		drawSquare(color, mMatrix); //win1
		mMatrix = popMatrix(matrixStack); 
		mMatrix = mat4.translate(mMatrix, [0.28, 0, 0]);
		mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 0]);
		drawSquare(color, mMatrix); //win2

		mMatrix = popMatrix(matrixStack); 
		mMatrix = mat4.translate(mMatrix, [0.0, -0.05, 0]);
		pushMatrix(matrixStack, mMatrix); 
		mMatrix = mat4.scale(mMatrix, [0.8, 0.42, 0]);
		color = [1, 0.3, 0, 1];
		drawSquare(color, mMatrix); //roof centre
		mMatrix = popMatrix(matrixStack); 
		mMatrix = mat4.scale(mMatrix, [0.5, 0.42, 0]);
		mMatrix = mat4.translate(mMatrix, [-0.8, 0, 0]);
		drawTriangle(color, mMatrix); //roof left
		mMatrix = mat4.translate(mMatrix, [1.6, 0, 0]);
		drawTriangle(color, mMatrix);


}

function drawCar() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, -0.26, 0]);
	mMatrix = mat4.scale(mMatrix, [0.6, 0.24, 1]);
	color = [1, 0.5, 0, 1];
	drawSquare(color, mMatrix);
	mMatrix = mat4.scale(mMatrix, [0.4, 1, 1]);
	mMatrix = mat4.translate(mMatrix, [-1.25, 0, 0]);
	drawTriangle(color, mMatrix);
	mMatrix = mat4.translate(mMatrix, [2.5, 0, 0]);
	drawTriangle(color, mMatrix);
	mMatrix = popMatrix(matrixStack);

	// TYRES - left
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 1]);
	mMatrix = mat4.translate(mMatrix, [-1.2, -2.7, 0]);
	pushMatrix(matrixStack, mMatrix);
	color = [0,0,0,1];
	drawCircle(color, mMatrix);
	mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1]);
	color = [0.6,0.6,0.6,1];
	drawCircle(color, mMatrix);

	// TYRES - right
	mMatrix = popMatrix(matrixStack);
	mMatrix = mat4.translate(mMatrix, [2.4, 0, 0]);
	color = [0,0,0,1];
	drawCircle(color, mMatrix);
	mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1]);
	color = [0.6,0.6,0.6,1];
	drawCircle(color, mMatrix);
	mMatrix = popMatrix(matrixStack);

	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0]);
	mMatrix = mat4.scale(mMatrix, [1, 0.25, 1]);
	color = [0, 0, 1, 1];
	drawSquare(color, mMatrix);
	mMatrix = mat4.scale(mMatrix, [0.4, 1, 1]);
	mMatrix = mat4.translate(mMatrix, [-1.25, 0, 0]);
	drawTriangle(color, mMatrix);
	mMatrix = mat4.translate(mMatrix, [2.5, 0, 0]);
	drawTriangle(color, mMatrix);
	mMatrix = popMatrix(matrixStack);	
}

function drawSunShine() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, 0.0, 0]);
	mMatrix = mat4.scale(mMatrix, [0.04, 1.5, 1]);
	drawSquare(color,mMatrix);
	mMatrix = popMatrix(matrixStack);
}

function drawSun(shineAngle = 0) {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-0.65, 0.77, 0]);
	mMatrix = mat4.scale(mMatrix, [0.25, 0.25, 1]);
	color = [1, 1, 0, 1.0];
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.rotate(mMatrix, degToRad(shineAngle), [0, 0, 1]);
	drawSunShine();
	mMatrix = mat4.rotate(mMatrix, degToRad(45), [0, 0, 1]);
	drawSunShine();
	mMatrix = mat4.rotate(mMatrix, degToRad(45), [0, 0, 1]);
	drawSunShine();
	mMatrix = mat4.rotate(mMatrix, degToRad(45), [0, 0, 1]);
	drawSunShine();
	mMatrix = popMatrix(matrixStack);
	drawCircle(color,mMatrix);
	mMatrix = popMatrix(matrixStack);
}

function drawTree() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, -0.48, 0]);
	mMatrix = mat4.scale(mMatrix, [0.08, 0.5, 1]);
	color = [0.5, 0.3, 0, 1];
	drawSquare(color, mMatrix);
	mMatrix = popMatrix(matrixStack);

	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, 0.05, 0]);
	mMatrix = mat4.scale(mMatrix, [0.8, 0.6, 1]);
	color = [0.2, 0.5, 0, 1];
	drawTriangle(color, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, 0.18, 0]);
	mMatrix = mat4.scale(mMatrix, [1.1, 1, 1]);
	color = [0.3, 0.7, 0, 1];
	drawTriangle(color, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, 0.18, 0]);
	mMatrix = mat4.scale(mMatrix, [1.05, 1, 1]);
	color = [0.5, 0.8, 0, 1];
	drawTriangle(color, mMatrix);
	mMatrix = popMatrix(matrixStack);
}

function drawMountain() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-0.05, 0.0, 0]);
	mMatrix = mat4.scale(mMatrix, [1.8, 0.55, 1]);
	color = [0.5, 0.3, 0, 1];
	drawTriangle(color, mMatrix);
	mMatrix = mat4.scale(mMatrix, [1/1.8, 1/0.6, 1]);

	mMatrix = mat4.rotate(mMatrix, degToRad(8), [0, 0, 1]);
	mMatrix = mat4.translate(mMatrix, [0.045, -0.003, 0]);
	mMatrix = mat4.scale(mMatrix, [1.8, 0.6, 1]);
	color = [180/255, 140/255, 80/255, 1];
	drawTriangle(color, mMatrix);
	
	mMatrix = popMatrix(matrixStack);
}

function drawBird() {
	pushMatrix(matrixStack, mMatrix);

	mMatrix = mat4.translate(mMatrix, [0.0, 0.5, 0]);
	mMatrix = mat4.scale(mMatrix, [0.015, 0.02, 1]);
	color = [0.0, 0.0, 0.0, 1.0];
	drawSquare(color,mMatrix);
	mMatrix = mat4.rotate(mMatrix, degToRad(-8), [0, 0, 1]);
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-2, 0.6, 0]);
	mMatrix = mat4.scale(mMatrix, [5, 0.6, 1]);
	drawTriangle(color,mMatrix);
	mMatrix = popMatrix(matrixStack);
	mMatrix = mat4.rotate(mMatrix, degToRad(8), [0, 0, 1]);
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [2, 0.6, 0]);
	mMatrix = mat4.scale(mMatrix, [5, 0.6, 1]);
	drawTriangle(color,mMatrix);
	mMatrix = popMatrix(matrixStack);

	mMatrix = popMatrix(matrixStack);

}

function drawCloud() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-0.9, 0.45, 0]);
	mMatrix = mat4.scale(mMatrix, [0.4, 0.2, 1]);

	color = [1, 1, 1, 1.0];
	drawCircle(color,mMatrix);

	mMatrix = mat4.translate(mMatrix, [0.5, -0.16, 0]);
	mMatrix = mat4.scale(mMatrix, [0.6, 0.8, 1]);
	drawCircle(color,mMatrix);

	mMatrix = mat4.translate(mMatrix, [0.6, 0.0, 0]);
	mMatrix = mat4.scale(mMatrix, [0.6, 0.6, 1]);
	drawCircle(color,mMatrix);

	mMatrix = popMatrix(matrixStack);
}

function drawBirds() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, 0.2, 0]);
	drawBird();
	mMatrix = mat4.translate(mMatrix, [0.2, 0.1, 0]);
	mMatrix = mat4.rotate(mMatrix, degToRad(-5), [0, 0, 1]);
	mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1]);
	drawBird();
	mMatrix = mat4.translate(mMatrix, [-0.1, 0.05, 0]);
	mMatrix = mat4.rotate(mMatrix, degToRad(10), [0, 0, 1]);
	mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1]);
	drawBird();
	mMatrix = mat4.translate(mMatrix, [-0.5, -0.4, 0]);
	mMatrix = mat4.rotate(mMatrix, degToRad(0), [0, 0, 1]);
	mMatrix = mat4.scale(mMatrix, [2, 1.5, 1]);
	drawBird();

	mMatrix = popMatrix(matrixStack);
}

function drawGrass() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, -0.5, 0]);
	mMatrix = mat4.scale(mMatrix, [2, 1, 1]);
	color = [0.0, 1, 0, 1.0];
	drawSquare(color,mMatrix);
	mMatrix = popMatrix(matrixStack);
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.3, -0.6, 0]);
	mMatrix = mat4.rotate(mMatrix, degToRad(53), [0, 0, 1]);
	mMatrix = mat4.translate(mMatrix, [0.0, -0.1, 0]);
	mMatrix = mat4.scale(mMatrix, [1*1.2, 1.4*1.2, 1]);


	color = [0.5, 0.7, 0, 1.0];
	drawTriangle(color,mMatrix);
	mMatrix = popMatrix(matrixStack);
}

function drawBush() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-0.28, -0.55, 0]);
	mMatrix = mat4.scale(mMatrix, [0.14, 0.12, 1]);

	color = [0, 0.4, 0, 1.0];
	drawCircle(color,mMatrix);

	mMatrix = mat4.translate(mMatrix, [1.35, 0.0, 0]);
	mMatrix = mat4.scale(mMatrix, [0.9, 1, 1]);

	color = [0, 0.5, 0, 1.0];
	drawCircle(color,mMatrix);

	mMatrix = mat4.translate(mMatrix, [-0.8, 0.1, 0]);
	mMatrix = mat4.scale(mMatrix, [1.5, 1.3, 1]);

	color = [0, 0.7, 0, 1.0];
	drawCircle(color,mMatrix);

	mMatrix = popMatrix(matrixStack);
}

function drawBushes() {
	pushMatrix(matrixStack, mMatrix);
	drawBush();

	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-0.75, -0.14, 0]);
	mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1]);
	drawBush();
	mMatrix = popMatrix(matrixStack);

	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [1.1, 0.0, 0]);
	mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1]);
	drawBush();
	mMatrix = popMatrix(matrixStack);

	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.3, -0.3, 0]);
	mMatrix = mat4.scale(mMatrix, [2, 1.3, 1]);
	drawBush();
	mMatrix = popMatrix(matrixStack);


	mMatrix = popMatrix(matrixStack);
}

function drawRiver() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0, -0.155, 0]);
	mMatrix = mat4.scale(mMatrix, [2, 0.22, 1]);
	color = [0.0, 0.4, 1.0, 1];
	drawSquare(color,mMatrix);

	color = [1, 1, 1, 1.0];
	mMatrix = mat4.scale(mMatrix, [0.2,0.03, 1]);
	mMatrix = mat4.translate(mMatrix, [-1.8, 0.0, 0]);
	drawSquare(color,mMatrix);
	mMatrix = mat4.translate(mMatrix, [1.8, 8, 0]);
	drawSquare(color,mMatrix);
	mMatrix = mat4.translate(mMatrix, [1.8, -16, 0]);
	drawSquare(color,mMatrix);


	mMatrix = popMatrix(matrixStack);
}

function drawBoat() {
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-0.12, -0.16, 0]);
	color = [0, 0, 0, 1];

	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0, 0.13, 0]);
	pushMatrix(matrixStack, mMatrix);
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.rotate(mMatrix, degToRad(-25), [0, 0, 1,]);
	mMatrix = mat4.translate(mMatrix, [-0.05, -0.03, 0]);
	mMatrix = mat4.scale(mMatrix, [0.003, 0.25, 1]);
	drawSquare(color, mMatrix);
	mMatrix = popMatrix(matrixStack);
	mMatrix = mat4.scale(mMatrix, [0.01, 0.25, 1]);
	drawSquare(color, mMatrix);
	mMatrix = popMatrix(matrixStack);
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.translate(mMatrix, [0.0975, 0.018, 0]);
	mMatrix = mat4.scale(mMatrix, [0.18,0.2, 1]);
	mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0, 0, 1]);
	color = [1, 0.0, 0, 1];
	drawTriangle(color, mMatrix);
	mMatrix = popMatrix(matrixStack);
	mMatrix = popMatrix(matrixStack);

	color = [0.8, 0.8, 0.8, 1];
	mMatrix = mat4.scale(mMatrix, [0.2, 0.055, 1]);

	drawSquare(color, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-0.5, 0.0, 0]);
	mMatrix	= mat4.scale(mMatrix, [0.2, 1, 1]);
	mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
	drawTriangle(color, mMatrix);
	mMatrix = mat4.translate(mMatrix, [-5, 0.0, 0]);
	drawTriangle(color, mMatrix);
	mMatrix = popMatrix(matrixStack);
}

function drawWing(wingAngle = 0) {
	pushMatrix(matrixStack, mMatrix);

	mMatrix = mat4.rotate(mMatrix, degToRad(wingAngle), [0, 0, 1]);
	mMatrix = mat4.scale(mMatrix, [0.06, 0.7, 1]);

	color = [218/255, 195/255, 32/255, 1.0];
	drawTriangle(color,mMatrix);

	mMatrix = popMatrix(matrixStack);
}

function drawWindmill(wingAngle = 0) {
	pushMatrix(matrixStack, mMatrix);

	mMatrix = mat4.translate(mMatrix, [0.0, 0.0, 0]);
	pushMatrix(matrixStack, mMatrix);
	mMatrix = mat4.scale(mMatrix, [0.03, 0.7, 1]);
	color = [0, 0, 0, 1.0];
	drawSquare(color,mMatrix);
	mMatrix = popMatrix(matrixStack);

	mMatrix = mat4.translate(mMatrix, [0.0, 0.35, 0]);

	pushMatrix(matrixStack, mMatrix);
	drawWing(wingAngle);
	drawWing(wingAngle+90);	
	drawWing(wingAngle+180);
	drawWing(wingAngle+270);
	mMatrix = popMatrix(matrixStack);

	mMatrix = mat4.scale(mMatrix, [0.08, 0.08, 1]);
	color = [0, 0, 0, 1.0];
	drawCircle(color,mMatrix);
	mMatrix = popMatrix(matrixStack);
}

function abs(x){
	if (x < 0) return -x;
	return x;
}
function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

	if (animation) {
    window.cancelAnimationFrame(animation);
  }

  var animate = function () {
    

		gl.clearColor(0.9, 0.9, 0.9, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// initialize the model matrix to identity matrix
		mat4.identity(mMatrix);

		shineAngle += 0.8;

		if(abs(boatX) > 1) boatSpeed = -abs(boatX)/boatX * abs(boatSpeed);
		boatX += boatSpeed;
		boatY = 0.035 * Math.sin(boatX * 7);


		// Sky
		pushMatrix(matrixStack, mMatrix);
		mMatrix = mat4.translate(mMatrix, [0.0, 0.5, 0]);
		mMatrix = mat4.scale(mMatrix, [2, 1, 1]);
		color = [0.0, 1, 1, 1.0];
		drawSquare(color,mMatrix);
		mMatrix = popMatrix(matrixStack);

		// Sun
		drawSun(shineAngle);

		// Clouds
		drawCloud();

		// Birds
		drawBirds();

		// Mountain
		pushMatrix(matrixStack, mMatrix);
		mMatrix = mat4.translate(mMatrix, [-0.65, -0.05, 0]);
		mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1]);
		drawMountain();
		mMatrix = mat4.translate(mMatrix, [1.8, 0.0, 0]);
		drawMountain();
		mMatrix = popMatrix(matrixStack);
		pushMatrix(matrixStack, mMatrix);
		drawMountain();
		mMatrix = popMatrix(matrixStack);

		// Grass
		drawGrass();

		// Trees
		pushMatrix(matrixStack, mMatrix);
		mMatrix = mat4.translate(mMatrix, [0.8, 0.35, 0.0]);
		mMatrix = mat4.scale(mMatrix, [0.4, 0.5, 0]);
		drawTree();
		mMatrix = mat4.translate(mMatrix, [-0.6, 0.1, 0.0]);
		mMatrix = mat4.scale(mMatrix, [1.2, 1.2, 0]);
		drawTree();
		mMatrix = mat4.translate(mMatrix, [-0.6, -0.12, 0.0]);
		mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 0]);
		drawTree();
		mMatrix = popMatrix(matrixStack);

		// River
		drawRiver();

		// Boat
		pushMatrix(matrixStack, mMatrix);
		mMatrix = mat4.translate(mMatrix, [boatX, boatY, 0.0]);
		drawBoat();
		mMatrix = popMatrix(matrixStack);

		// Windmill
		pushMatrix(matrixStack, mMatrix);
		mMatrix = mat4.translate(mMatrix, [0.55, -0.1, 0]);
		drawWindmill(shineAngle);
		mMatrix = mat4.translate(mMatrix, [-1.2, -0.12, 0]);
		drawWindmill(shineAngle);
		mMatrix = popMatrix(matrixStack);

		// Bushes
		drawBushes();

		// House
		pushMatrix(matrixStack, mMatrix);
		mMatrix = mat4.translate(mMatrix, [-0.55, -0.25, 0.0]);
		mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 0]);
		drawHouse();
		mMatrix = popMatrix(matrixStack);

		// Car
		pushMatrix(matrixStack, mMatrix);
		mMatrix = mat4.translate(mMatrix, [-0.35, -0.59, 0.0]);
		mMatrix = mat4.scale(mMatrix, [0.37, 0.37, 0]);
		drawCar();
		mMatrix = popMatrix(matrixStack);

    animation = window.requestAnimationFrame(animate);

	}

	animate();

}

function mode(num) {
	switch(num) {
		case 1:
			drawMode = gl.POINTS;
			break;
		case 2:
			drawMode = gl.LINE_LOOP;
			break;
		case 3:
			drawMode = gl.TRIANGLES;
			break;
	}
	drawScene();
}

// This is the entry point from the html
function webGLStart() {
  var canvas = document.getElementById("scene");
  initGL(canvas);
  shaderProgram = initShaders();

  //get locations of attributes declared in the vertex shader
  const aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");

  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);

  uColorLoc = gl.getUniformLocation(shaderProgram, "color");

  initSquareBuffer();
  initTriangleBuffer();
  initCircleBuffer();

	drawMode = gl.TRIANGLES;
  drawScene();
}
