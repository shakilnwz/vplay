//go:build android

package render

/*
#cgo LDFLAGS: -landroid -lEGL -lGLESv3

#include <android/native_window.h>
#include <android/native_window_jni.h>
#include <EGL/egl.h>
#include <GLES3/gl3.h>
#include <jni.h>
#include <stdbool.h>
#include <stdlib.h>
#include <android/log.h>

#define LOG_TAG "VRPlayerEGL"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

typedef struct {
    EGLDisplay disp;
    EGLConfig  cfg;
    EGLContext ctx;
    EGLSurface surf;
    ANativeWindow* win;
} NativeEGL;

static ANativeWindow* getNativeWindowFromGioView(JavaVM* vm, jobject gioView) {
    if (!vm || !gioView) return NULL;
    JNIEnv* env = NULL;
    if ((*vm)->GetEnv(vm, (void**)&env, JNI_VERSION_1_6) != JNI_OK) {
        if ((*vm)->AttachCurrentThread(vm, &env, NULL) != JNI_OK) {
            LOGE("Failed to attach current thread to JVM");
            return NULL;
        }
    }

    // gioView extends SurfaceView -> call getHolder().getSurface()
    jclass surfViewClass = (*env)->FindClass(env, "android/view/SurfaceView");
    if (!surfViewClass) {
        LOGE("Failed to find SurfaceView class");
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        return NULL;
    }
    jmethodID getHolder = (*env)->GetMethodID(env, surfViewClass, "getHolder", "()Landroid/view/SurfaceHolder;");
    if (!getHolder) {
        LOGE("Failed to find getHolder method");
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        return NULL;
    }
    jobject holder = (*env)->CallObjectMethod(env, gioView, getHolder);
    if (!holder) {
        LOGE("getHolder returned null");
        return NULL;
    }

    jclass holderClass = (*env)->FindClass(env, "android/view/SurfaceHolder");
    if (!holderClass) {
        LOGE("Failed to find SurfaceHolder class");
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        return NULL;
    }
    jmethodID getSurface = (*env)->GetMethodID(env, holderClass, "getSurface", "()Landroid/view/Surface;");
    if (!getSurface) {
        LOGE("Failed to find getSurface method");
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        return NULL;
    }
    jobject surface = (*env)->CallObjectMethod(env, holder, getSurface);
    if (!surface) {
        LOGE("getSurface returned null");
        return NULL;
    }

    ANativeWindow* win = ANativeWindow_fromSurface(env, surface);
    (*env)->DeleteLocalRef(env, surface);
    (*env)->DeleteLocalRef(env, holder);
    return win;
}

static NativeEGL* initEGL(JavaVM* vm, jobject gioView) {
    ANativeWindow* win = getNativeWindowFromGioView(vm, gioView);
    if (!win) {
        LOGE("initEGL: native window is NULL");
        return NULL;
    }

    EGLDisplay disp = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if (disp == EGL_NO_DISPLAY) {
        LOGE("eglGetDisplay failed: 0x%x", eglGetError());
        ANativeWindow_release(win);
        return NULL;
    }

    EGLint major = 0, minor = 0;
    if (!eglInitialize(disp, &major, &minor)) {
        LOGE("eglInitialize failed: 0x%x", eglGetError());
        ANativeWindow_release(win);
        return NULL;
    }
    LOGI("EGL initialized: version %d.%d", major, minor);

    const EGLint attribs[] = {
        EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
        EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
        EGL_BLUE_SIZE, 8,
        EGL_GREEN_SIZE, 8,
        EGL_RED_SIZE, 8,
        EGL_ALPHA_SIZE, 8,
        EGL_DEPTH_SIZE, 16,
        EGL_NONE
    };

    EGLConfig cfg;
    EGLint numConfigs = 0;
    if (!eglChooseConfig(disp, attribs, &cfg, 1, &numConfigs) || numConfigs == 0) {
        LOGE("eglChooseConfig failed (numConfigs=%d, err=0x%x), fallback to GLES2 attribs", numConfigs, eglGetError());
        const EGLint fallbackAttribs[] = {
            EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT,
            EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
            EGL_BLUE_SIZE, 8,
            EGL_GREEN_SIZE, 8,
            EGL_RED_SIZE, 8,
            EGL_NONE
        };
        if (!eglChooseConfig(disp, fallbackAttribs, &cfg, 1, &numConfigs) || numConfigs == 0) {
            LOGE("Fallback eglChooseConfig failed: 0x%x", eglGetError());
            eglTerminate(disp);
            ANativeWindow_release(win);
            return NULL;
        }
    }

    EGLint format = 0;
    eglGetConfigAttrib(disp, cfg, EGL_NATIVE_VISUAL_ID, &format);
    ANativeWindow_setBuffersGeometry(win, 0, 0, format);

    const EGLint ctxAttribs[] = {
        EGL_CONTEXT_CLIENT_VERSION, 3,
        EGL_NONE
    };
    EGLContext ctx = eglCreateContext(disp, cfg, EGL_NO_CONTEXT, ctxAttribs);
    if (ctx == EGL_NO_CONTEXT) {
        LOGE("eglCreateContext GLES3 failed: 0x%x, trying GLES2", eglGetError());
        const EGLint ctxAttribs2[] = {
            EGL_CONTEXT_CLIENT_VERSION, 2,
            EGL_NONE
        };
        ctx = eglCreateContext(disp, cfg, EGL_NO_CONTEXT, ctxAttribs2);
        if (ctx == EGL_NO_CONTEXT) {
            LOGE("eglCreateContext failed: 0x%x", eglGetError());
            eglTerminate(disp);
            ANativeWindow_release(win);
            return NULL;
        }
    }

    EGLSurface surf = eglCreateWindowSurface(disp, cfg, (EGLNativeWindowType)win, NULL);
    if (surf == EGL_NO_SURFACE) {
        LOGE("eglCreateWindowSurface failed: 0x%x", eglGetError());
        eglDestroyContext(disp, ctx);
        eglTerminate(disp);
        ANativeWindow_release(win);
        return NULL;
    }

    if (!eglMakeCurrent(disp, surf, surf, ctx)) {
        LOGE("eglMakeCurrent failed: 0x%x", eglGetError());
        eglDestroySurface(disp, surf);
        eglDestroyContext(disp, ctx);
        eglTerminate(disp);
        ANativeWindow_release(win);
        return NULL;
    }

    NativeEGL* out = (NativeEGL*)malloc(sizeof(NativeEGL));
    out->disp = disp;
    out->cfg  = cfg;
    out->ctx  = ctx;
    out->surf = surf;
    out->win  = win;
    return out;
}

static bool makeCurrentEGL(NativeEGL* e) {
    if (!e) return false;
    return eglMakeCurrent(e->disp, e->surf, e->surf, e->ctx) == EGL_TRUE;
}

static bool swapBuffersEGL(NativeEGL* e) {
    if (!e || e->surf == EGL_NO_SURFACE) return false;
    EGLBoolean ok = eglSwapBuffers(e->disp, e->surf);
    if (!ok) {
        EGLint err = eglGetError();
        LOGE("eglSwapBuffers failed: 0x%x", err);
        if (err == EGL_BAD_SURFACE || err == EGL_BAD_NATIVE_WINDOW) {
            eglDestroySurface(e->disp, e->surf);
            e->surf = EGL_NO_SURFACE;
        }
        return false;
    }
    return true;
}

static bool ensureSurfaceEGL(JavaVM* vm, jobject gioView, NativeEGL* e) {
    if (!e || !vm || !gioView) return false;

    JNIEnv* env = NULL;
    if ((*vm)->GetEnv(vm, (void**)&env, JNI_VERSION_1_6) != JNI_OK) {
        if ((*vm)->AttachCurrentThread(vm, &env, NULL) != JNI_OK) {
            return false;
        }
    }

    jclass surfViewClass = (*env)->FindClass(env, "android/view/SurfaceView");
    if (!surfViewClass) {
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        return false;
    }
    jmethodID getHolder = (*env)->GetMethodID(env, surfViewClass, "getHolder", "()Landroid/view/SurfaceHolder;");
    if (!getHolder) {
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        return false;
    }
    jobject holder = (*env)->CallObjectMethod(env, gioView, getHolder);
    if (!holder) return false;

    jclass holderClass = (*env)->FindClass(env, "android/view/SurfaceHolder");
    if (!holderClass) {
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        (*env)->DeleteLocalRef(env, holder);
        return false;
    }
    jmethodID getSurface = (*env)->GetMethodID(env, holderClass, "getSurface", "()Landroid/view/Surface;");
    if (!getSurface) {
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        (*env)->DeleteLocalRef(env, holder);
        return false;
    }
    jobject surface = (*env)->CallObjectMethod(env, holder, getSurface);
    (*env)->DeleteLocalRef(env, holder);
    if (!surface) return false;

    jclass surfClass = (*env)->FindClass(env, "android/view/Surface");
    if (!surfClass) {
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        (*env)->DeleteLocalRef(env, surface);
        return false;
    }
    jmethodID isValidMethod = (*env)->GetMethodID(env, surfClass, "isValid", "()Z");
    if (!isValidMethod) {
        if ((*env)->ExceptionCheck(env)) (*env)->ExceptionClear(env);
        (*env)->DeleteLocalRef(env, surface);
        return false;
    }
    jboolean isValid = (*env)->CallBooleanMethod(env, surface, isValidMethod);
    if (!isValid) {
        (*env)->DeleteLocalRef(env, surface);
        return false;
    }

    ANativeWindow* currentWin = ANativeWindow_fromSurface(env, surface);
    (*env)->DeleteLocalRef(env, surface);
    if (!currentWin) return false;

    if (e->win != currentWin || e->surf == EGL_NO_SURFACE) {
        LOGI("Recreating EGL surface for new ANativeWindow (old win: %p, new win: %p)", e->win, currentWin);

        if (e->disp != EGL_NO_DISPLAY && e->surf != EGL_NO_SURFACE) {
            eglMakeCurrent(e->disp, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
            eglDestroySurface(e->disp, e->surf);
            e->surf = EGL_NO_SURFACE;
        }
        if (e->win) {
            ANativeWindow_release(e->win);
            e->win = NULL;
        }

        e->win = currentWin;
        EGLint format = 0;
        eglGetConfigAttrib(e->disp, e->cfg, EGL_NATIVE_VISUAL_ID, &format);
        ANativeWindow_setBuffersGeometry(e->win, 0, 0, format);

        e->surf = eglCreateWindowSurface(e->disp, e->cfg, (EGLNativeWindowType)e->win, NULL);
        if (e->surf == EGL_NO_SURFACE) {
            LOGE("Failed to recreate EGL window surface: 0x%x", eglGetError());
            return false;
        }

        if (!eglMakeCurrent(e->disp, e->surf, e->surf, e->ctx)) {
            LOGE("Failed to make recreated surface current: 0x%x", eglGetError());
            return false;
        }
    } else {
        ANativeWindow_release(currentWin);
    }

    return (e->surf != EGL_NO_SURFACE);
}

static void releaseEGL(NativeEGL* e) {
    if (!e) return;
    if (e->disp != EGL_NO_DISPLAY) {
        eglMakeCurrent(e->disp, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
        if (e->surf != EGL_NO_SURFACE) {
            eglDestroySurface(e->disp, e->surf);
        }
        if (e->ctx != EGL_NO_CONTEXT) {
            eglDestroyContext(e->disp, e->ctx);
        }
        eglTerminate(e->disp);
    }
    if (e->win) {
        ANativeWindow_release(e->win);
    }
    free(e);
}
*/
import "C"

import (
	"errors"
	"fmt"
	"image"
	"unsafe"

	"gioui.org/gpu"
	"gioui.org/op"
)

// EGLContext manages native Android EGL surfaces and Gio GPU integration.
type EGLContext struct {
	native *C.NativeEGL
	gioGPU gpu.GPU
}

// NewEGLContext creates an active EGL context and surface bound to the GioView window.
func NewEGLContext(jvmPtr uintptr, viewPtr uintptr) (*EGLContext, error) {
	if jvmPtr == 0 || viewPtr == 0 {
		return nil, errors.New("invalid JVM or View pointer")
	}
	native := C.initEGL((*C.JavaVM)(unsafe.Pointer(jvmPtr)), (C.jobject)(unsafe.Pointer(viewPtr)))
	if native == nil {
		return nil, errors.New("failed to initialize EGL native context")
	}

	gioGPU, err := gpu.New(gpu.OpenGL{ES: true, Shared: true})
	if err != nil {
		C.releaseEGL(native)
		return nil, fmt.Errorf("failed to create Gio GPU: %w", err)
	}

	return &EGLContext{
		native: native,
		gioGPU: gioGPU,
	}, nil
}

// MakeCurrent ensures this context is bound to the calling OS thread.
func (c *EGLContext) MakeCurrent() bool {
	if c == nil || c.native == nil {
		return false
	}
	return bool(C.makeCurrentEGL(c.native))
}

// Clear clears color and depth buffers.
func (c *EGLContext) Clear(r, g, b, a float32) {
	C.glClearColor(C.GLfloat(r), C.GLfloat(g), C.GLfloat(b), C.GLfloat(a))
	C.glClear(C.GL_COLOR_BUFFER_BIT | C.GL_DEPTH_BUFFER_BIT)
}

// SetViewport sets OpenGL rendering dimensions.
func (c *EGLContext) SetViewport(w, h int) {
	C.glViewport(0, 0, C.GLsizei(w), C.GLsizei(h))
}

// RenderUI renders Gio's UI ops directly on top of the current OpenGL framebuffer.
func (c *EGLContext) RenderUI(ops *op.Ops, size image.Point) error {
	if c == nil || c.gioGPU == nil {
		return errors.New("gioGPU is nil")
	}
	return c.gioGPU.Frame(ops, gpu.OpenGLRenderTarget{}, size)
}

// EnsureSurface checks if the Android Surface has changed (e.g. app minimize/maximize)
// and rebinds the EGLSurface smoothly without destroying the EGL context or shaders.
func (c *EGLContext) EnsureSurface(jvmPtr uintptr, viewPtr uintptr) bool {
	if c == nil || c.native == nil || jvmPtr == 0 || viewPtr == 0 {
		return false
	}
	return bool(C.ensureSurfaceEGL((*C.JavaVM)(unsafe.Pointer(jvmPtr)), (C.jobject)(unsafe.Pointer(viewPtr)), c.native))
}

// SwapBuffers presents the completed frame to the display.
func (c *EGLContext) SwapBuffers() bool {
	if c == nil || c.native == nil {
		return false
	}
	return bool(C.swapBuffersEGL(c.native))
}

// Release frees all GPU and EGL resources.
func (c *EGLContext) Release() {
	if c == nil {
		return
	}
	if c.gioGPU != nil {
		c.gioGPU.Release()
		c.gioGPU = nil
	}
	if c.native != nil {
		C.releaseEGL(c.native)
		c.native = nil
	}
}
