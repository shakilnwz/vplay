export type ViewMode = 'flat' | '360' | '180' | 'fisheye';

interface WebGLRendererOptions {
    canvas: HTMLCanvasElement;
    video: HTMLVideoElement;
    viewMode: ViewMode;
    isSBS: boolean;
    sbsFormat: 'horizontal' | 'vertical';
    invertStereo: boolean;
    gyroEnabled: boolean;
    videoWidth?: number;
    videoHeight?: number;
}

export class WebGLRenderer {
    private gl: WebGL2RenderingContext;
    private video: HTMLVideoElement;
    private program: WebGLProgram;
    
    // Shader Uniform Locations
    private uProjectionMatrixLoc: WebGLUniformLocation | null = null;
    private uViewMatrixLoc: WebGLUniformLocation | null = null;
    private uIsSBSLoc: WebGLUniformLocation | null = null;
    private uSbsFormatLoc: WebGLUniformLocation | null = null;
    private uInvertStereoLoc: WebGLUniformLocation | null = null;
    
    // WebGL Buffers
    private positionBuffer: WebGLBuffer | null = null;
    private uvBuffer: WebGLBuffer | null = null;
    private indexBuffer: WebGLBuffer | null = null;
    private texture: WebGLTexture | null = null;
    private vao: WebGLVertexArrayObject | null = null;
    
    // Options
    private viewMode: ViewMode;
    private isSBS: boolean;
    private sbsFormat: 'horizontal' | 'vertical';
    private invertStereo: boolean;
    private gyroEnabled: boolean;
    private videoWidth = 16;
    private videoHeight = 9;
    
    // Camera / Rotation State
    public rotation = { x: 0, y: 0, z: 0 };
    public targetRotation = { x: 0, y: 0, z: 0 };
    public fov = 75;
    
    // Gyroscope Calibration State
    private gyroOffset = { x: 0, y: 0, z: 0 };
    private gyroBase = { x: 0, y: 0, z: 0 };
    private gyroInitialized = false;
    
    // Geometry Details
    private indexCount = 0;
    private isDragging = false;
    private previousMousePosition = { x: 0, y: 0 };
    private touchStartDistance: number | null = null;
    private touchStartAngle: number | null = null;
    private initialFov = 75;
    private initialRoll = 0;
    
    // Animation
    private animationFrameId: number | null = null;
    private lastTime = 0;

    constructor(options: WebGLRendererOptions) {
        const gl = options.canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
        if (!gl) throw new Error('WebGL2 not supported');
        this.gl = gl;
        this.video = options.video;
        
        this.viewMode = options.viewMode;
        this.isSBS = options.isSBS;
        this.sbsFormat = options.sbsFormat;
        this.invertStereo = options.invertStereo;
        this.gyroEnabled = options.gyroEnabled;
        if (options.videoWidth) this.videoWidth = options.videoWidth;
        if (options.videoHeight) this.videoHeight = options.videoHeight;
        
        this.program = this.initShaderProgram();
        this.getUniformLocations();
        this.setupVertexArray();
        this.setupTexture();
        this.updateGeometry();
        this.bindEvents();
        
        // Start Render Loop
        this.render = this.render.bind(this);
        this.animationFrameId = requestAnimationFrame(this.render);
    }

    private initShaderProgram(): WebGLProgram {
        const vsSource = `#version 300 es
            in vec3 position;
            in vec2 uv;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uViewMatrix;
            out vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = uProjectionMatrix * uViewMatrix * vec4(position, 1.0);
            }
        `;

        const fsSource = `#version 300 es
            precision highp float;
            in vec2 vUv;
            uniform sampler2D uTexture;
            uniform float uIsSBS;
            uniform float uSbsFormat; // 0 = Horizontal, 1 = Vertical
            uniform float uInvertStereo;
            out vec4 fragColor;
            void main() {
                vec2 uv = vUv;
                if (uIsSBS > 0.5) {
                    if (uSbsFormat < 0.5) {
                        float offset = uInvertStereo > 0.5 ? 0.5 : 0.0;
                        uv.x = uv.x * 0.5 + offset;
                    } else {
                        float offset = uInvertStereo > 0.5 ? 0.0 : 0.5;
                        uv.y = uv.y * 0.5 + offset;
                    }
                }
                fragColor = texture(uTexture, uv);
            }
        `;

        const vs = this.compileShader(vsSource, this.gl.VERTEX_SHADER);
        const fs = this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);
        
        const program = this.gl.createProgram();
        if (!program) throw new Error('Failed to create WebGL program');
        
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Link error: ' + this.gl.getProgramInfoLog(program));
        }
        
        return program;
    }

    private compileShader(source: string, type: number): WebGLShader {
        const shader = this.gl.createShader(type);
        if (!shader) throw new Error('Shader creation failed');
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error('Shader compile error: ' + info);
        }
        return shader;
    }

    private getUniformLocations() {
        this.uProjectionMatrixLoc = this.gl.getUniformLocation(this.program, 'uProjectionMatrix');
        this.uViewMatrixLoc = this.gl.getUniformLocation(this.program, 'uViewMatrix');
        this.uIsSBSLoc = this.gl.getUniformLocation(this.program, 'uIsSBS');
        this.uSbsFormatLoc = this.gl.getUniformLocation(this.program, 'uSbsFormat');
        this.uInvertStereoLoc = this.gl.getUniformLocation(this.program, 'uInvertStereo');
    }

    private setupVertexArray() {
        this.vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.vao);
        
        this.positionBuffer = this.gl.createBuffer();
        this.uvBuffer = this.gl.createBuffer();
        this.indexBuffer = this.gl.createBuffer();
        
        const posAttr = this.gl.getAttribLocation(this.program, 'position');
        const uvAttr = this.gl.getAttribLocation(this.program, 'uv');
        
        // Position Attribute Setup
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(posAttr);
        this.gl.vertexAttribPointer(posAttr, 3, this.gl.FLOAT, false, 0, 0);
        
        // UV Attribute Setup
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
        this.gl.enableVertexAttribArray(uvAttr);
        this.gl.vertexAttribPointer(uvAttr, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindVertexArray(null);
    }

    private setupTexture() {
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }

    public updateSettings(settings: {
        viewMode?: ViewMode;
        isSBS?: boolean;
        sbsFormat?: 'horizontal' | 'vertical';
        invertStereo?: boolean;
        gyroEnabled?: boolean;
        videoWidth?: number;
        videoHeight?: number;
    }) {
        let geomNeedsUpdate = false;
        if (settings.viewMode !== undefined && this.viewMode !== settings.viewMode) {
            this.viewMode = settings.viewMode;
            geomNeedsUpdate = true;
        }
        if (settings.videoWidth !== undefined && this.videoWidth !== settings.videoWidth) {
            this.videoWidth = settings.videoWidth;
            geomNeedsUpdate = true;
        }
        if (settings.videoHeight !== undefined && this.videoHeight !== settings.videoHeight) {
            this.videoHeight = settings.videoHeight;
            geomNeedsUpdate = true;
        }
        if (settings.isSBS !== undefined) this.isSBS = settings.isSBS;
        if (settings.sbsFormat !== undefined) this.sbsFormat = settings.sbsFormat;
        if (settings.invertStereo !== undefined) this.invertStereo = settings.invertStereo;
        if (settings.gyroEnabled !== undefined) this.gyroEnabled = settings.gyroEnabled;

        if (geomNeedsUpdate) {
            this.updateGeometry();
        }
    }

    private updateGeometry() {
        let vertices: Float32Array;
        let uvs: Float32Array;
        let indices: Uint16Array;

        if (this.viewMode === 'flat') {
            const aspect = this.videoWidth / this.videoHeight || 16/9;
            const halfW = 4.5 * aspect;
            const halfH = 4.5;
            vertices = new Float32Array([
                -halfW,  halfH, -10,
                -halfW, -halfH, -10,
                 halfW, -halfH, -10,
                 halfW,  halfH, -10
            ]);
            uvs = new Float32Array([
                0, 1,
                0, 0,
                1, 0,
                1, 1
            ]);
            indices = new Uint16Array([
                0, 1, 2,
                0, 2, 3
            ]);
        } else {
            // Sphere Geometry
            const radius = 500;
            const widthSegments = 60;
            const heightSegments = 40;
            
            const phiStart = this.viewMode === '180' ? Math.PI : 0;
            const phiLength = this.viewMode === '180' ? Math.PI : Math.PI * 2;
            const thetaStart = 0;
            const thetaLength = Math.PI;

            const posArr: number[] = [];
            const uvArr: number[] = [];
            const indArr: number[] = [];

            for (let y = 0; y <= heightSegments; y++) {
                const v = y / heightSegments;
                const theta = thetaStart + v * thetaLength;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);

                for (let x = 0; x <= widthSegments; x++) {
                    const u = x / widthSegments;
                    const phi = phiStart + u * phiLength;
                    const sinPhi = Math.sin(phi);
                    const cosPhi = Math.cos(phi);

                    // Render sphere from inside (X corrected)
                    const px = radius * cosPhi * sinTheta;
                    const py = radius * cosTheta;
                    const pz = radius * sinPhi * sinTheta;

                    posArr.push(px, py, pz);
                    uvArr.push(u, 1.0 - v);
                }
            }

            for (let y = 0; y < heightSegments; y++) {
                for (let x = 0; x < widthSegments; x++) {
                    const first = y * (widthSegments + 1) + x;
                    const second = first + widthSegments + 1;
                    indArr.push(first, second, first + 1);
                    indArr.push(second, second + 1, first + 1);
                }
            }

            vertices = new Float32Array(posArr);
            uvs = new Float32Array(uvArr);
            indices = new Uint16Array(indArr);
        }

        this.indexCount = indices.length;
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, uvs, this.gl.STATIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
    }

    public resetView() {
        this.rotation.x = 0; this.rotation.y = 0; this.rotation.z = 0;
        this.targetRotation.x = 0; this.targetRotation.y = 0; this.targetRotation.z = 0;
        this.gyroInitialized = false;
        this.gyroBase.x = 0; this.gyroBase.y = 0; this.gyroBase.z = 0;
        this.fov = 75;
    }

    private bindEvents() {
        const canvas = this.gl.canvas as HTMLCanvasElement;
        
        // Mouse Input
        canvas.addEventListener('mousedown', this.handleMouseDown);
        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mouseup', this.handleMouseUp);
        
        // Touch Input
        canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd);
        
        // Gyro
        window.addEventListener('deviceorientation', this.handleOrientation);
    }

    private eulerToQuaternionYXZ(x: number, y: number, z: number) {
        const c1 = Math.cos(x / 2);
        const s1 = Math.sin(x / 2);
        const c2 = Math.cos(y / 2);
        const s2 = Math.sin(y / 2);
        const c3 = Math.cos(z / 2);
        const s3 = Math.sin(z / 2);

        return {
            x: s1 * c2 * c3 + c1 * s2 * s3,
            y: c1 * s2 * c3 - s1 * c2 * s3,
            z: c1 * c2 * s3 - s1 * s2 * c3,
            w: c1 * c2 * c3 + s1 * s2 * s3
        };
    }

    private quaternionMultiply(
        q1: { x: number; y: number; z: number; w: number },
        q2: { x: number; y: number; z: number; w: number }
    ) {
        return {
            x: q1.x * q2.w + q1.w * q2.x + q1.y * q2.z - q1.z * q2.y,
            y: q1.y * q2.w + q1.w * q2.y + q1.z * q2.x - q1.x * q2.z,
            z: q1.z * q2.w + q1.w * q2.z + q1.x * q2.y - q1.y * q2.x,
            w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
        };
    }

    private quaternionToEulerYXZ(q: { x: number; y: number; z: number; w: number }) {
        const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
        
        const m23 = 2 * (q.y * q.z - q.w * q.x);
        const m13 = 2 * (q.x * q.z + q.w * q.y);
        const m33 = 1 - 2 * (q.x * q.x + q.y * q.y);
        const m21 = 2 * (q.x * q.y + q.w * q.z);
        const m22 = 1 - 2 * (q.x * q.x + q.z * q.z);
        const m31 = 2 * (q.x * q.z - q.w * q.y);
        const m11 = 1 - 2 * (q.y * q.y + q.z * q.z);

        let x = 0, y = 0, z = 0;
        x = Math.asin(-clamp(m23, -1, 1));

        if (Math.abs(m23) < 0.99999) {
            y = Math.atan2(m13, m33);
            z = Math.atan2(m21, m22);
        } else {
            y = Math.atan2(-m31, m11);
            z = 0;
        }

        return { x, y, z };
    }

    private handleMouseDown = (e: MouseEvent) => {
        this.isDragging = true;
        this.previousMousePosition.x = e.clientX;
        this.previousMousePosition.y = e.clientY;
        this.gyroBase.x = this.targetRotation.x;
        this.gyroBase.y = this.targetRotation.y;
        this.gyroBase.z = this.targetRotation.z;
        this.gyroInitialized = false;
    };

    private handleMouseMove = (e: MouseEvent) => {
        if (!this.isDragging) return;
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;
        this.targetRotation.y -= deltaX * 0.005;
        this.targetRotation.x -= deltaY * 0.005;
        this.previousMousePosition.x = e.clientX;
        this.previousMousePosition.y = e.clientY;
    };

    private handleMouseUp = () => {
        this.isDragging = false;
    };

    private handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.previousMousePosition.x = e.touches[0].clientX;
            this.previousMousePosition.y = e.touches[0].clientY;
            this.gyroBase.x = this.targetRotation.x;
            this.gyroBase.y = this.targetRotation.y;
            this.gyroBase.z = this.targetRotation.z;
            this.gyroInitialized = false;
        } else if (e.touches.length === 2) {
            e.preventDefault();
            this.isDragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            this.touchStartDistance = Math.sqrt(dx * dx + dy * dy);
            this.touchStartAngle = Math.atan2(dy, dx);
            this.initialFov = this.fov;
            this.initialRoll = this.targetRotation.z;
        }
    };

    private handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1 && this.isDragging) {
            const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
            const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
            this.targetRotation.y -= deltaX * 0.005;
            this.targetRotation.x -= deltaY * 0.005;
            this.previousMousePosition.x = e.touches[0].clientX;
            this.previousMousePosition.y = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDist = Math.sqrt(dx * dx + dy * dy);
            
            if (this.touchStartDistance) {
                const scale = this.touchStartDistance / currentDist;
                this.fov = Math.max(30, Math.min(110, this.initialFov * scale));
            }
            
            const currentAngle = Math.atan2(dy, dx);
            if (this.touchStartAngle !== null) {
                this.targetRotation.z = this.initialRoll + (currentAngle - this.touchStartAngle);
            }
        }
    };

    private handleTouchEnd = () => {
        this.isDragging = false;
        this.touchStartDistance = null;
        this.touchStartAngle = null;
    };

    private handleOrientation = (event: DeviceOrientationEvent) => {
        if (!this.gyroEnabled || this.isDragging) return;

        const degToRad = Math.PI / 180;
        const alpha = event.alpha ? event.alpha * degToRad : 0;
        const beta = event.beta ? event.beta * degToRad : 0;
        const gamma = event.gamma ? event.gamma * degToRad : 0;

        let screenAngle = 0;
        if (window.screen && window.screen.orientation) {
            screenAngle = window.screen.orientation.angle * degToRad;
        } else if ('orientation' in window) {
            screenAngle = (window as unknown as { orientation: number }).orientation * degToRad;
        }

        const qDevice = this.eulerToQuaternionYXZ(beta, alpha, -gamma);

        const cosS = Math.cos(-screenAngle / 2);
        const sinS = Math.sin(-screenAngle / 2);
        const qScreen = { x: 0, y: 0, z: sinS, w: cosS };

        const qCombined = this.quaternionMultiply(qDevice, qScreen);
        const newEuler = this.quaternionToEulerYXZ(qCombined);

        const x = newEuler.x;
        const y = newEuler.y;
        const z = newEuler.z;

        if (!this.gyroInitialized) {
            this.gyroOffset.x = x;
            this.gyroOffset.y = y;
            this.gyroOffset.z = z;
            this.gyroInitialized = true;
            return;
        }

        const dx = x - this.gyroOffset.x;
        const dy = y - this.gyroOffset.y;
        const dz = z - this.gyroOffset.z;

        this.targetRotation.x = this.gyroBase.x + dx;
        this.targetRotation.y = this.gyroBase.y + dy;
        this.targetRotation.z = this.gyroBase.z + dz;
    };

    private getPerspectiveMatrix(fovDeg: number, aspect: number, near: number, far: number): Float32Array {
        const f = 1.0 / Math.tan((fovDeg * Math.PI / 180) / 2);
        const nf = 1.0 / (near - far);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, (2.0 * far * near) * nf, 0
        ]);
    }

    private getViewMatrix(pitch: number, yaw: number, roll: number): Float32Array {
        const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
        const cosY = Math.cos(yaw),   sinY = Math.sin(yaw);
        const cosR = Math.cos(roll),  sinR = Math.sin(roll);

        const m00 = cosY * cosR + sinY * sinP * sinR;
        const m01 = -cosY * sinR + sinY * sinP * cosR;
        const m02 = sinY * cosP;
        
        const m10 = cosP * sinR;
        const m11 = cosP * cosR;
        const m12 = -sinP;
        
        const m20 = -sinY * cosR + cosY * sinP * sinR;
        const m21 = sinY * sinR + cosY * sinP * cosR;
        const m22 = cosY * cosP;

        return new Float32Array([
            m00, m10, m20, 0,
            m01, m11, m21, 0,
            m02, m12, m22, 0,
            0,   0,   0,   1
        ]);
    }

    private render(time: number) {
        this.animationFrameId = requestAnimationFrame(this.render);
        const delta = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        const gl = this.gl;
        const canvas = gl.canvas as HTMLCanvasElement;
        
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        const damping = 10.0 * delta;
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * damping;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * damping;
        this.rotation.z += (this.targetRotation.z - this.rotation.z) * damping;

        gl.useProgram(this.program);
        
        const projection = this.getPerspectiveMatrix(this.fov, canvas.width / canvas.height, 0.1, 1000);
        const view = this.getViewMatrix(
            Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x)),
            this.rotation.y,
            this.rotation.z
        );

        gl.uniformMatrix4fv(this.uProjectionMatrixLoc, false, projection);
        gl.uniformMatrix4fv(this.uViewMatrixLoc, false, view);

        gl.uniform1f(this.uIsSBSLoc, this.isSBS ? 1.0 : 0.0);
        gl.uniform1f(this.uSbsFormatLoc, this.sbsFormat === 'horizontal' ? 0.0 : 1.0);
        gl.uniform1f(this.uInvertStereoLoc, this.invertStereo ? 1.0 : 0.0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
        }

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    public destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        const canvas = this.gl.canvas as HTMLCanvasElement;
        canvas.removeEventListener('mousedown', this.handleMouseDown);
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('mouseup', this.handleMouseUp);
        canvas.removeEventListener('touchstart', this.handleTouchStart);
        canvas.removeEventListener('touchmove', this.handleTouchMove);
        canvas.removeEventListener('touchend', this.handleTouchEnd);
        window.removeEventListener('deviceorientation', this.handleOrientation);
        
        this.gl.deleteBuffer(this.positionBuffer);
        this.gl.deleteBuffer(this.uvBuffer);
        this.gl.deleteBuffer(this.indexBuffer);
        this.gl.deleteTexture(this.texture);
        this.gl.deleteVertexArray(this.vao);
        this.gl.deleteProgram(this.program);
    }
}
