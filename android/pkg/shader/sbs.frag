#version 300 es
#extension GL_OES_EGL_image_external_essl3 : require

precision highp float;

uniform samplerExternalOES uTexture;
uniform mat4 uSTMatrix;
uniform float uIsSBS;         // 1.0 = SBS enabled, 0.0 = standard mono
uniform float uSBSFormat;      // 0.0 = Horizontal (Left/Right), 1.0 = Vertical (Top/Bottom)
uniform float uInvertStereo;   // 0.0 = Left Eye, 1.0 = Right Eye

in vec2 vRawUv;
out vec4 fragColor;

void main() {
    vec2 uv = vRawUv;
    if (uIsSBS > 0.5) {
        float offset = uInvertStereo > 0.5 ? 0.5 : 0.0;
        if (uSBSFormat < 0.5) {
            // Horizontal SBS: Take half width and apply eye offset
            uv.x = uv.x * 0.5 + offset;
        } else {
            // Vertical SBS: Take half height and apply eye offset
            uv.y = uv.y * 0.5 + offset;
        }
    }
    // SurfaceTexture transformation maps [0, 1] video UV coordinates into texture coordinate space,
    // accounting for hardware decoder buffer cropping, stride alignment padding, and orientation.
    vec4 transformedUV = uSTMatrix * vec4(uv.x, uv.y, 0.0, 1.0);
    fragColor = texture(uTexture, transformedUV.xy);
}
