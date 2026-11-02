#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform mat4 uMVPMatrix;
out vec2 vUv;

void main() {
    // Invert V because Android SurfaceTexture places Y=0 at the top
    vUv = vec2(aTexCoord.x, 1.0 - aTexCoord.y);
    gl_Position = uMVPMatrix * vec4(aPosition, 1.0);
}
