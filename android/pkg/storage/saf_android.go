//go:build android

package storage

/*
#cgo LDFLAGS: -landroid

#include <jni.h>
#include <stdlib.h>
#include <stdbool.h>

static JNIEnv* getStorageEnv(JavaVM* vm) {
    JNIEnv* env = NULL;
    if ((*vm)->GetEnv(vm, (void**)&env, JNI_VERSION_1_6) != JNI_OK) {
        if ((*vm)->AttachCurrentThread(vm, &env, NULL) != JNI_OK) {
            return NULL;
        }
    }
    return env;
}
*/
import "C"

import (
	"os"
	"path/filepath"

	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

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
		"/sdcard/Movies",
		"/sdcard/Download",
		"/sdcard/DCIM",
		"/sdcard/VR",
		"/storage/emulated/0/Movies",
		"/storage/emulated/0/Download",
	}

	var allVideos []appstate.VideoItem
	seen := make(map[string]bool)

	for _, loc := range locations {
		if items, err := ScanDirectory(loc); err == nil {
			for _, item := range items {
				if !seen[item.Path] {
					seen[item.Path] = true
					allVideos = append(allVideos, item)
				}
			}
		}
	}

	return allVideos
}
