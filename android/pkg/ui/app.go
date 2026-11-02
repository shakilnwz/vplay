package ui

import (
	"fmt"
	"image"
	"time"

	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/unit"
	"gioui.org/widget"
	"gioui.org/widget/material"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// App manages the overall UI view hierarchy, HUD overlays, and animations.
type App struct {
	State      *appstate.AppState
	Theme      *material.Theme
	Invalidate func()

	Overlay    *Overlay
	LockMgr    *LockScreenManager
	Gestures   *GestureHandler
	Explorer   *Explorer

	btnOpenMenu    widget.Clickable
	btnOpenInitial widget.Clickable
}

// NewApp creates a new UI coordinator instance.
func NewApp(state *appstate.AppState) *App {
	overlay := NewOverlay()
	explorer := NewExplorer()

	app := &App{
		State:    state,
		Theme:    NewTheme(),
		Overlay:  overlay,
		LockMgr:  NewLockScreenManager(),
		Gestures: NewGestureHandler(),
		Explorer: explorer,
	}

	overlay.OnOpenDrawer = func() {
		state.FolderDrawerOpen = true
	}
	explorer.OnClose = func() {
		state.FolderDrawerOpen = false
	}
	explorer.OnSelectVideo = func(v appstate.VideoItem, startFrom time.Duration) {
		state.CurrentVideo = &v
		state.Position = startFrom
		state.IsPlaying = true
		state.FolderDrawerOpen = false
	}

	return app
}

// Layout renders the entire player interface for the current frame.
func (a *App) Layout(gtx layout.Context) layout.Dimensions {
	// Auto-hide controls check: if playing and controls visible for >3.5s with no user input
	if a.State.IsPlaying && a.State.ControlsVisible && !a.State.IsLocked && !a.State.FolderDrawerOpen {
		if time.Since(a.State.LastUserAction) > 3500*time.Millisecond {
			a.State.ControlsVisible = false
			gtx.Execute(op.InvalidateCmd{})
		}
	}

	// 1. Draw solid cinema dark background only when no video is playing
	if a.State.CurrentVideo == nil {
		paint.Fill(gtx.Ops, ColorBackground)
	}

	return layout.Stack{}.Layout(gtx,
		// Layer 0: 3D / Video viewport area (fills entire screen)
		layout.Stacked(func(gtx layout.Context) layout.Dimensions {
			gtx.Constraints.Min = gtx.Constraints.Max
			return a.layoutViewportPlaceholder(gtx)
		}),

		// Layer 1: Gesture recognizer (single-finger 360 drag, brightness/volume swipes, pinch FOV)
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			if !a.State.IsLocked && !a.State.FolderDrawerOpen && a.State.CurrentVideo != nil {
				return a.Gestures.Layout(gtx, a.State)
			}
			return layout.Dimensions{}
		}),

		// Layer 2: On-Screen Display (OSD) controls when visible
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			if a.State.ControlsVisible && !a.State.IsLocked && !a.State.FolderDrawerOpen {
				return a.Overlay.Layout(gtx, a.Theme, a.State)
			}
			return layout.Dimensions{}
		}),

		// Layer 2.5: Top-Left Floating Sidebar Trigger (matching App.vue)
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			if !a.State.IsLocked && !a.State.FolderDrawerOpen && (a.State.ControlsVisible || a.State.CurrentVideo == nil) {
				if a.btnOpenMenu.Clicked(gtx) {
					a.State.FolderDrawerOpen = true
					a.State.ControlsVisible = true
					gtx.Execute(op.InvalidateCmd{})
				}
				return layout.NW.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					return layout.Inset{
						Top:  unit.Dp(16),
						Left: unit.Dp(16),
					}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
						ib := material.IconButton(a.Theme, &a.btnOpenMenu, AppIcons.Menu, "Open Library")
						ib.Background = ColorPrimary
						ib.Color = ColorTextPrimary
						ib.Size = unit.Dp(24)
						ib.Inset = layout.UniformInset(unit.Dp(10))
						return ib.Layout(gtx)
					})
				})
			}
			return layout.Dimensions{}
		}),

		// Layer 3: Dynamic MX Player HUD overlays (Brightness, Volume 200%, Seek Preview)
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			if !a.State.FolderDrawerOpen {
				return a.layoutHUDOverlays(gtx)
			}
			return layout.Dimensions{}
		}),

		// Layer 4: Screen Lock touch interceptor (when locked)
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			return a.LockMgr.InterceptGestures(gtx, a.State)
		}),

		// Layer 5: Screen Lock floating badge
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			return a.LockMgr.LayoutLockBadge(gtx, a.Theme, a.State)
		}),

		// Layer 6: MX Player Folder Explorer (when open)
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			if a.State.FolderDrawerOpen {
				return a.Explorer.Layout(gtx, a.Theme, a.State)
			}
			return layout.Dimensions{}
		}),
	)
}

// layoutViewportPlaceholder displays welcome screen when no video is selected.
func (a *App) layoutViewportPlaceholder(gtx layout.Context) layout.Dimensions {
	if a.State.CurrentVideo != nil {
		return layout.Dimensions{Size: gtx.Constraints.Max}
	}

	return layout.Center.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		if a.btnOpenInitial.Clicked(gtx) {
			a.State.FolderDrawerOpen = true
			gtx.Execute(op.InvalidateCmd{})
		}

		return layout.Flex{Axis: layout.Vertical, Alignment: layout.Middle}.Layout(gtx,
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				lbl := material.H5(a.Theme, "VPlay")
				lbl.Color = ColorPrimary
				return lbl.Layout(gtx)
			}),
			layout.Rigid(layout.Spacer{Height: unit.Dp(8)}.Layout),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				lbl := material.Body2(a.Theme, "Select a 3D SBS or 360° video to flatten and play")
				lbl.Color = ColorTextSecondary
				return lbl.Layout(gtx)
			}),
			layout.Rigid(layout.Spacer{Height: unit.Dp(16)}.Layout),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				btn := material.Button(a.Theme, &a.btnOpenInitial, "Open Library")
				btn.Background = ColorPrimary
				return btn.Layout(gtx)
			}),
		)
	})
}

// layoutHUDOverlays renders MX Player's vertical brightness/volume bars and seek preview badge.
func (a *App) layoutHUDOverlays(gtx layout.Context) layout.Dimensions {
	return layout.Stack{}.Layout(gtx,
		// Left: Brightness HUD slider
		layout.Stacked(func(gtx layout.Context) layout.Dimensions {
			if a.State.ShowBrightnessHUD {
				return a.layoutBrightnessHUD(gtx)
			}
			return layout.Dimensions{}
		}),
		// Right: Volume HUD slider (with 200% boost)
		layout.Stacked(func(gtx layout.Context) layout.Dimensions {
			if a.State.ShowVolumeHUD {
				return a.layoutVolumeHUD(gtx)
			}
			return layout.Dimensions{}
		}),
		// Center: Horizontal seek scrub preview badge
		layout.Stacked(func(gtx layout.Context) layout.Dimensions {
			if a.State.ShowSeekHUD {
				return a.layoutSeekHUD(gtx)
			}
			return layout.Dimensions{}
		}),
	)
}

func (a *App) layoutBrightnessHUD(gtx layout.Context) layout.Dimensions {
	return layout.W.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Inset{Left: unit.Dp(32)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
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
					return layout.UniformInset(unit.Dp(16)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
						pct := int(a.State.Brightness * 100)
						lbl := material.Body1(a.Theme, fmt.Sprintf("Brightness: %d%%", pct))
						lbl.Color = ColorTextPrimary
						return lbl.Layout(gtx)
					})
				},
			)
		})
	})
}

func (a *App) layoutVolumeHUD(gtx layout.Context) layout.Dimensions {
	return layout.E.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Inset{Right: unit.Dp(32)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
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
					return layout.UniformInset(unit.Dp(16)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
						pct := int(a.State.Volume * 100)
						txtColor := ColorTextPrimary
						prefix := "Volume: "
						if a.State.Volume > 1.0 {
							txtColor = ColorAccentOrange
							prefix = "Boost: "
						}
						lbl := material.Body1(a.Theme, fmt.Sprintf("%s%d%%", prefix, pct))
						lbl.Color = txtColor
						return lbl.Layout(gtx)
					})
				},
			)
		})
	})
}

func (a *App) layoutSeekHUD(gtx layout.Context) layout.Dimensions {
	return layout.Center.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
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
				return layout.UniformInset(unit.Dp(16)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					sign := "+"
					delta := a.State.SeekDeltaSeconds
					if delta < 0 {
						sign = "-"
						delta = -delta
					}
					lbl := material.H6(a.Theme, fmt.Sprintf("[%s%.0fs] Seeking...", sign, delta))
					lbl.Color = ColorPrimary
					return lbl.Layout(gtx)
				})
			},
		)
	})
}
