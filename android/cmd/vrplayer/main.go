package main

import (
	"log"
	"os"

	"gioui.org/app"
	"gioui.org/op"
	"gioui.org/unit"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
	"github.com/shakilnwz/vplay/android/pkg/ui"
)

func main() {
	state := appstate.New()
	playerUI := ui.NewApp(state)

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
