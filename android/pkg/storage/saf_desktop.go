//go:build !android

package storage

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
