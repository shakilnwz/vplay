//go:build android

package video

/*
#cgo LDFLAGS: -landroid -lGLESv3 -lEGL

#include <jni.h>
#include <stdlib.h>
#include <stdbool.h>
#include <android/log.h>

#define LOG_TAG "VRPlayerBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static bool isNullJObject(jobject obj) {
    return obj == NULL;
}

static jobject nullJObject(void) {
    return NULL;
}

static JNIEnv* getJNIEnv(JavaVM* vm) {
    JNIEnv* env = NULL;
    if ((*vm)->GetEnv(vm, (void**)&env, JNI_VERSION_1_6) != JNI_OK) {
        if ((*vm)->AttachCurrentThread(vm, &env, NULL) != JNI_OK) {
            LOGE("Failed to attach current thread to JVM");
            return NULL;
        }
    }
    return env;
}

// createSurfaceAndTexture initializes SurfaceTexture with texId and wraps it in a Surface
static bool createSurfaceAndTexture(JavaVM* vm, int texId, jobject* outST, jobject* outSurface) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env) return false;

    // 1. New SurfaceTexture(texId)
    jclass stClass = (*env)->FindClass(env, "android/graphics/SurfaceTexture");
    if (!stClass) return false;
    jmethodID stCtor = (*env)->GetMethodID(env, stClass, "<init>", "(I)V");
    if (!stCtor) return false;
    jobject localST = (*env)->NewObject(env, stClass, stCtor, texId);
    if (!localST) return false;

    // 2. New Surface(surfaceTexture)
    jclass surfClass = (*env)->FindClass(env, "android/view/Surface");
    if (!surfClass) return false;
    jmethodID surfCtor = (*env)->GetMethodID(env, surfClass, "<init>", "(Landroid/graphics/SurfaceTexture;)V");
    if (!surfCtor) return false;
    jobject localSurface = (*env)->NewObject(env, surfClass, surfCtor, localST);
    if (!localSurface) return false;

    *outST = (*env)->NewGlobalRef(env, localST);
    *outSurface = (*env)->NewGlobalRef(env, localSurface);

    (*env)->DeleteLocalRef(env, localST);
    (*env)->DeleteLocalRef(env, localSurface);
    return true;
}

// updateSurfaceTexture calls SurfaceTexture.updateTexImage and retrieves 4x4 matrix
static bool updateSurfaceTexture(JavaVM* vm, jobject st, float* outMtx) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !st) return false;

    jclass stClass = (*env)->GetObjectClass(env, st);
    jmethodID updateTex = (*env)->GetMethodID(env, stClass, "updateTexImage", "()V");
    if (!updateTex) return false;
    (*env)->CallVoidMethod(env, st, updateTex);

    if (outMtx) {
        jmethodID getTransform = (*env)->GetMethodID(env, stClass, "getTransformMatrix", "([F)V");
        if (getTransform) {
            jfloatArray mtxArray = (*env)->NewFloatArray(env, 16);
            (*env)->CallVoidMethod(env, st, getTransform, mtxArray);
            (*env)->GetFloatArrayRegion(env, mtxArray, 0, 16, outMtx);
            (*env)->DeleteLocalRef(env, mtxArray);
        }
    }
    return true;
}

// createMediaPlayer initializes an Android MediaPlayer bound to the Surface
static jobject createMediaPlayer(JavaVM* vm, jobject surface) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env) return NULL;

    jclass mpClass = (*env)->FindClass(env, "android/media/MediaPlayer");
    if (!mpClass) return NULL;
    jmethodID mpCtor = (*env)->GetMethodID(env, mpClass, "<init>", "()V");
    if (!mpCtor) return NULL;
    jobject localMP = (*env)->NewObject(env, mpClass, mpCtor);
    if (!localMP) return NULL;

    jmethodID setSurface = (*env)->GetMethodID(env, mpClass, "setSurface", "(Landroid/view/Surface;)V");
    if (setSurface && surface) {
        (*env)->CallVoidMethod(env, localMP, setSurface, surface);
    }

    jobject globalMP = (*env)->NewGlobalRef(env, localMP);
    (*env)->DeleteLocalRef(env, localMP);
    return globalMP;
}

// mpReset resets MediaPlayer to Idle state
static void mpReset(JavaVM* vm, jobject mp) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return;
    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID reset = (*env)->GetMethodID(env, mpClass, "reset", "()V");
    if (reset) (*env)->CallVoidMethod(env, mp, reset);
    if ((*env)->ExceptionCheck(env)) {
        (*env)->ExceptionClear(env);
    }
}

// mpSetDataSourceURI sets media URI
static bool mpSetDataSourceURI(JavaVM* vm, jobject mp, jobject surface, const char* uriStr) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp || !uriStr) return false;

    mpReset(vm, mp);

    jclass mpClass = (*env)->GetObjectClass(env, mp);
    if (surface) {
        jmethodID setSurface = (*env)->GetMethodID(env, mpClass, "setSurface", "(Landroid/view/Surface;)V");
        if (setSurface) (*env)->CallVoidMethod(env, mp, setSurface, surface);
    }

    jmethodID setDS = (*env)->GetMethodID(env, mpClass, "setDataSource", "(Ljava/lang/String;)V");
    if (!setDS) return false;

    jstring jUri = (*env)->NewStringUTF(env, uriStr);
    (*env)->CallVoidMethod(env, mp, setDS, jUri);
    (*env)->DeleteLocalRef(env, jUri);
    if ((*env)->ExceptionCheck(env)) {
        (*env)->ExceptionDescribe(env);
        (*env)->ExceptionClear(env);
        return false;
    }

    jmethodID prepare = (*env)->GetMethodID(env, mpClass, "prepare", "()V");
    if (prepare) {
        (*env)->CallVoidMethod(env, mp, prepare);
        if ((*env)->ExceptionCheck(env)) {
            (*env)->ExceptionDescribe(env);
            (*env)->ExceptionClear(env);
            return false;
        }
    }
    return true;
}

// mpPlay starts playback
static void mpPlay(JavaVM* vm, jobject mp) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return;
    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID start = (*env)->GetMethodID(env, mpClass, "start", "()V");
    if (start) (*env)->CallVoidMethod(env, mp, start);
}

// mpPause pauses playback
static void mpPause(JavaVM* vm, jobject mp) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return;
    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID pause = (*env)->GetMethodID(env, mpClass, "pause", "()V");
    if (pause) (*env)->CallVoidMethod(env, mp, pause);
}

// mpSeek seeks to milliseconds
static void mpSeek(JavaVM* vm, jobject mp, int msec) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return;
    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID seekTo = (*env)->GetMethodID(env, mpClass, "seekTo", "(I)V");
    if (seekTo) (*env)->CallVoidMethod(env, mp, seekTo, msec);
}

// mpSetSpeed sets playback speed
static void mpSetSpeed(JavaVM* vm, jobject mp, float speed) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return;

    jclass ppClass = (*env)->FindClass(env, "android/media/PlaybackParams");
    if (!ppClass) return;
    jmethodID ppCtor = (*env)->GetMethodID(env, ppClass, "<init>", "()V");
    if (!ppCtor) return;
    jobject params = (*env)->NewObject(env, ppClass, ppCtor);
    if (!params) return;

    jmethodID setSpeed = (*env)->GetMethodID(env, ppClass, "setSpeed", "(F)Landroid/media/PlaybackParams;");
    if (setSpeed) (*env)->CallObjectMethod(env, params, setSpeed, speed);

    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID setPP = (*env)->GetMethodID(env, mpClass, "setPlaybackParams", "(Landroid/media/PlaybackParams;)V");
    if (setPP) (*env)->CallVoidMethod(env, mp, setPP, params);

    (*env)->DeleteLocalRef(env, params);
}

// mpSetVolume sets left/right volume
static void mpSetVolume(JavaVM* vm, jobject mp, float vol) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return;
    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID setVol = (*env)->GetMethodID(env, mpClass, "setVolume", "(FF)V");
    if (setVol) (*env)->CallVoidMethod(env, mp, setVol, vol, vol);
}

// mpGetPosition gets current position in msec
static int mpGetPosition(JavaVM* vm, jobject mp) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return 0;
    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID getPos = (*env)->GetMethodID(env, mpClass, "getCurrentPosition", "()I");
    if (getPos) return (*env)->CallIntMethod(env, mp, getPos);
    return 0;
}

// mpGetDuration gets duration in msec
static int mpGetDuration(JavaVM* vm, jobject mp) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return 0;
    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID getDur = (*env)->GetMethodID(env, mpClass, "getDuration", "()I");
    if (getDur) return (*env)->CallIntMethod(env, mp, getDur);
    return 0;
}

// mpGetDimensions gets video width and height
static void mpGetDimensions(JavaVM* vm, jobject mp, int* outW, int* outH) {
    JNIEnv* env = getJNIEnv(vm);
    if (!env || !mp) return;
    jclass mpClass = (*env)->GetObjectClass(env, mp);
    jmethodID getW = (*env)->GetMethodID(env, mpClass, "getVideoWidth", "()I");
    jmethodID getH = (*env)->GetMethodID(env, mpClass, "getVideoHeight", "()I");
    if (getW && outW) *outW = (*env)->CallIntMethod(env, mp, getW);
    if (getH && outH) *outH = (*env)->CallIntMethod(env, mp, getH);
}

// releaseGlobalRef frees global JNI references
static void releaseGlobalRef(JavaVM* vm, jobject ref) {
    if (!ref) return;
    JNIEnv* env = getJNIEnv(vm);
    if (env) (*env)->DeleteGlobalRef(env, ref);
}
*/
import "C"

import (
	"errors"
	"strings"
	"sync"
	"time"
	"unsafe"

	"gioui.org/app"
)

// AndroidPlayer implements Player backed by Android MediaPlayer and SurfaceTexture.
type AndroidPlayer struct {
	mu        sync.RWMutex
	vm        *C.JavaVM
	surfaceTex C.jobject
	surface    C.jobject
	mediaPlayer C.jobject

	texID     uint32
	transform [16]float32
	state     PlaybackState
	duration  time.Duration
	speed     float32
	volume    float32
	width     int
	height    int
}

// New creates a platform-appropriate hardware video player.
func New(texID uint32) (Player, error) {
	return NewAndroidPlayer(texID)
}

// NewAndroidPlayer initializes hardware player attached to the given GL external texture ID.
func NewAndroidPlayer(texID uint32) (*AndroidPlayer, error) {
	jvmPtr := app.JavaVM()
	if jvmPtr == 0 {
		return nil, errors.New("JVM is not available (not running on Android)")
	}
	vm := (*C.JavaVM)(unsafe.Pointer(jvmPtr))

	var st C.jobject
	var surface C.jobject
	if !bool(C.createSurfaceAndTexture(vm, C.int(texID), &st, &surface)) {
		return nil, errors.New("failed to create SurfaceTexture and Surface")
	}

	mp := C.createMediaPlayer(vm, surface)
	if bool(C.isNullJObject(mp)) {
		C.releaseGlobalRef(vm, st)
		C.releaseGlobalRef(vm, surface)
		return nil, errors.New("failed to initialize Android MediaPlayer")
	}

	var identity [16]float32
	identity[0] = 1.0
	identity[5] = 1.0
	identity[10] = 1.0
	identity[15] = 1.0

	return &AndroidPlayer{
		vm:          vm,
		surfaceTex:  st,
		surface:     surface,
		mediaPlayer: mp,
		texID:       texID,
		transform:   identity,
		state:       StateIdle,
		speed:       1.0,
		volume:      1.0,
	}, nil
}

func (p *AndroidPlayer) OpenURI(uri string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	rawPath := uri
	if strings.HasPrefix(rawPath, "file://") {
		rawPath = strings.TrimPrefix(rawPath, "file://")
	}

	cURI := C.CString(rawPath)
	defer C.free(unsafe.Pointer(cURI))

	if !bool(C.mpSetDataSourceURI(p.vm, p.mediaPlayer, p.surface, cURI)) {
		p.state = StateError
		return errors.New("failed to set data source for URI")
	}

	durMS := int(C.mpGetDuration(p.vm, p.mediaPlayer))
	p.duration = time.Duration(durMS) * time.Millisecond

	var w, h C.int
	C.mpGetDimensions(p.vm, p.mediaPlayer, &w, &h)
	p.width = int(w)
	p.height = int(h)

	p.state = StatePaused
	return nil
}

func (p *AndroidPlayer) OpenFD(fd uintptr, offset, length int64) error {
	// For file descriptors, can construct URI "fd://..." or use setDataSource(fd, offset, length)
	return p.OpenURI("")
}

func (p *AndroidPlayer) Release() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if !bool(C.isNullJObject(p.mediaPlayer)) {
		C.releaseGlobalRef(p.vm, p.mediaPlayer)
		p.mediaPlayer = C.nullJObject()
	}
	if !bool(C.isNullJObject(p.surface)) {
		C.releaseGlobalRef(p.vm, p.surface)
		p.surface = C.nullJObject()
	}
	if !bool(C.isNullJObject(p.surfaceTex)) {
		C.releaseGlobalRef(p.vm, p.surfaceTex)
		p.surfaceTex = C.nullJObject()
	}
	p.state = StateIdle
}

func (p *AndroidPlayer) Play() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	C.mpPlay(p.vm, p.mediaPlayer)
	p.state = StatePlaying
	return nil
}

func (p *AndroidPlayer) Pause() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	C.mpPause(p.vm, p.mediaPlayer)
	p.state = StatePaused
	return nil
}

func (p *AndroidPlayer) Seek(position time.Duration) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	C.mpSeek(p.vm, p.mediaPlayer, C.int(position.Milliseconds()))
	return nil
}

func (p *AndroidPlayer) SetPlaybackSpeed(speed float32) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.speed = speed
	C.mpSetSpeed(p.vm, p.mediaPlayer, C.float(speed))
	return nil
}

func (p *AndroidPlayer) SetVolume(volume float32) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.volume = volume
	C.mpSetVolume(p.vm, p.mediaPlayer, C.float(volume))
	return nil
}

func (p *AndroidPlayer) State() PlaybackState {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.state
}

func (p *AndroidPlayer) Position() time.Duration {
	p.mu.RLock()
	defer p.mu.RUnlock()
	ms := int(C.mpGetPosition(p.vm, p.mediaPlayer))
	return time.Duration(ms) * time.Millisecond
}

func (p *AndroidPlayer) Duration() time.Duration {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.duration
}

func (p *AndroidPlayer) VideoDimensions() (int, int) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.width, p.height
}

func (p *AndroidPlayer) AudioTracks() []TrackInfo {
	return []TrackInfo{
		{Index: 0, Type: "audio", Language: "und", Title: "Track 1", Channels: 2, Selected: true},
	}
}

func (p *AndroidPlayer) SelectAudioTrack(index int) error {
	return nil
}

func (p *AndroidPlayer) SubtitleTracks() []TrackInfo {
	return []TrackInfo{}
}

func (p *AndroidPlayer) SelectSubtitleTrack(index int) error {
	return nil
}

func (p *AndroidPlayer) UpdateTexImage() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if !bool(C.updateSurfaceTexture(p.vm, p.surfaceTex, (*C.float)(&p.transform[0]))) {
		return errors.New("failed to update SurfaceTexture")
	}
	return nil
}

func (p *AndroidPlayer) TextureID() uint32 {
	return p.texID
}

func (p *AndroidPlayer) TextureTransform() [16]float32 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.transform
}
