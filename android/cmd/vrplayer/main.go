package main

import (
	"log"
	_ "net"
	"os"
	"time"

	"gioui.org/app"
	_ "gioui.org/app/permission/storage"
	_ "gioui.org/app/permission/wakelock"
	"gioui.org/unit"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
	"github.com/shakilnwz/vplay/android/pkg/sensor"
	"github.com/shakilnwz/vplay/android/pkg/storage"
	"github.com/shakilnwz/vplay/android/pkg/ui"
	"github.com/shakilnwz/vplay/android/pkg/video"
)

func main() {
	state := appstate.New()
	playerUI := ui.NewApp(state)

	var backendPlayer video.Player
	sensorTracker := sensor.NewTracker()
	sensorListener := sensor.NewSensorListener(sensorTracker)
	_ = sensorListener.Start()

	// Connect UI transport controls to playback backend
	playerUI.Overlay.OnPlayPause = func() {
		if backendPlayer != nil {
			if state.IsPlaying {
				_ = backendPlayer.Play()
			} else {
				_ = backendPlayer.Pause()
			}
		}
	}

	playerUI.Overlay.OnSeek = func(target time.Duration) {
		if backendPlayer != nil {
			_ = backendPlayer.Seek(target)
		}
	}

	playerUI.Overlay.OnVolume = func(vol float32) {
		if backendPlayer != nil {
			_ = backendPlayer.SetVolume(vol)
		}
	}

	playerUI.Overlay.OnPlaybackSpeed = func(speed float32) {
		if backendPlayer != nil {
			_ = backendPlayer.SetPlaybackSpeed(speed)
		}
	}

	playerUI.Gestures.OnSeek = func(target time.Duration) {
		if backendPlayer != nil {
			_ = backendPlayer.Seek(target)
		}
	}

	playerUI.Gestures.OnVolume = func(vol float32) {
		if backendPlayer != nil {
			_ = backendPlayer.SetVolume(vol)
		}
	}

	playerUI.Gestures.OnPlaybackSpeed = func(speed float32) {
		if backendPlayer != nil {
			_ = backendPlayer.SetPlaybackSpeed(speed)
		}
	}

	playerUI.Overlay.OnRecenter = func() {
		sensorTracker.Recenter()
	}

	oldSelectVideo := playerUI.Explorer.OnSelectVideo
	playerUI.Explorer.OnSelectVideo = func(v appstate.VideoItem, startFrom time.Duration) {
		if oldSelectVideo != nil {
			oldSelectVideo(v, startFrom)
		}
		if backendPlayer != nil {
			_ = backendPlayer.OpenURI(v.URI)
			if startFrom > 0 {
				_ = backendPlayer.Seek(startFrom)
			}
			_ = backendPlayer.Play()
			w, h := backendPlayer.VideoDimensions()
			if w > 0 && h > 0 {
				v.Width = w
				v.Height = h
			}
			dur := backendPlayer.Duration()
			if dur > 0 {
				v.Duration = dur
				state.Duration = dur
			}
		}
	}

	// Populate initial library videos by scanning device storage (Movies, Downloads, DCIM)
	videos := storage.ScanDefaultStorageLocations()

	// Append valid demo online stream
	samples := []appstate.VideoItem{
		{
			URI:          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
			Title:        "Big Buck Bunny (Sample)",
			Path:         "Samples/BigBuckBunny.mp4",
			Duration:     596 * time.Second,
			LastPosition: 45 * time.Second,
		},
	}
	videos = append(videos, samples...)
	playerUI.Explorer.SetVideos(videos)

	// Open the Media Explorer by default so the user can immediately select a video
	state.FolderDrawerOpen = true

	// Sync playback state periodically
	go func() {
		ticker := time.NewTicker(250 * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			if backendPlayer != nil && state.IsPlaying && !playerUI.Overlay.IsScrubberDragging() && !playerUI.Gestures.IsSeeking() {
				pos := backendPlayer.Position()
				dur := backendPlayer.Duration()
				if dur > 0 {
					state.Duration = dur
				}
				if pos > 0 {
					state.Position = pos
				}
				if playerUI.Invalidate != nil {
					playerUI.Invalidate()
				}
			}
		}
	}()

	go func() {
		// Default landscape orientation preferred for VR and video viewing
		w := new(app.Window)
		w.Option(
			app.CustomRenderer(true),
			app.Title("VPlay"),
			app.Size(unit.Dp(844), unit.Dp(390)),
			app.MinSize(unit.Dp(480), unit.Dp(320)),
		)

		playerUI.Invalidate = w.Invalidate
		if err := runEventLoop(w, playerUI, state, &backendPlayer, sensorTracker); err != nil {
			log.Fatalf("Window event loop error: %v", err)
		}
		os.Exit(0)
	}()

	app.Main()
}
