var canvas;

var aPositionLocation;
var aTexCoordLocation;
var uColorLoc;

var sqbuf;
var sqindexBuf;
var sqtexBuf;

var imageMode;
var uimageModeLocation;
var imageType;
var uimageTypeLocation;
var contrast=0.0;
var uContrastLocation;
var brightness=1.0;
var uBrightnessLocation;
var processType;
var uProcessTypeLocation;
var imageSize;
var imageSizeLocation;

var light= [0.0, 10.0, 0.0];
var condition = 1;  
var bounce = 1;

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition,0.0,1.0);
  gl_PointSize = 3.0;
}`;


const fragShaderCode = `#version 300 es
precision mediump float;

out vec4 fragColor;
uniform vec3 light;
uniform int condition;
uniform int bounce;

struct Sphere {
    vec3 center;
    float radius;
    vec3 color;
};

struct Ray {
    vec3 origin;
    vec3 direction;
};

const int MAX_REFLECTION_DEPTH = 2;  // You can adjust this value based on your needs

// Define your spheres
Sphere spheres[4] = Sphere[4](
    Sphere(vec3(-1.8, 0, -2), 1.2, vec3(0.0, 1.0, 0.0)),  // Sphere 1
    Sphere(vec3(0.0, 0.5, -5), 2.3, vec3(1.0, 0.0, 0.0)),   // Sphere 2
    Sphere(vec3(1.8, 0, -2), 1.3, vec3(0.0, 0.0, 1.0)),      // Sphere 3
    Sphere(vec3(0, -21.5, 2), 20.0, vec3(1.0, 1.0, 1.0))    // Sphere 4
);
float shiningggMat[4] = float[4](20.0,10.0,50.0, 100.0);
bool quadSolver(float a, float b, float c, out float t0, out float t1)
{
    float discriminant = b*b - 4. *a*c;
    if (discriminant < 0.)
    {
      return false;
    } 
    if (discriminant == 0.)
    {
      t0 = t1 = -b / (2. * a);
      return true;
    }
    
    t0 = (-b + sqrt(discriminant)) / (2. * a);
    t1 = (-b - sqrt(discriminant)) / (2. * a);
    return true;    
}

// Function to perform ray-sphere intersection
float trace(Ray ray, Sphere sphere, out vec3 normal) {

    float a = dot(ray.direction,ray.direction);
    float b = 2.0 * dot(ray.direction, ray.origin - sphere.center);
    float c = dot(ray.origin - sphere.center, ray.origin - sphere.center) - sphere.radius * sphere.radius;
    float t0, t1;
    if (!quadSolver(a, b, c, t0, t1)) {
        return -1.0;
    }
    if (t0 > t1) {
        t0 = t0+t1;
        t1 = t0-t1;
        t0 = t0-t1;
    }
    if (t0 < 0.0) {
      t0 = t1; 
      if (t0 < 0.0) {
        return -1.0;
      }
    }
    float t = t0; 
    vec3 poi = ray.origin + t * ray.direction;
    normal = normalize(poi - sphere.center);
    return t;
}

// Function to calculate lighting
vec3 lightinggs(vec3 normal, vec3 dirOfView, vec3 lightDir, vec3 objectColor, float shinyy) {
    vec3 ambient = 0.3 * objectColor;
    vec3 diffuse = 0.5 * objectColor * max(dot(normal, lightDir), 0.0);
    vec3 reflectDir = reflect(-lightDir, normal);
    vec3 specular =1.0* vec3(1.0, 1.0, 1.0) * pow(max(dot(dirOfView, reflectDir), 0.0), shinyy);
    return ambient + diffuse + specular;
}

bool inwardShad(vec3 poi, vec3 lightDir) {
    vec3 normal;
    for (int i = 0; i < 4; ++i) {
        float t = trace(Ray(poi, lightDir), spheres[i], normal);
        if (t > 0.1) {
            return true;  // Point is in shadow
        }
    }
    return false;  // Point is not in shadow
}
void reflection(Ray ray, vec3 normal, int depth, out vec3 reflectedColor) {
  vec3 reflectionDir = ray.direction;
  Ray rr = ray;

  vec3 finalColor = vec3(0.0);
  vec3 currentColor = vec3(1.0);

  for (int i = 0; i < bounce; ++i) {
      float nearestIntersection = -1.0;
      vec3 nearestNormal = vec3(0.0);
      int hSIndex = -1;

      // Find the closest intersection for the reflected ray
      for (int j = 0; j < 4; ++j) {
        float t = trace(rr, spheres[j], nearestNormal);
        if (t > 0.01 && (nearestIntersection < 0.0 || t < nearestIntersection)) {
          nearestIntersection = t;
          nearestNormal = nearestNormal;
          hSIndex = j;
        }
      }

      // If no intersection, set background color
      if (nearestIntersection < 0.0) {
        reflectedColor = finalColor;
        return;
      } else {
        vec3 objectColor = spheres[hSIndex].color;
        float shinyy = shiningggMat[hSIndex];
        // Calculate lighting
        vec3 dirOfView = normalize(-rr.direction);
        vec3 point = rr.origin + nearestIntersection * rr.direction;
        vec3 lightDir = normalize(light - point);
        point = point -0.001*nearestNormal;
      
        vec3 FongColor = lightinggs(nearestNormal, dirOfView, lightDir, objectColor, shinyy);
        finalColor += currentColor * FongColor;

        // Update current color with object color for next iteration
        currentColor += objectColor;
        currentColor=normalize(currentColor);

        // Update the reflected ray for the next iteration
        rr.direction = reflect(rr.direction, nearestNormal);
        rr.origin = point - 0.01 * nearestNormal;
      }
  }

  reflectedColor = finalColor;
}

// Function to shade a pixel
vec4 shade(Ray ray) {
    vec3 normal;
    vec3 finalColor = vec3(0.0, 0.0, 0.0);

    float nearestIntersection = -1.0;
    vec3 nearestNormal = vec3(0.0);

    // Find the closest intersection
    for (int i = 0; i < 4; ++i) {
      float t = trace(ray, spheres[i], normal);
      if (t > 0.0 && (nearestIntersection < 0.0 || t < nearestIntersection)) {
        nearestIntersection = t;
        nearestNormal = normal; 
      }
    }

    // If no intersection, set background color
    if (nearestIntersection < 0.0) {
        return vec4(0.0, 0.0, 0., 1.0);  // Black color for no intersection
    } else {
        vec3 objectColor = spheres[0].color;  // Default to the color of the first sphere
        float shinyy = shiningggMat[0];
        // Find the color of the intersected sphere
        for (int i = 0; i < 4; ++i) {
            if (nearestIntersection == trace(ray, spheres[i], normal)) {
                objectColor = spheres[i].color;
                shinyy = shiningggMat[i];
                break;
            }
        }

        vec3 dirOfView = normalize(-ray.direction); 
        vec3 point = ray.origin + nearestIntersection * ray.direction;
        vec3 lightDir = normalize(light-point);
        vec3 neworigin = point +0.0002*normal;
    
        // Check for shadows
        bool shadowed = inwardShad(neworigin, lightDir);

        if (shadowed && (condition == 2 || condition == 4)) {
            return vec4(0.1, 0.1, 0.1, 1.0);  // Point is in shadow
        } else {
            vec3 FongColor = lightinggs(nearestNormal, dirOfView, lightDir, objectColor, shinyy);
            // now adding environment reflection using ray tracing
            vec3 reflectedDir = reflect(ray.direction, nearestNormal);
            Ray rr = Ray(neworigin , reflectedDir);
            vec3 reflectedColor = vec3(0.0, 0.0, 0.0);
            //calling reflection function
            reflection(rr, nearestNormal, 0, reflectedColor);
            if(condition == 3 || condition == 4)
            FongColor += 0.5*reflectedColor;
            finalColor = FongColor ;
        }
        return vec4(finalColor, 1.0);
    }
}

// Ray tracer code for a quad covering the entire screen
void main() {
    // Screen space coordinates in the range [-1, 1]
    vec2 canvasCoords = (gl_FragCoord.xy / vec2(450, 450)) * 2.0 - 1.0;
    vec3 rayDirection = normalize(vec3(canvasCoords, -1.0));

    // Calculate ray origin in view space
    vec3 originOfRay = vec3(0.0, 0.1, 1);

    Ray mainRay = Ray(originOfRay, rayDirection);

    // Output to screen
    fragColor = shade(mainRay);
}`;

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
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

function initSquareBuffer() {
  var vertices = [
    -1.5,
    -1.5,
    0.0, // bottom left
    1.5,
    -1.5,
    0.0, // bottom right
    1.5,
    1.5,
    0.0, // top right
    -1.5,
    1.5,
    0.0, // top left
  ];
  sqbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  sqbuf.itemSize = 3;
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

  color = [0.0, 0.0, 0.0, 1.0];
  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqindexBuf);
  
  gl.uniform4fv(uColorLoc, color);
  gl.uniform3fv(uLightLoc, light);
  gl.uniform1i(uConditionLoc, condition);
  gl.uniform1i(uBounceLoc, bounce);
  gl.drawElements(gl.TRIANGLES, sqindexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0.8, 0.8, 0.8, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  color = [0.0, 0.0, 0.0, 1.0];
  drawSquare(color);

}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("Assign5");
  
  initGL(canvas);
  shaderProgram = initShaders();
  
  //get locations of attributes declared in the vertex shader
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  uColorLoc = gl.getUniformLocation(shaderProgram, "color");
  uLightLoc = gl.getUniformLocation(shaderProgram, "light");
  uConditionLoc = gl.getUniformLocation(shaderProgram, "condition");
  uBounceLoc = gl.getUniformLocation(shaderProgram, "bounce");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);

  //initialize buffers for the square
  initSquareBuffer();
  
  var b_slider = document.getElementById('Bounce');
  b_slider.addEventListener('input', function () {
    var BounceValue = parseFloat(b_slider.value);
    console.log('Bounce value: ' + BounceValue);
    bounce = BounceValue;
    drawScene();
  });
  
    var l_slider = document.getElementById('Light');
    l_slider.addEventListener('input', function () {
      var LightValue = parseFloat(l_slider.value);
      console.log('Light value: ' + LightValue);
      light = [LightValue, 10.0, 0.0];
      drawScene();
    });
    
    var Fong = document.getElementById('Fong');
  Fong.addEventListener('click', function () {
    console.log('Fong');
    condition = 1;
    drawScene();
  });
    
    var FongShad = document.getElementById('FongShad');
    FongShad.addEventListener('click', function () {
      console.log('FongShad');
      condition = 2;
      drawScene();
  });

  var FongRef = document.getElementById('FongRef');
  FongRef.addEventListener('click', function () {
    console.log('FongRef');
    condition = 3;
    drawScene();
  });

  var FongShadRef = document.getElementById('FongShadRef');
  FongShadRef.addEventListener('click', function () {
    console.log('FongShadRef');
    condition = 4;
    drawScene();
  });
    
  drawScene();
}
