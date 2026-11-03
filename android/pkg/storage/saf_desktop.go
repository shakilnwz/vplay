//go:build !android

package storage

import (
	"os"
	"path/filepath"

	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// SetAndroidView is a no-op on desktop.
func SetAndroidView(view uintptr) {}

// GetAndroidView returns 0 on desktop.
func GetAndroidView() uintptr { return 0 }

// HasStoragePermission always returns true on desktop.
func HasStoragePermission() bool { return true }

// RequestStoragePermission always returns true on desktop.
func RequestStoragePermission() bool { return true }

// CheckAndRequestOnce is a no-op on desktop.
func CheckAndRequestOnce(view uintptr) {}

// OpenAppSettings is a no-op on desktop.
func OpenAppSettings() {}

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
				Duration:     0, // Will be populated when played
				LastModified: info.ModTime(),
				LastPosition: 0,
				IsWatched:    false,
			})
		}
		return nil
	})

	return videos, err
}

// ScanDefaultStorageLocations returns local videos on desktop.
func ScanDefaultStorageLocations() []appstate.VideoItem {
	home, _ := os.UserHomeDir()
	locations := []string{
		filepath.Join(home, "Videos"),
		filepath.Join(home, "Downloads"),
		".",
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
