package main

import (
	"log"
	"os"
	"time"

	"gioui.org/app"
	"gioui.org/op"
	"gioui.org/unit"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
	"github.com/shakilnwz/vplay/android/pkg/storage"
	"github.com/shakilnwz/vplay/android/pkg/ui"
)

func main() {
	state := appstate.New()
	playerUI := ui.NewApp(state)

	// Populate initial library videos with samples and scanned media
	videos := []appstate.VideoItem{
		{
			URI:          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
			Title:        "Big Buck Bunny (Sample)",
			Path:         "Samples/BigBuckBunny.mp4",
			Duration:     596 * time.Second,
			LastPosition: 45 * time.Second,
		},
		{
			URI:          "sample_vr_360.mp4",
			Title:        "Rollercoaster 360° VR",
			Path:         "VR 360/rollercoaster_360.mp4",
			Duration:     180 * time.Second,
			LastPosition: 0,
		},
		{
			URI:          "sample_sbs_180.mp4",
			Title:        "Space Station SBS 3D 180°",
			Path:         "VR 180 SBS/spacestation_sbs.mp4",
			Duration:     320 * time.Second,
			LastPosition: 120 * time.Second,
		},
	}
	if local, err := storage.ScanDirectory("."); err == nil && len(local) > 0 {
		videos = append(videos, local...)
	}
	playerUI.Explorer.SetVideos(videos)

	go func() {
		// Default landscape orientation preferred for VR and video viewing
		w := new(app.Window)
		w.Option(
			app.Title("VR Player"),
			app.Size(unit.Dp(844), unit.Dp(390)),
			app.MinSize(unit.Dp(480), unit.Dp(320)),
		)

		playerUI.Invalidate = w.Invalidate
		if err := runEventLoop(w, playerUI); err != nil {
			log.Fatalf("Window event loop error: %v", err)
		}
		os.Exit(0)
	}()

	app.Main()
}

func runEventLoop(w *app.Window, playerUI *ui.App) error {
	var ops op.Ops
	for {
		switch e := w.Event().(type) {
		case app.DestroyEvent:
			return e.Err
		case app.FrameEvent:
			gtx := app.NewContext(&ops, e)
			playerUI.Layout(gtx)
			e.Frame(gtx.Ops)
		}
	}
}
