package ui

import (
	"fmt"
	"image"
	"image/color"
	"time"

	"gioui.org/layout"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/unit"
	"gioui.org/widget"
	"gioui.org/widget/material"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// Overlay manages the floating controls card matching Controls.vue.
type Overlay struct {
	// Top Header Drawer Toggle
	btnFolders widget.Clickable

	// Compact Row: Play/Pause, Scrubber, Seek, Fullscreen, Accordion
	btnPlayPause  widget.Clickable
	btnRewind10   widget.Clickable
	btnForward10  widget.Clickable
	btnFullscreen widget.Clickable
	btnAccordion  widget.Clickable
	scrubber      widget.Float

	// Expanded Tools Row
	chipsList    layout.List
	btnVolume    widget.Clickable
	btnSpeed     widget.Clickable
	btnViewMode  widget.Clickable
	btnRecenter  widget.Clickable
	btnSBS       widget.Clickable
	btnSBSFormat widget.Clickable
	btnSwapEyes  widget.Clickable
	btnGyro      widget.Clickable
	btnLock      widget.Clickable

	// Callbacks
	OnPlayPause  func()
	OnSeek       func(target time.Duration)
	OnRecenter   func()
	OnOpenDrawer func()
}

// NewOverlay creates an initialized Controls overlay.
func NewOverlay() *Overlay {
	return &Overlay{
		chipsList: layout.List{Axis: layout.Horizontal},
	}
}

// Layout renders the bottom floating controls card.
func (o *Overlay) Layout(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	o.handleEvents(gtx, state)

	return layout.Stack{}.Layout(gtx,
		// Sizing anchor: establish full screen constraints
		layout.Stacked(func(gtx layout.Context) layout.Dimensions {
			return layout.Dimensions{Size: gtx.Constraints.Max}
		}),

		// Bottom Floating Controls Card (pinned to bottom of the screen!)
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			return layout.S.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Inset{
					Bottom: unit.Dp(20),
					Left:   unit.Dp(16),
					Right:  unit.Dp(16),
				}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					return o.layoutControlsCard(gtx, th, state)
				})
			})
		}),
	)
}

func (o *Overlay) handleEvents(gtx layout.Context, state *appstate.AppState) {
	if o.btnFolders.Clicked(gtx) {
		state.TouchActivity()
		if o.OnOpenDrawer != nil {
			o.OnOpenDrawer()
		}
	}

	if o.btnPlayPause.Clicked(gtx) {
		state.TogglePlayPause()
		if o.OnPlayPause != nil {
			o.OnPlayPause()
		}
	}

	if o.btnRewind10.Clicked(gtx) {
		state.TouchActivity()
		if state.Position > 10*time.Second {
			state.Position -= 10 * time.Second
		} else {
			state.Position = 0
		}
		if o.OnSeek != nil {
			o.OnSeek(state.Position)
		}
	}

	if o.btnForward10.Clicked(gtx) {
		state.TouchActivity()
		state.Position += 10 * time.Second
		if o.OnSeek != nil {
			o.OnSeek(state.Position)
		}
	}

	if o.btnAccordion.Clicked(gtx) {
		state.TouchActivity()
		state.ControlsExpanded = !state.ControlsExpanded
	}

	if o.btnVolume.Clicked(gtx) {
		state.TouchActivity()
		state.IsMuted = !state.IsMuted
	}

	if o.btnSpeed.Clicked(gtx) {
		state.TouchActivity()
		switch state.PlaybackSpeed {
		case 1.0:
			state.PlaybackSpeed = 1.25
		case 1.25:
			state.PlaybackSpeed = 1.5
		case 1.5:
			state.PlaybackSpeed = 2.0
		case 2.0:
			state.PlaybackSpeed = 0.5
		case 0.5:
			state.PlaybackSpeed = 0.75
		default:
			state.PlaybackSpeed = 1.0
		}
	}

	if o.btnViewMode.Clicked(gtx) {
		state.TouchActivity()
		switch state.ViewMode {
		case appstate.ViewMode360:
			state.ViewMode = appstate.ViewMode180
		case appstate.ViewMode180:
			state.ViewMode = appstate.ViewModeFlat
		default:
			state.ViewMode = appstate.ViewMode360
		}
	}

	if o.btnRecenter.Clicked(gtx) {
		state.TouchActivity()
		state.Yaw = 0
		state.Pitch = 0
		if o.OnRecenter != nil {
			o.OnRecenter()
		}
	}

	if o.btnSBS.Clicked(gtx) {
		state.TouchActivity()
		if state.StereoMode == appstate.StereoNone {
			state.StereoMode = appstate.StereoHorizontal
		} else {
			state.StereoMode = appstate.StereoNone
		}
	}

	if o.btnSBSFormat.Clicked(gtx) {
		state.TouchActivity()
		if state.StereoMode == appstate.StereoHorizontal {
			state.StereoMode = appstate.StereoVertical
		} else {
			state.StereoMode = appstate.StereoHorizontal
		}
	}

	if o.btnSwapEyes.Clicked(gtx) {
		state.TouchActivity()
		state.InvertStereo = !state.InvertStereo
	}

	if o.btnGyro.Clicked(gtx) {
		state.TouchActivity()
		state.GyroEnabled = !state.GyroEnabled
	}

	if o.btnLock.Clicked(gtx) {
		state.SetLocked(true)
	}

	// Scrubber handling
	if o.scrubber.Update(gtx) {
		state.TouchActivity()
		if state.Duration > 0 {
			target := time.Duration(float64(state.Duration) * float64(o.scrubber.Value))
			state.Position = target
			if o.OnSeek != nil {
				o.OnSeek(target)
			}
		}
	} else if state.Duration > 0 && !o.scrubber.Dragging() {
		o.scrubber.Value = float32(float64(state.Position) / float64(state.Duration))
	}
}

func (o *Overlay) layoutControlsCard(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	cardBg := color.NRGBA{R: 12, G: 16, B: 24, A: 235}
	cardBorder := color.NRGBA{R: 255, G: 255, B: 255, A: 35}

	return layout.Background{}.Layout(gtx,
		func(gtx layout.Context) layout.Dimensions {
			sz := gtx.Constraints.Min
			defer clip.RRect{
				Rect: image.Rectangle{Max: sz},
				NE:   14, NW: 14, SE: 14, SW: 14,
			}.Push(gtx.Ops).Pop()
			paint.Fill(gtx.Ops, cardBorder)
			return layout.Dimensions{Size: sz}
		},
		func(gtx layout.Context) layout.Dimensions {
			return layout.UniformInset(unit.Dp(1)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Background{}.Layout(gtx,
					func(gtx layout.Context) layout.Dimensions {
						sz := gtx.Constraints.Min
						defer clip.RRect{
							Rect: image.Rectangle{Max: sz},
							NE:   13, NW: 13, SE: 13, SW: 13,
						}.Push(gtx.Ops).Pop()
						paint.Fill(gtx.Ops, cardBg)
						return layout.Dimensions{Size: sz}
					},
					func(gtx layout.Context) layout.Dimensions {
						return layout.UniformInset(unit.Dp(10)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
								// Compact Transport Row (always visible)
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									return o.layoutCompactRow(gtx, th, state)
								}),
								// Accordion Expanded Content
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									if state.ControlsExpanded {
										return o.layoutExpandedContent(gtx, th, state)
									}
									return layout.Dimensions{}
								}),
							)
						})
					},
				)
			})
		},
	)
}

func (o *Overlay) layoutCompactRow(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	playIcon := AppIcons.Play
	playBg := ColorPrimary
	if state.IsPlaying {
		playIcon = AppIcons.Pause
		playBg = ColorPrimaryHover
	}

	posStr := formatDuration(state.Position)
	durStr := formatDuration(state.Duration)

	chevronIcon := AppIcons.ExpandMore
	if state.ControlsExpanded {
		chevronIcon = AppIcons.ExpandLess
	}

	return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle}.Layout(gtx,
		// 1. Play / Pause Round Button
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			ib := material.IconButton(th, &o.btnPlayPause, playIcon, "Play/Pause")
			ib.Background = playBg
			ib.Color = ColorTextPrimary
			ib.Size = unit.Dp(20)
			ib.Inset = layout.UniformInset(unit.Dp(8))
			return ib.Layout(gtx)
		}),

		// 2. -10s Rewind Button
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				ib := material.IconButton(th, &o.btnRewind10, AppIcons.Replay10, "Rewind 10s")
				ib.Background = color.NRGBA{R: 255, G: 255, B: 255, A: 25}
				ib.Color = ColorTextPrimary
				ib.Size = unit.Dp(18)
				ib.Inset = layout.UniformInset(unit.Dp(6))
				return ib.Layout(gtx)
			})
		}),

		// 3. Current Position Timestamp
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Left: unit.Dp(10)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				lbl := material.Caption(th, posStr)
				lbl.Color = ColorTextPrimary
				return lbl.Layout(gtx)
			})
		}),

		// 4. Progress Scrubber Slider
		layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Left: unit.Dp(10), Right: unit.Dp(10)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				sl := material.Slider(th, &o.scrubber)
				sl.Color = ColorPrimary
				return sl.Layout(gtx)
			})
		}),

		// 5. Total Duration Timestamp
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Right: unit.Dp(10)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				lbl := material.Caption(th, durStr)
				lbl.Color = ColorTextSecondary
				return lbl.Layout(gtx)
			})
		}),

		// 6. +10s Forward Button
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			ib := material.IconButton(th, &o.btnForward10, AppIcons.Forward10, "Forward 10s")
			ib.Background = color.NRGBA{R: 255, G: 255, B: 255, A: 25}
			ib.Color = ColorTextPrimary
			ib.Size = unit.Dp(18)
			ib.Inset = layout.UniformInset(unit.Dp(6))
			return ib.Layout(gtx)
		}),

		// 7. Fullscreen Toggle Button
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				ib := material.IconButton(th, &o.btnFullscreen, AppIcons.Fullscreen, "Fullscreen")
				ib.Background = color.NRGBA{R: 255, G: 255, B: 255, A: 25}
				ib.Color = ColorTextPrimary
				ib.Size = unit.Dp(18)
				ib.Inset = layout.UniformInset(unit.Dp(6))
				return ib.Layout(gtx)
			})
		}),

		// 8. Accordion Expand/Collapse Chevron Button
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				ib := material.IconButton(th, &o.btnAccordion, chevronIcon, "Toggle Tools")
				ib.Background = color.NRGBA{R: 255, G: 255, B: 255, A: 25}
				ib.Color = ColorTextPrimary
				ib.Size = unit.Dp(18)
				ib.Inset = layout.UniformInset(unit.Dp(6))
				return ib.Layout(gtx)
			})
		}),
	)
}

func (o *Overlay) layoutExpandedContent(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	title := "VR Player"
	if state.CurrentVideo != nil && state.CurrentVideo.Title != "" {
		title = state.CurrentVideo.Title
	}

	return layout.Inset{Top: unit.Dp(10)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
			// Video Title Header
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return layout.Inset{Bottom: unit.Dp(8), Left: unit.Dp(4)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					lbl := material.Body2(th, title)
					lbl.Color = ColorTextPrimary
					return lbl.Layout(gtx)
				})
			}),

			// Horizontal Scrollable Strip of Action Chips (matching Controls.vue)
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				chips := []layout.Widget{
					func(gtx layout.Context) layout.Dimensions {
						volIcon := AppIcons.VolumeUp
						if state.IsMuted {
							volIcon = AppIcons.VolumeOff
						}
						ib := material.IconButton(th, &o.btnVolume, volIcon, "Volume")
						ib.Background = color.NRGBA{R: 255, G: 255, B: 255, A: 25}
						ib.Color = ColorTextPrimary
						ib.Size = unit.Dp(16)
						ib.Inset = layout.UniformInset(unit.Dp(6))
						return ib.Layout(gtx)
					},
					func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return o.layoutChip(gtx, th, &o.btnSpeed, fmt.Sprintf("%.2gx", state.PlaybackSpeed), false)
						})
					},
					func(gtx layout.Context) layout.Dimensions {
						modeStr := "360°"
						if state.ViewMode == appstate.ViewMode180 {
							modeStr = "180°"
						} else if state.ViewMode == appstate.ViewModeFlat {
							modeStr = "Flat"
						}
						return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return o.layoutChip(gtx, th, &o.btnViewMode, modeStr, true)
						})
					},
					func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							ib := material.IconButton(th, &o.btnRecenter, AppIcons.Recenter, "Recenter View")
							ib.Background = color.NRGBA{R: 255, G: 255, B: 255, A: 25}
							ib.Color = ColorTextPrimary
							ib.Size = unit.Dp(16)
							ib.Inset = layout.UniformInset(unit.Dp(6))
							return ib.Layout(gtx)
						})
					},
					func(gtx layout.Context) layout.Dimensions {
						isSBSActive := state.StereoMode != appstate.StereoNone
						sbsText := "SBS: OFF"
						if isSBSActive {
							sbsText = "SBS: ON"
						}
						return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return o.layoutChip(gtx, th, &o.btnSBS, sbsText, isSBSActive)
						})
					},
				}

				if state.StereoMode != appstate.StereoNone {
					chips = append(chips, func(gtx layout.Context) layout.Dimensions {
						formatText := "SBS: H"
						if state.StereoMode == appstate.StereoVertical {
							formatText = "SBS: V"
						}
						return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return o.layoutChip(gtx, th, &o.btnSBSFormat, formatText, false)
						})
					})

					chips = append(chips, func(gtx layout.Context) layout.Dimensions {
						swapText := "Eye: L"
						if state.InvertStereo {
							swapText = "Eye: Swapped"
						}
						return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return o.layoutChip(gtx, th, &o.btnSwapEyes, swapText, state.InvertStereo)
						})
					})
				}

				chips = append(chips, func(gtx layout.Context) layout.Dimensions {
					gyroText := "Gyro: OFF"
					if state.GyroEnabled {
						gyroText = "Gyro: ON"
					}
					return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
						return o.layoutChip(gtx, th, &o.btnGyro, gyroText, state.GyroEnabled)
					})
				})

				chips = append(chips, func(gtx layout.Context) layout.Dimensions {
					return layout.Inset{Left: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
						ib := material.IconButton(th, &o.btnLock, AppIcons.Lock, "Lock Screen")
						ib.Background = color.NRGBA{R: 255, G: 255, B: 255, A: 25}
						ib.Color = ColorTextPrimary
						ib.Size = unit.Dp(16)
						ib.Inset = layout.UniformInset(unit.Dp(6))
						return ib.Layout(gtx)
					})
				})

				return o.chipsList.Layout(gtx, len(chips), func(gtx layout.Context, index int) layout.Dimensions {
					return chips[index](gtx)
				})
			}),
		)
	})
}

func (o *Overlay) layoutChip(gtx layout.Context, th *material.Theme, btn *widget.Clickable, text string, active bool) layout.Dimensions {
	bg := color.NRGBA{R: 255, G: 255, B: 255, A: 25}
	fg := ColorTextPrimary
	if active {
		bg = ColorPrimary
	}

	return material.Clickable(gtx, btn, func(gtx layout.Context) layout.Dimensions {
		return layout.Background{}.Layout(gtx,
			func(gtx layout.Context) layout.Dimensions {
				sz := gtx.Constraints.Min
				defer clip.RRect{
					Rect: image.Rectangle{Max: sz},
					NE:   6, NW: 6, SE: 6, SW: 6,
				}.Push(gtx.Ops).Pop()
				paint.Fill(gtx.Ops, bg)
				return layout.Dimensions{Size: sz}
			},
			func(gtx layout.Context) layout.Dimensions {
				return layout.Inset{
					Top:    unit.Dp(6),
					Bottom: unit.Dp(6),
					Left:   unit.Dp(10),
					Right:  unit.Dp(10),
				}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					lbl := material.Caption(th, text)
					lbl.Color = fg
					return lbl.Layout(gtx)
				})
			},
		)
	})
}

func formatDuration(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	s := int(d.Seconds())
	mins := s / 60
	secs := s % 60
	return fmt.Sprintf("%02d:%02d", mins, secs)
}
