export interface YUVMetadata {
    width: number;
    height: number;
    fps: number;
    pixelFormat: 'yuv420p'; // For now, we only support 420p
}

export class YUVParser {
    metadata: YUVMetadata;
    frameSize: number;
    ySize: number;
    uSize: number;
    vSize: number;

    constructor(metadata: YUVMetadata) {
        this.metadata = metadata;
        this.ySize = metadata.width * metadata.height;
        this.uSize = (metadata.width / 2) * (metadata.height / 2);
        this.vSize = this.uSize;
        this.frameSize = this.ySize + this.uSize + this.vSize;
    }

    getFrame(buffer: ArrayBuffer, frameIndex: number): { y: Uint8Array, u: Uint8Array, v: Uint8Array } | null {
        const offset = frameIndex * this.frameSize;
        if (offset + this.frameSize > buffer.byteLength) {
            return null;
        }

        const y = new Uint8Array(buffer, offset, this.ySize);
        const u = new Uint8Array(buffer, offset + this.ySize, this.uSize);
        const v = new Uint8Array(buffer, offset + this.ySize + this.uSize, this.vSize);

        return { y, u, v };
    }

    getTotalFrames(buffer: ArrayBuffer): number {
        return Math.floor(buffer.byteLength / this.frameSize);
    }
}
