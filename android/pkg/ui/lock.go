package ui

import (
	"image"
	"time"

	"gioui.org/io/event"
	"gioui.org/io/pointer"
	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/unit"
	"gioui.org/widget/material"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// LockScreenManager handles MX Player Kid Lock gesture isolation and unlocking.
type LockScreenManager struct {
	lastTapTime time.Time
	tapCount    int
	showUnlockHint bool
	hintTime    time.Time
}

// NewLockScreenManager creates a lock manager.
func NewLockScreenManager() *LockScreenManager {
	return &LockScreenManager{}
}

// InterceptGestures intercepts all screen touch events when locked to prevent mis-taps.
func (lm *LockScreenManager) InterceptGestures(gtx layout.Context, state *appstate.AppState) layout.Dimensions {
	if !state.IsLocked {
		return layout.Dimensions{}
	}

	defer clip.Rect{Max: gtx.Constraints.Max}.Push(gtx.Ops).Pop()
	event.Op(gtx.Ops, lm)

	for {
		ev, ok := gtx.Event(pointer.Filter{
			Target: lm,
			Kinds:  pointer.Press | pointer.Release,
		})
		if !ok {
			break
		}
		pe, ok := ev.(pointer.Event)
		if !ok {
			continue
		}

		if pe.Kind == pointer.Press {
			now := time.Now()
			if now.Sub(lm.lastTapTime) < 350*time.Millisecond {
				// Double tap anywhere unlocks screen!
				state.SetLocked(false)
				state.TouchActivity()
				lm.showUnlockHint = false
				gtx.Execute(op.InvalidateCmd{})
			} else {
				lm.showUnlockHint = true
				lm.hintTime = now
				gtx.Execute(op.InvalidateCmd{})
			}
			lm.lastTapTime = now
		}
	}

	return layout.Dimensions{Size: gtx.Constraints.Max}
}

// LayoutLockBadge draws the floating MX Player lock badge and unlock hint.
func (lm *LockScreenManager) LayoutLockBadge(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	if !state.IsLocked {
		return layout.Dimensions{}
	}

	// Auto-dismiss unlock hint after 2.5s
	if lm.showUnlockHint && time.Since(lm.hintTime) > 2500*time.Millisecond {
		lm.showUnlockHint = false
	}

	return layout.NW.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.UniformInset(unit.Dp(24)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
			return layout.Background{}.Layout(gtx,
				func(gtx layout.Context) layout.Dimensions {
					defer clip.RRect{
						Rect: image.Rectangle{Max: gtx.Constraints.Min},
						NE:   8, NW: 8, SE: 8, SW: 8,
					}.Push(gtx.Ops).Pop()
					paint.Fill(gtx.Ops, ColorHUDOverlay)
					return layout.Dimensions{Size: gtx.Constraints.Min}
				},
				func(gtx layout.Context) layout.Dimensions {
					return layout.UniformInset(unit.Dp(10)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
						text := "🔒 Screen Locked"
						if lm.showUnlockHint {
							text = "🔒 Double-tap anywhere to unlock"
						}
						lbl := material.Body2(th, text)
						lbl.Color = ColorLockActive
						return lbl.Layout(gtx)
					})
				},
			)
		})
	})
}
