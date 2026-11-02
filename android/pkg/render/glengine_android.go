//go:build android

package render

/*
#cgo LDFLAGS: -lGLESv3 -lEGL

#include <GLES3/gl3.h>
#include <GLES2/gl2ext.h>
#include <stdlib.h>
#include <stdbool.h>
#include <android/log.h>

#define LOG_TAG "VRPlayerGL"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static GLuint createExternalTexture() {
    GLuint texId = 0;
    glGenTextures(1, &texId);
    glBindTexture(GL_TEXTURE_EXTERNAL_OES, texId);
    glTexParameteri(GL_TEXTURE_EXTERNAL_OES, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_EXTERNAL_OES, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_EXTERNAL_OES, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_EXTERNAL_OES, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    return texId;
}

static GLuint compileShader(GLenum type, const char* src) {
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &src, NULL);
    glCompileShader(shader);

    GLint compiled = 0;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
    if (!compiled) {
        GLint infoLen = 0;
        glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &infoLen);
        if (infoLen > 0) {
            char* buf = (char*)malloc(infoLen);
            glGetShaderInfoLog(shader, infoLen, NULL, buf);
            LOGE("Shader compilation error: %s", buf);
            free(buf);
        }
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}

static GLuint createProgram(const char* vsSrc, const char* fsSrc) {
    GLuint vs = compileShader(GL_VERTEX_SHADER, vsSrc);
    if (!vs) return 0;
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, fsSrc);
    if (!fs) {
        glDeleteShader(vs);
        return 0;
    }

    GLuint program = glCreateProgram();
    glAttachShader(program, vs);
    glAttachShader(program, fs);
    glLinkProgram(program);

    GLint linked = 0;
    glGetProgramiv(program, GL_LINK_STATUS, &linked);
    if (!linked) {
        GLint infoLen = 0;
        glGetProgramiv(program, GL_INFO_LOG_LENGTH, &infoLen);
        if (infoLen > 0) {
            char* buf = (char*)malloc(infoLen);
            glGetProgramInfoLog(program, infoLen, NULL, buf);
            LOGE("Program link error: %s", buf);
            free(buf);
        }
        glDeleteProgram(program);
        glDeleteShader(vs);
        glDeleteShader(fs);
        return 0;
    }

    glDeleteShader(vs);
    glDeleteShader(fs);
    return program;
}

static void uploadMesh(const float* verts, int vertFloats, const uint16_t* indices, int indexCount,
                       GLuint* outVAO, GLuint* outVBO, GLuint* outEBO) {
    glGenVertexArrays(1, outVAO);
    glBindVertexArray(*outVAO);

    glGenBuffers(1, outVBO);
    glBindBuffer(GL_ARRAY_BUFFER, *outVBO);
    glBufferData(GL_ARRAY_BUFFER, vertFloats * sizeof(float), verts, GL_STATIC_DRAW);

    glGenBuffers(1, outEBO);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, *outEBO);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, indexCount * sizeof(uint16_t), indices, GL_STATIC_DRAW);

    // Stride: 5 floats (Pos: 3 floats, UV: 2 floats)
    GLsizei stride = 5 * sizeof(float);
    // Attribute 0: vec3 aPosition
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, stride, (void*)0);
    // Attribute 1: vec2 aTexCoord
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, stride, (void*)(3 * sizeof(float)));

    glBindVertexArray(0);
}

static void drawMesh(GLuint program, GLuint vao, int indexCount, GLuint texId, const float* mvp,
                     float isSBS, float sbsFormat, float invertStereo,
                     GLint uMVP, GLint uTex, GLint uSBS, GLint uFormat, GLint uInvert) {
    glUseProgram(program);

    // Bind external OES video texture to unit 0
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_EXTERNAL_OES, texId);
    glUniform1i(uTex, 0);

    // Set uniforms
    glUniformMatrix4fv(uMVP, 1, GL_FALSE, mvp);
    glUniform1f(uSBS, isSBS);
    glUniform1f(uFormat, sbsFormat);
    glUniform1f(uInvert, invertStereo);

    // Draw triangles
    glBindVertexArray(vao);
    glDrawElements(GL_TRIANGLES, indexCount, GL_UNSIGNED_SHORT, 0);
    glBindVertexArray(0);
    glUseProgram(0);
}
*/
import "C"

import (
	"errors"
	"unsafe"
)

// GLESBuffer holds VAO, VBO, EBO and index count for a rendered geometry.
type GLESBuffer struct {
	vao        C.GLuint
	vbo        C.GLuint
	ebo        C.GLuint
	indexCount C.int
}

// GLEngine manages GLES 3.0 shaders, textures, and mesh buffers on Android.
type GLEngine struct {
	ExternalTexID uint32
	program       C.GLuint

	// Uniform locations
	uMVP    C.GLint
	uTex    C.GLint
	uSBS    C.GLint
	uFormat C.GLint
	uInvert C.GLint

	// Geometry buffers
	sphereBuf GLESBuffer
	domeBuf   GLESBuffer
	planeBuf  GLESBuffer
}

// NewGLEngine creates an uninitialized engine.
func NewGLEngine() *GLEngine {
	return &GLEngine{}
}

// InitGL compiles shaders, creates external OES texture, and uploads meshes to GPU.
func (e *GLEngine) InitGL(vertSrc, fragSrc string) error {
	cVert := C.CString(vertSrc)
	defer C.free(unsafe.Pointer(cVert))
	cFrag := C.CString(fragSrc)
	defer C.free(unsafe.Pointer(cFrag))

	e.program = C.createProgram(cVert, cFrag)
	if e.program == 0 {
		return errors.New("failed to compile and link GLES 3.0 shader program")
	}

	// Cache uniform locations
	cMVP := C.CString("uMVPMatrix")
	defer C.free(unsafe.Pointer(cMVP))
	cTex := C.CString("uTexture")
	defer C.free(unsafe.Pointer(cTex))
	cSBS := C.CString("uIsSBS")
	defer C.free(unsafe.Pointer(cSBS))
	cFormat := C.CString("uSBSFormat")
	defer C.free(unsafe.Pointer(cFormat))
	cInvert := C.CString("uInvertStereo")
	defer C.free(unsafe.Pointer(cInvert))

	e.uMVP = C.glGetUniformLocation(e.program, cMVP)
	e.uTex = C.glGetUniformLocation(e.program, cTex)
	e.uSBS = C.glGetUniformLocation(e.program, cSBS)
	e.uFormat = C.glGetUniformLocation(e.program, cFormat)
	e.uInvert = C.glGetUniformLocation(e.program, cInvert)

	// Create OES external texture ID
	e.ExternalTexID = uint32(C.createExternalTexture())

	// 1. Upload 360 Sphere
	sphereMesh := GenerateSphere(50.0, 32, 64)
	e.sphereBuf.indexCount = C.int(len(sphereMesh.Indices))
	C.uploadMesh((*C.float)(&sphereMesh.Vertices[0]), C.int(len(sphereMesh.Vertices)),
		(*C.uint16_t)(&sphereMesh.Indices[0]), e.sphereBuf.indexCount,
		&e.sphereBuf.vao, &e.sphereBuf.vbo, &e.sphereBuf.ebo)

	// 2. Upload 180 Dome
	domeMesh := GenerateDome(50.0, 32, 64)
	e.domeBuf.indexCount = C.int(len(domeMesh.Indices))
	C.uploadMesh((*C.float)(&domeMesh.Vertices[0]), C.int(len(domeMesh.Vertices)),
		(*C.uint16_t)(&domeMesh.Indices[0]), e.domeBuf.indexCount,
		&e.domeBuf.vao, &e.domeBuf.vbo, &e.domeBuf.ebo)

	// 3. Upload Flat Plane
	planeMesh := GeneratePlane(16.0 / 9.0)
	e.planeBuf.indexCount = C.int(len(planeMesh.Indices))
	C.uploadMesh((*C.float)(&planeMesh.Vertices[0]), C.int(len(planeMesh.Vertices)),
		(*C.uint16_t)(&planeMesh.Indices[0]), e.planeBuf.indexCount,
		&e.planeBuf.vao, &e.planeBuf.vbo, &e.planeBuf.ebo)

	return nil
}

// Render draws the chosen projection geometry using the external video texture.
func (e *GLEngine) Render(viewMode, stereoMode string, invertStereo bool, mvp Mat4) {
	if e.program == 0 {
		return
	}

	var isSBS float32 = 0.0
	var sbsFormat float32 = 0.0
	var invert float32 = 0.0

	if stereoMode == "horizontal" {
		isSBS = 1.0
		sbsFormat = 0.0
	} else if stereoMode == "vertical" {
		isSBS = 1.0
		sbsFormat = 1.0
	}

	if invertStereo {
		invert = 1.0
	}

	targetBuf := e.sphereBuf
	if viewMode == "180" {
		targetBuf = e.domeBuf
	} else if viewMode == "flat" {
		targetBuf = e.planeBuf
	}

	C.drawMesh(e.program, targetBuf.vao, targetBuf.indexCount, C.GLuint(e.ExternalTexID),
		(*C.float)(&mvp[0]), C.float(isSBS), C.float(sbsFormat), C.float(invert),
		e.uMVP, e.uTex, e.uSBS, e.uFormat, e.uInvert)
}

// Release frees shader program and geometry buffers.
func (e *GLEngine) Release() {
	if e.program != 0 {
		C.glDeleteProgram(e.program)
		e.program = 0
	}
}
