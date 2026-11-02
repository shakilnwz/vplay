package ui

import (
	"image"
	"time"

	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/unit"
	"gioui.org/widget/material"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// App manages the overall UI view hierarchy and animations.
type App struct {
	State      *appstate.AppState
	Theme      *material.Theme
	Invalidate func()
}

// NewApp creates a new UI coordinator instance.
func NewApp(state *appstate.AppState) *App {
	return &App{
		State: state,
		Theme: NewTheme(),
	}
}

// Layout renders the entire player interface for the current frame.
func (a *App) Layout(gtx layout.Context) layout.Dimensions {
	// Auto-hide controls check: if playing and controls visible for >3.5s with no input
	if a.State.IsPlaying && a.State.ControlsVisible && !a.State.IsLocked {
		if time.Since(a.State.LastUserAction) > 3500*time.Millisecond {
			a.State.ControlsVisible = false
			gtx.Execute(op.InvalidateCmd{})
		}
	}

	// 1. Draw solid cinema dark background
	paint.Fill(gtx.Ops, ColorBackground)

	return layout.Stack{}.Layout(gtx,
		// Base: 3D / Video viewport area
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			return a.layoutViewportPlaceholder(gtx)
		}),

		// Layer 2: On-Screen Display (OSD) controls when visible
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			if a.State.ControlsVisible && !a.State.IsLocked {
				return a.layoutOSD(gtx)
			}
			return layout.Dimensions{}
		}),

		// Layer 3: MX Player Screen Lock Floating Badge (when locked)
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			if a.State.IsLocked {
				return a.layoutLockBadge(gtx)
			}
			return layout.Dimensions{}
		}),
	)
}

// layoutViewportPlaceholder displays placeholder info until GLES texture pipeline is bound.
func (a *App) layoutViewportPlaceholder(gtx layout.Context) layout.Dimensions {
	return layout.Center.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		title := "VR Player (Go + Gio)"
		if a.State.CurrentVideo != nil {
			title = a.State.CurrentVideo.Title
		}
		lbl := material.H5(a.Theme, title)
		lbl.Color = ColorTextPrimary
		return lbl.Layout(gtx)
	})
}

// layoutOSD renders the top bar, tactile scrubber, transport, and VR quick bar.
func (a *App) layoutOSD(gtx layout.Context) layout.Dimensions {
	return layout.Flex{Axis: layout.Vertical, Spacing: layout.SpaceBetween}.Layout(gtx,
		// Top Bar
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return a.layoutTopBar(gtx)
		}),
		// Center spacer
		layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
			return layout.Dimensions{}
		}),
		// Bottom Scrubber & Transport Bar
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return a.layoutBottomControls(gtx)
		}),
	)
}

// layoutTopBar renders the title marquee, decoder pill, and lock button.
func (a *App) layoutTopBar(gtx layout.Context) layout.Dimensions {
	return layout.Background{}.Layout(gtx,
		func(gtx layout.Context) layout.Dimensions {
			// Scrim gradient backdrop
			defer clip.Rect{Max: gtx.Constraints.Max}.Push(gtx.Ops).Pop()
			paint.Fill(gtx.Ops, ColorSurface)
			return layout.Dimensions{Size: gtx.Constraints.Max}
		},
		func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{
				Top:    unit.Dp(16),
				Bottom: unit.Dp(16),
				Left:   unit.Dp(20),
				Right:  unit.Dp(20),
			}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle}.Layout(gtx,
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						lbl := material.Body1(a.Theme, "◀ Back")
						lbl.Color = ColorPrimary
						return lbl.Layout(gtx)
					}),
					layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(16)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							title := "No video loaded"
							if a.State.CurrentVideo != nil {
								title = a.State.CurrentVideo.Title
							}
							lbl := material.Body1(a.Theme, title)
							lbl.Color = ColorTextPrimary
							return lbl.Layout(gtx)
						})
					}),
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						// HW Decoder Badge
						return layout.Background{}.Layout(gtx,
							func(gtx layout.Context) layout.Dimensions {
								defer clip.RRect{
									Rect: image.Rectangle{Max: gtx.Constraints.Min},
									NE:   4, NW: 4, SE: 4, SW: 4,
								}.Push(gtx.Ops).Pop()
								paint.Fill(gtx.Ops, ColorSurfaceLight)
								return layout.Dimensions{Size: gtx.Constraints.Min}
							},
							func(gtx layout.Context) layout.Dimensions {
								return layout.UniformInset(unit.Dp(4)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
									lbl := material.Caption(a.Theme, a.State.DecoderType)
									lbl.Color = ColorPrimary
									return lbl.Layout(gtx)
								})
							},
						)
					}),
				)
			})
		},
	)
}

// layoutBottomControls renders the timeline and playback controls.
func (a *App) layoutBottomControls(gtx layout.Context) layout.Dimensions {
	return layout.Background{}.Layout(gtx,
		func(gtx layout.Context) layout.Dimensions {
			defer clip.Rect{Max: gtx.Constraints.Max}.Push(gtx.Ops).Pop()
			paint.Fill(gtx.Ops, ColorSurface)
			return layout.Dimensions{Size: gtx.Constraints.Max}
		},
		func(gtx layout.Context) layout.Dimensions {
			return layout.UniformInset(unit.Dp(16)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
					// VR Mode Switcher Chips
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						lbl := material.Caption(a.Theme, "[ 360° Sphere ]  [ SBS 3D ]  [ Swap Eyes ]  [ Recenter 🎯 ]")
						lbl.Color = ColorTextSecondary
						return lbl.Layout(gtx)
					}),
					// Timeline Scrubber
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Top: unit.Dp(8), Bottom: unit.Dp(8)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							lbl := material.Caption(a.Theme, "00:00 ━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━ 00:00")
							lbl.Color = ColorPrimary
							return lbl.Layout(gtx)
						})
					}),
					// Transport Buttons
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle, Spacing: layout.SpaceEvenly}.Layout(gtx,
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								lbl := material.Body1(a.Theme, "⏮ Prev")
								lbl.Color = ColorTextPrimary
								return lbl.Layout(gtx)
							}),
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								lbl := material.Body1(a.Theme, "⏪ -10s")
								lbl.Color = ColorTextPrimary
								return lbl.Layout(gtx)
							}),
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								playText := "▶ PLAY"
								if a.State.IsPlaying {
									playText = "⏸ PAUSE"
								}
								lbl := material.H6(a.Theme, playText)
								lbl.Color = ColorPrimary
								return lbl.Layout(gtx)
							}),
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								lbl := material.Body1(a.Theme, "⏩ +10s")
								lbl.Color = ColorTextPrimary
								return lbl.Layout(gtx)
							}),
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								lbl := material.Body1(a.Theme, "⏭ Next")
								lbl.Color = ColorTextPrimary
								return lbl.Layout(gtx)
							}),
						)
					}),
				)
			})
		},
	)
}

// layoutLockBadge displays the subtle floating lock icon when screen lock is active.
func (a *App) layoutLockBadge(gtx layout.Context) layout.Dimensions {
	return layout.NW.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.UniformInset(unit.Dp(24)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
			lbl := material.Body2(a.Theme, "🔒 Locked (Double-tap to unlock)")
			lbl.Color = ColorLockActive
			return lbl.Layout(gtx)
		})
	})
}
