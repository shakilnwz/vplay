package ui

import (
	"fmt"
	"image"
	"time"

	"gioui.org/layout"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/unit"
	"gioui.org/widget"
	"gioui.org/widget/material"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// Overlay manages the full MX Player on-screen display.
type Overlay struct {
	// Top Bar
	btnBack     widget.Clickable
	btnDecoder  widget.Clickable
	btnAudio    widget.Clickable
	btnSub      widget.Clickable
	btnLock     widget.Clickable
	btnSettings widget.Clickable

	// Settings modal
	showSettingsModal bool
	btnCloseSettings  widget.Clickable

	// Transport
	btnPlayPause widget.Clickable
	btnRewind10  widget.Clickable
	btnForward10 widget.Clickable
	btnPrev      widget.Clickable
	btnNext      widget.Clickable

	// Utility
	btnFolders    widget.Clickable
	btnSpeed      widget.Clickable
	btnAspect     widget.Clickable
	btnFullscreen widget.Clickable

	// Interactive Scrubber
	scrubber     widget.Float
	isScrubbing  bool
	VRBar        *VRBar

	// Callbacks
	OnBack       func()
	OnPlayPause  func()
	OnSeek       func(target time.Duration)
	OnPrev       func()
	OnNext       func()
	OnOpenDrawer func()
}

// NewOverlay creates an initialized MX Player OSD.
func NewOverlay() *Overlay {
	return &Overlay{
		VRBar: NewVRBar(),
	}
}

// Layout renders the top bar, floating VR quick-bar, tactile scrubber, transport, and utility bar.
func (o *Overlay) Layout(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	o.handleEvents(gtx, state)

	return layout.Stack{}.Layout(gtx,
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			return layout.Flex{Axis: layout.Vertical, Spacing: layout.SpaceBetween}.Layout(gtx,
				// 1. Top Bar
				layout.Rigid(func(gtx layout.Context) layout.Dimensions {
					return o.layoutTopBar(gtx, th, state)
				}),
				// 2. Middle Spacer
				layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
					return layout.Dimensions{}
				}),
				// 3. Bottom Controls Container
				layout.Rigid(func(gtx layout.Context) layout.Dimensions {
					return o.layoutBottomContainer(gtx, th, state)
				}),
			)
		}),
		layout.Stacked(func(gtx layout.Context) layout.Dimensions {
			if o.showSettingsModal {
				return o.layoutSettingsModal(gtx, th, state)
			}
			return layout.Dimensions{}
		}),
	)
}

func (o *Overlay) handleEvents(gtx layout.Context, state *appstate.AppState) {
	if o.btnBack.Clicked(gtx) {
		state.TouchActivity()
		if o.OnBack != nil {
			o.OnBack()
		}
	}
	if o.btnLock.Clicked(gtx) {
		state.SetLocked(true)
	}
	if o.btnAudio.Clicked(gtx) {
		state.TouchActivity()
		state.IsMuted = !state.IsMuted
	}
	if o.btnSub.Clicked(gtx) {
		state.TouchActivity()
	}
	if o.btnSettings.Clicked(gtx) {
		state.TouchActivity()
		o.showSettingsModal = !o.showSettingsModal
	}
	if o.btnCloseSettings.Clicked(gtx) {
		state.TouchActivity()
		o.showSettingsModal = false
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
	if o.btnPrev.Clicked(gtx) {
		state.TouchActivity()
		if o.OnPrev != nil {
			o.OnPrev()
		}
	}
	if o.btnNext.Clicked(gtx) {
		state.TouchActivity()
		if o.OnNext != nil {
			o.OnNext()
		}
	}
	if o.btnFolders.Clicked(gtx) {
		state.TouchActivity()
		if o.OnOpenDrawer != nil {
			o.OnOpenDrawer()
		}
	}
	if o.btnDecoder.Clicked(gtx) {
		state.TouchActivity()
		if state.DecoderType == "HW" {
			state.DecoderType = "SW"
		} else {
			state.DecoderType = "HW"
		}
	}
	if o.btnAspect.Clicked(gtx) {
		state.TouchActivity()
		switch state.AspectRatio {
		case appstate.AspectFit:
			state.AspectRatio = appstate.AspectCrop
		case appstate.AspectCrop:
			state.AspectRatio = appstate.AspectStretch
		case appstate.AspectStretch:
			state.AspectRatio = appstate.Aspect100
		default:
			state.AspectRatio = appstate.AspectFit
		}
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
		default:
			state.PlaybackSpeed = 1.0
		}
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

func (o *Overlay) layoutTopBar(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	return layout.Background{}.Layout(gtx,
		func(gtx layout.Context) layout.Dimensions {
			sz := image.Point{X: gtx.Constraints.Max.X, Y: gtx.Constraints.Min.Y}
			defer clip.Rect{Max: sz}.Push(gtx.Ops).Pop()
			paint.Fill(gtx.Ops, ColorSurface)
			return layout.Dimensions{Size: sz}
		},
		func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{
				Top:    unit.Dp(14),
				Bottom: unit.Dp(14),
				Left:   unit.Dp(20),
				Right:  unit.Dp(20),
			}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle}.Layout(gtx,
					// Back Button
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return material.Clickable(gtx, &o.btnBack, func(gtx layout.Context) layout.Dimensions {
							lbl := material.Body1(th, "< Back")
							lbl.Color = ColorPrimary
							return lbl.Layout(gtx)
						})
					}),
					// Marquee Title
					layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(16), Right: unit.Dp(16)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							title := "VR Player"
							if state.CurrentVideo != nil && state.CurrentVideo.Title != "" {
								title = state.CurrentVideo.Title
							}
							lbl := material.Body1(th, title)
							lbl.Color = ColorTextPrimary
							return lbl.Layout(gtx)
						})
					}),
					// Open File / Library button on top bar
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Right: unit.Dp(8)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return material.Clickable(gtx, &o.btnFolders, func(gtx layout.Context) layout.Dimensions {
								lbl := material.Body2(th, "[OPEN FILE]")
								lbl.Color = ColorPrimary
								return lbl.Layout(gtx)
							})
						})
					}),
					// HW Decoder Pill
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return material.Clickable(gtx, &o.btnDecoder, func(gtx layout.Context) layout.Dimensions {
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
									return layout.UniformInset(unit.Dp(6)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
										lbl := material.Caption(th, fmt.Sprintf("[%s]", state.DecoderType))
										lbl.Color = ColorPrimary
										return lbl.Layout(gtx)
									})
								},
							)
						})
					}),
					// Audio Track Pill
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(8)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return material.Clickable(gtx, &o.btnAudio, func(gtx layout.Context) layout.Dimensions {
								text := "[Audio]"
								if state.IsMuted {
									text = "[Muted]"
								}
								lbl := material.Caption(th, text)
								lbl.Color = ColorTextSecondary
								return lbl.Layout(gtx)
							})
						})
					}),
					// Subtitle Pill
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(8)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return material.Clickable(gtx, &o.btnSub, func(gtx layout.Context) layout.Dimensions {
								lbl := material.Caption(th, "[Sub]")
								lbl.Color = ColorTextSecondary
								return lbl.Layout(gtx)
							})
						})
					}),
					// Lock Button
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(12)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return material.Clickable(gtx, &o.btnLock, func(gtx layout.Context) layout.Dimensions {
								lbl := material.Caption(th, "[Lock]")
								lbl.Color = ColorTextSecondary
								return lbl.Layout(gtx)
							})
						})
					}),
					// Settings Button
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(12)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return material.Clickable(gtx, &o.btnSettings, func(gtx layout.Context) layout.Dimensions {
								lbl := material.Caption(th, "[Settings]")
								lbl.Color = ColorTextSecondary
								return lbl.Layout(gtx)
							})
						})
					}),
				)
			})
		},
	)
}

func (o *Overlay) layoutBottomContainer(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	return layout.Background{}.Layout(gtx,
		func(gtx layout.Context) layout.Dimensions {
			sz := image.Point{X: gtx.Constraints.Max.X, Y: gtx.Constraints.Min.Y}
			defer clip.Rect{Max: sz}.Push(gtx.Ops).Pop()
			paint.Fill(gtx.Ops, ColorSurface)
			return layout.Dimensions{Size: sz}
		},
		func(gtx layout.Context) layout.Dimensions {
			return layout.UniformInset(unit.Dp(16)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
					// 1. Floating VR Quick-Bar
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return o.VRBar.Layout(gtx, th, state)
					}),
					// 2. Tactile Timeline Scrubber Bar
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return o.layoutScrubber(gtx, th, state)
					}),
					// 3. Central Transport Controls
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return o.layoutTransport(gtx, th, state)
					}),
					// 4. Utility Bar
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return o.layoutUtilityBar(gtx, th, state)
					}),
				)
			})
		},
	)
}

func (o *Overlay) layoutScrubber(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	posStr := formatDuration(state.Position)
	durStr := formatDuration(state.Duration)
	remStr := "-" + formatDuration(state.Duration-state.Position)

	return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle}.Layout(gtx,
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			lbl := material.Caption(th, posStr)
			lbl.Color = ColorTextPrimary
			return lbl.Layout(gtx)
		}),
		layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Left: unit.Dp(12), Right: unit.Dp(12)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				sl := material.Slider(th, &o.scrubber)
				sl.Color = ColorPrimary
				return sl.Layout(gtx)
			})
		}),
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			lbl := material.Caption(th, fmt.Sprintf("%s (%s)", durStr, remStr))
			lbl.Color = ColorTextSecondary
			return lbl.Layout(gtx)
		}),
	)
}

func (o *Overlay) layoutTransport(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	playIcon := "> PLAY"
	if state.IsPlaying {
		playIcon = "|| PAUSE"
	}

	return layout.Inset{Top: unit.Dp(8), Bottom: unit.Dp(8)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle, Spacing: layout.SpaceEvenly}.Layout(gtx,
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return material.Clickable(gtx, &o.btnPrev, func(gtx layout.Context) layout.Dimensions {
					lbl := material.Body1(th, "|<<")
					lbl.Color = ColorTextPrimary
					return lbl.Layout(gtx)
				})
			}),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return material.Clickable(gtx, &o.btnRewind10, func(gtx layout.Context) layout.Dimensions {
					lbl := material.Body1(th, "<< 10s")
					lbl.Color = ColorTextPrimary
					return lbl.Layout(gtx)
				})
			}),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return material.Clickable(gtx, &o.btnPlayPause, func(gtx layout.Context) layout.Dimensions {
					lbl := material.H5(th, playIcon)
					lbl.Color = ColorPrimary
					return lbl.Layout(gtx)
				})
			}),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return material.Clickable(gtx, &o.btnForward10, func(gtx layout.Context) layout.Dimensions {
					lbl := material.Body1(th, "10s >>")
					lbl.Color = ColorTextPrimary
					return lbl.Layout(gtx)
				})
			}),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return material.Clickable(gtx, &o.btnNext, func(gtx layout.Context) layout.Dimensions {
					lbl := material.Body1(th, ">>|")
					lbl.Color = ColorTextPrimary
					return lbl.Layout(gtx)
				})
			}),
		)
	})
}

func (o *Overlay) layoutUtilityBar(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle, Spacing: layout.SpaceBetween}.Layout(gtx,
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return material.Clickable(gtx, &o.btnFolders, func(gtx layout.Context) layout.Dimensions {
				lbl := material.Caption(th, "[ FOLDERS / OPEN FILE ]")
				lbl.Color = ColorPrimary
				return lbl.Layout(gtx)
			})
		}),
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return material.Clickable(gtx, &o.btnSpeed, func(gtx layout.Context) layout.Dimensions {
				lbl := material.Caption(th, fmt.Sprintf("Speed: %.2fx", state.PlaybackSpeed))
				lbl.Color = ColorTextPrimary
				return lbl.Layout(gtx)
			})
		}),
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return material.Clickable(gtx, &o.btnAspect, func(gtx layout.Context) layout.Dimensions {
				lbl := material.Caption(th, fmt.Sprintf("Aspect: %s", state.AspectRatio))
				lbl.Color = ColorTextPrimary
				return lbl.Layout(gtx)
			})
		}),
	)
}

func formatDuration(d time.Duration) string {
	if d < 0 {
		d = 0
	}
	s := int(d.Seconds())
	h := s / 3600
	m := (s % 3600) / 60
	sec := s % 60
	if h > 0 {
		return fmt.Sprintf("%02d:%02d:%02d", h, m, sec)
	}
	return fmt.Sprintf("%02d:%02d", m, sec)
}

func (o *Overlay) layoutSettingsModal(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	return layout.Center.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Background{}.Layout(gtx,
			func(gtx layout.Context) layout.Dimensions {
				defer clip.RRect{
					Rect: image.Rectangle{Max: gtx.Constraints.Min},
					NE:   12, NW: 12, SE: 12, SW: 12,
				}.Push(gtx.Ops).Pop()
				paint.Fill(gtx.Ops, ColorSurface)
				return layout.Dimensions{Size: gtx.Constraints.Min}
			},
			func(gtx layout.Context) layout.Dimensions {
				return layout.UniformInset(unit.Dp(20)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
						// Header: Title and Close button
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle, Spacing: layout.SpaceBetween}.Layout(gtx,
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									lbl := material.H6(th, "Playback Settings")
									lbl.Color = ColorTextPrimary
									return lbl.Layout(gtx)
								}),
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									return material.Clickable(gtx, &o.btnCloseSettings, func(gtx layout.Context) layout.Dimensions {
										lbl := material.Body1(th, "X")
										lbl.Color = ColorTextSecondary
										return lbl.Layout(gtx)
									})
								}),
							)
						}),
						layout.Rigid(layout.Spacer{Height: unit.Dp(16)}.Layout),
						// Decoder setting
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							lbl := material.Body2(th, fmt.Sprintf("Hardware Acceleration: %s Decoder", state.DecoderType))
							lbl.Color = ColorTextSecondary
							return lbl.Layout(gtx)
						}),
						layout.Rigid(layout.Spacer{Height: unit.Dp(8)}.Layout),
						// Aspect ratio setting
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							lbl := material.Body2(th, fmt.Sprintf("Aspect Ratio: %s", state.AspectRatio))
							lbl.Color = ColorTextSecondary
							return lbl.Layout(gtx)
						}),
						layout.Rigid(layout.Spacer{Height: unit.Dp(8)}.Layout),
						// VR Projection setting
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							lbl := material.Body2(th, fmt.Sprintf("Projection: %s | Stereo: %s", state.ViewMode, state.StereoMode))
							lbl.Color = ColorTextSecondary
							return lbl.Layout(gtx)
						}),
						layout.Rigid(layout.Spacer{Height: unit.Dp(8)}.Layout),
						// Audio mute setting
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							muteStr := "Unmuted"
							if state.IsMuted {
								muteStr = "Muted"
							}
							lbl := material.Body2(th, fmt.Sprintf("Audio State: %s (Vol: %d%%)", muteStr, int(state.Volume*100)))
							lbl.Color = ColorTextSecondary
							return lbl.Layout(gtx)
						}),
					)
				})
			},
		)
	})
}
