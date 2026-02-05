export const yuvShaders = {
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D yTexture;
        uniform sampler2D uTexture;
        uniform sampler2D vTexture;

        void main() {
            float y = texture2D(yTexture, vUv).r;
            float u = texture2D(uTexture, vUv).r - 0.5;
            float v = texture2D(vTexture, vUv).r - 0.5;

            // BT.601 standard YUV to RGB conversion
            float r = y + 1.402 * v;
            float g = y - 0.344136 * u - 0.714136 * v;
            float b = y + 1.772 * u;

            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `
};
