//go:build android

package storage

/*
#cgo LDFLAGS: -landroid

#include <jni.h>
#include <stdlib.h>
#include <stdbool.h>
#include <android/log.h>

#define LOG_TAG "VRPlayerStorage"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static JNIEnv* getStorageEnv(JavaVM* vm) {
    JNIEnv* env = NULL;
    if ((*vm)->GetEnv(vm, (void**)&env, JNI_VERSION_1_6) != JNI_OK) {
        if ((*vm)->AttachCurrentThread(vm, &env, NULL) != JNI_OK) {
            return NULL;
        }
    }
    return env;
}

static jobject getActivityFromView(JNIEnv* env, jobject viewObj) {
    if (!viewObj) return NULL;
    jclass viewClass = (*env)->GetObjectClass(env, viewObj);
    if (!viewClass) return NULL;
    jmethodID getCtx = (*env)->GetMethodID(env, viewClass, "getContext", "()Landroid/content/Context;");
    if (!getCtx) {
        (*env)->ExceptionClear(env);
        return NULL;
    }
    jobject ctx = (*env)->CallObjectMethod(env, viewObj, getCtx);
    if (!ctx) return NULL;

    jclass actClass = (*env)->FindClass(env, "android/app/Activity");
    jclass wrapperClass = (*env)->FindClass(env, "android/content/ContextWrapper");
    jmethodID getBaseCtx = (*env)->GetMethodID(env, wrapperClass, "getBaseContext", "()Landroid/content/Context;");

    while (ctx != NULL) {
        if ((*env)->IsInstanceOf(env, ctx, actClass)) {
            return ctx;
        }
        if ((*env)->IsInstanceOf(env, ctx, wrapperClass)) {
            ctx = (*env)->CallObjectMethod(env, ctx, getBaseCtx);
        } else {
            break;
        }
    }
    return NULL;
}

static int getSDKInt(JNIEnv* env) {
    jclass versionClass = (*env)->FindClass(env, "android/os/Build$VERSION");
    if (!versionClass) return 0;
    jfieldID sdkIntField = (*env)->GetStaticFieldID(env, versionClass, "SDK_INT", "I");
    if (!sdkIntField) return 0;
    return (*env)->GetStaticIntField(env, versionClass, sdkIntField);
}

static bool cHasStoragePermission(JavaVM* vm, jobject viewObj) {
    if (!vm || !viewObj) return false;
    JNIEnv* env = getStorageEnv(vm);
    if (!env) return false;
    jobject act = getActivityFromView(env, viewObj);
    if (!act) return false;

    int sdkInt = getSDKInt(env);
    const char* perm = (sdkInt >= 33) ? "android.permission.READ_MEDIA_VIDEO" : "android.permission.READ_EXTERNAL_STORAGE";

    jclass actClass = (*env)->FindClass(env, "android/app/Activity");
    jmethodID checkSelf = (*env)->GetMethodID(env, actClass, "checkSelfPermission", "(Ljava/lang/String;)I");
    if (!checkSelf) {
        (*env)->ExceptionClear(env);
        return false;
    }
    jstring jPerm = (*env)->NewStringUTF(env, perm);
    jint res = (*env)->CallIntMethod(env, act, checkSelf, jPerm);
    (*env)->DeleteLocalRef(env, jPerm);
    if ((*env)->ExceptionCheck(env)) {
        (*env)->ExceptionClear(env);
        return false;
    }
    return (res == 0);
}

static void cRequestStoragePermission(JavaVM* vm, jobject viewObj) {
    if (!vm || !viewObj) return;
    JNIEnv* env = getStorageEnv(vm);
    if (!env) return;
    jobject act = getActivityFromView(env, viewObj);
    if (!act) {
        LOGE("requestStoragePermission: activity not found");
        return;
    }

    int sdkInt = getSDKInt(env);
    jclass actClass = (*env)->FindClass(env, "android/app/Activity");
    jmethodID reqPerm = (*env)->GetMethodID(env, actClass, "requestPermissions", "([Ljava/lang/String;I)V");
    if (!reqPerm) {
        (*env)->ExceptionClear(env);
        return;
    }

    jclass stringClass = (*env)->FindClass(env, "java/lang/String");
    jobjectArray arr;
    if (sdkInt >= 33) {
        arr = (*env)->NewObjectArray(env, 2, stringClass, NULL);
        jstring p1 = (*env)->NewStringUTF(env, "android.permission.READ_MEDIA_VIDEO");
        jstring p2 = (*env)->NewStringUTF(env, "android.permission.READ_MEDIA_IMAGES");
        (*env)->SetObjectArrayElement(env, arr, 0, p1);
        (*env)->SetObjectArrayElement(env, arr, 1, p2);
        (*env)->DeleteLocalRef(env, p1);
        (*env)->DeleteLocalRef(env, p2);
    } else {
        arr = (*env)->NewObjectArray(env, 1, stringClass, NULL);
        jstring p1 = (*env)->NewStringUTF(env, "android.permission.READ_EXTERNAL_STORAGE");
        (*env)->SetObjectArrayElement(env, arr, 0, p1);
        (*env)->DeleteLocalRef(env, p1);
    }

    LOGI("Calling requestPermissions for SDK %d", sdkInt);
    (*env)->CallVoidMethod(env, act, reqPerm, arr, 1001);
    (*env)->DeleteLocalRef(env, arr);
    if ((*env)->ExceptionCheck(env)) {
        (*env)->ExceptionClear(env);
    }
}

static void cOpenAppSettings(JavaVM* vm, jobject viewObj) {
    if (!vm || !viewObj) return;
    JNIEnv* env = getStorageEnv(vm);
    if (!env) return;
    jobject act = getActivityFromView(env, viewObj);
    if (!act) return;

    jclass intentClass = (*env)->FindClass(env, "android/content/Intent");
    jstring actionSettings = (*env)->NewStringUTF(env, "android.settings.APPLICATION_DETAILS_SETTINGS");
    jmethodID intentCtor = (*env)->GetMethodID(env, intentClass, "<init>", "(Ljava/lang/String;)V");
    jobject intent = (*env)->NewObject(env, intentClass, intentCtor, actionSettings);

    jclass actClass = (*env)->FindClass(env, "android/app/Activity");
    jmethodID getPkg = (*env)->GetMethodID(env, actClass, "getPackageName", "()Ljava/lang/String;");
    jstring pkgName = (*env)->CallObjectMethod(env, act, getPkg);

    jclass uriClass = (*env)->FindClass(env, "android/net/Uri");
    jmethodID fromParts = (*env)->GetStaticMethodID(env, uriClass, "fromParts", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Landroid/net/Uri;");
    jstring scheme = (*env)->NewStringUTF(env, "package");
    jobject uri = (*env)->CallStaticObjectMethod(env, uriClass, fromParts, scheme, pkgName, NULL);

    jmethodID setData = (*env)->GetMethodID(env, intentClass, "setData", "(Landroid/net/Uri;)Landroid/content/Intent;");
    (*env)->CallObjectMethod(env, intent, setData, uri);

    jmethodID startAct = (*env)->GetMethodID(env, actClass, "startActivity", "(Landroid/content/Intent;)V");
    (*env)->CallVoidMethod(env, act, startAct, intent);

    (*env)->DeleteLocalRef(env, actionSettings);
    (*env)->DeleteLocalRef(env, pkgName);
    (*env)->DeleteLocalRef(env, scheme);
    (*env)->DeleteLocalRef(env, uri);
    (*env)->DeleteLocalRef(env, intent);
    if ((*env)->ExceptionCheck(env)) {
        (*env)->ExceptionClear(env);
    }
}
*/
import "C"

import (
	"os"
	"path/filepath"
	"sync"
	"unsafe"

	"gioui.org/app"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

var (
	viewMu      sync.Mutex
	currentView uintptr
	reqOnce     sync.Once
)

// SetAndroidView stores the current GioView pointer for JNI calls.
func SetAndroidView(view uintptr) {
	viewMu.Lock()
	defer viewMu.Unlock()
	currentView = view
}

// GetAndroidView returns the current GioView pointer.
func GetAndroidView() uintptr {
	viewMu.Lock()
	defer viewMu.Unlock()
	return currentView
}

// HasStoragePermission checks if video/storage read permission is granted.
func HasStoragePermission() bool {
	v := GetAndroidView()
	if v == 0 {
		return false
	}
	jvmPtr := app.JavaVM()
	if jvmPtr == 0 {
		return false
	}
	vm := (*C.JavaVM)(unsafe.Pointer(jvmPtr))
	viewObj := C.jobject(unsafe.Pointer(v))
	return bool(C.cHasStoragePermission(vm, viewObj))
}

// RequestStoragePermission requests media permissions from the user.
func RequestStoragePermission() bool {
	v := GetAndroidView()
	if v == 0 {
		return false
	}
	jvmPtr := app.JavaVM()
	if jvmPtr == 0 {
		return false
	}
	vm := (*C.JavaVM)(unsafe.Pointer(jvmPtr))
	viewObj := C.jobject(unsafe.Pointer(v))
	if bool(C.cHasStoragePermission(vm, viewObj)) {
		return true
	}
	C.cRequestStoragePermission(vm, viewObj)
	return false
}

// CheckAndRequestOnce triggers permission prompt on first launch if needed.
func CheckAndRequestOnce(view uintptr) {
	SetAndroidView(view)
	reqOnce.Do(func() {
		RequestStoragePermission()
	})
}

// OpenAppSettings opens the app details screen in system Settings.
func OpenAppSettings() {
	v := GetAndroidView()
	if v == 0 {
		return
	}
	jvmPtr := app.JavaVM()
	if jvmPtr == 0 {
		return
	}
	vm := (*C.JavaVM)(unsafe.Pointer(jvmPtr))
	viewObj := C.jobject(unsafe.Pointer(v))
	C.cOpenAppSettings(vm, viewObj)
}

// ScanDirectory walks a local folder and extracts all video files.
func ScanDirectory(dirPath string) ([]appstate.VideoItem, error) {
	var videos []appstate.VideoItem

	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && IsVideoFile(info.Name()) {
			videos = append(videos, appstate.VideoItem{
				URI:          "file://" + path,
				Title:        info.Name(),
				Path:         path,
				Size:         info.Size(),
				Duration:     0,
				LastModified: info.ModTime(),
				LastPosition: 0,
				IsWatched:    false,
			})
		}
		return nil
	})

	return videos, err
}

// ScanDefaultStorageLocations scans standard media folders on Android.
func ScanDefaultStorageLocations() []appstate.VideoItem {
	locations := []string{
		"/storage/emulated/0/Movies",
		"/storage/emulated/0/Download",
		"/storage/emulated/0/DCIM",
		"/storage/emulated/0/Videos",
		"/storage/emulated/0/VR",
	}

	var allVideos []appstate.VideoItem
	seen := make(map[string]bool)

	for _, loc := range locations {
		if items, err := ScanDirectory(loc); err == nil {
			for _, item := range items {
				canonicalPath, err := filepath.EvalSymlinks(item.Path)
				if err != nil {
					canonicalPath = item.Path
				}
				if !seen[canonicalPath] {
					seen[canonicalPath] = true
					allVideos = append(allVideos, item)
				}
			}
		}
	}

	return allVideos
}
