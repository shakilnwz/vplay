//go:build !android

package main

import (
	"gioui.org/app"
	"gioui.org/op"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
	"github.com/shakilnwz/vplay/android/pkg/sensor"
	"github.com/shakilnwz/vplay/android/pkg/ui"
	"github.com/shakilnwz/vplay/android/pkg/video"
)

func runEventLoop(w *app.Window, playerUI *ui.App, state *appstate.AppState, backendRef *video.Player, tracker *sensor.Tracker) error {
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
