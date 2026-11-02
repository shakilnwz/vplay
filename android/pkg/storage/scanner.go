package storage

import (
	"path/filepath"
	"sort"
	"strings"

	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// Supported video file extensions.
var videoExtensions = map[string]bool{
	".mp4":  true,
	".mkv":  true,
	".webm": true,
	".mov":  true,
	".avi":  true,
	".3gp":  true,
	".ts":   true,
}

// IsVideoFile checks if the filename has a supported video extension.
func IsVideoFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	return videoExtensions[ext]
}

// SortOrder defines sorting criteria for the video library.
type SortOrder string

const (
	SortNameAsc     SortOrder = "name_asc"
	SortNameDesc    SortOrder = "name_desc"
	SortDateNewest  SortOrder = "date_newest"
	SortDateOldest  SortOrder = "date_oldest"
	SortDurationMax SortOrder = "duration_max"
	SortDurationMin SortOrder = "duration_min"
	SortSizeMax     SortOrder = "size_max"
	SortSizeMin     SortOrder = "size_min"
)

// SortVideos sorts a slice of VideoItems according to the given order.
func SortVideos(videos []appstate.VideoItem, order SortOrder) []appstate.VideoItem {
	sorted := make([]appstate.VideoItem, len(videos))
	copy(sorted, videos)

	switch order {
	case SortNameAsc:
		sort.Slice(sorted, func(i, j int) bool {
			return strings.ToLower(sorted[i].Title) < strings.ToLower(sorted[j].Title)
		})
	case SortNameDesc:
		sort.Slice(sorted, func(i, j int) bool {
			return strings.ToLower(sorted[i].Title) > strings.ToLower(sorted[j].Title)
		})
	case SortDateNewest:
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].LastModified.After(sorted[j].LastModified)
		})
	case SortDateOldest:
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].LastModified.Before(sorted[j].LastModified)
		})
	case SortDurationMax:
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Duration > sorted[j].Duration
		})
	case SortDurationMin:
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Duration < sorted[j].Duration
		})
	case SortSizeMax:
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Size > sorted[j].Size
		})
	case SortSizeMin:
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].Size < sorted[j].Size
		})
	default:
		// Default to date newest
		sort.Slice(sorted, func(i, j int) bool {
			return sorted[i].LastModified.After(sorted[j].LastModified)
		})
	}

	return sorted
}

// FilterVideos filters video items by query and format tag.
func FilterVideos(videos []appstate.VideoItem, query, tag string) []appstate.VideoItem {
	var filtered []appstate.VideoItem
	q := strings.ToLower(strings.TrimSpace(query))
	t := strings.ToLower(strings.TrimSpace(tag))

	for _, v := range videos {
		// 1. Text search matching
		if q != "" && !strings.Contains(strings.ToLower(v.Title), q) {
			continue
		}

		// 2. Tag matching
		if t != "" && t != "all" {
			titleLower := strings.ToLower(v.Title)
			switch t {
			case "360":
				if !strings.Contains(titleLower, "360") && !strings.Contains(titleLower, "sphere") {
					continue
				}
			case "180":
				if !strings.Contains(titleLower, "180") && !strings.Contains(titleLower, "vr180") {
					continue
				}
			case "sbs":
				if !strings.Contains(titleLower, "sbs") && !strings.Contains(titleLower, "3d") {
					continue
				}
			case "watched":
				if !v.IsWatched && v.LastPosition == 0 {
					continue
				}
			}
		}

		filtered = append(filtered, v)
	}

	return filtered
}

// GroupVideosByFolder groups a flat list of videos into folder buckets.
func GroupVideosByFolder(videos []appstate.VideoItem) map[string][]appstate.VideoItem {
	folders := make(map[string][]appstate.VideoItem)
	for _, v := range videos {
		dir := filepath.Dir(v.Path)
		folderName := filepath.Base(dir)
		if folderName == "" || folderName == "." {
			folderName = "Internal Storage"
		}
		folders[folderName] = append(folders[folderName], v)
	}
	return folders
}
