package ui

import (
	"image"

	"gioui.org/layout"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/unit"
	"gioui.org/widget"
	"gioui.org/widget/material"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// VRBar manages the floating VR projection and stereoscopic format quick-switcher.
type VRBar struct {
	btn360     widget.Clickable
	btn180     widget.Clickable
	btnFlat    widget.Clickable
	btnSBSH    widget.Clickable
	btnSBSV    widget.Clickable
	btnInvert  widget.Clickable
	btnRecenter widget.Clickable
	OnRecenter func()
}

// NewVRBar creates an initialized VR quick bar.
func NewVRBar() *VRBar {
	return &VRBar{}
}

// Layout renders the floating quick-action bar above the scrubber.
func (vb *VRBar) Layout(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	// Handle button clicks
	if vb.btn360.Clicked(gtx) {
		state.TouchActivity()
		state.ViewMode = appstate.ViewMode360
	}
	if vb.btn180.Clicked(gtx) {
		state.TouchActivity()
		state.ViewMode = appstate.ViewMode180
	}
	if vb.btnFlat.Clicked(gtx) {
		state.TouchActivity()
		state.ViewMode = appstate.ViewModeFlat
	}
	if vb.btnSBSH.Clicked(gtx) {
		state.TouchActivity()
		if state.StereoMode == appstate.StereoHorizontal {
			state.StereoMode = appstate.StereoNone
		} else {
			state.StereoMode = appstate.StereoHorizontal
		}
	}
	if vb.btnSBSV.Clicked(gtx) {
		state.TouchActivity()
		if state.StereoMode == appstate.StereoVertical {
			state.StereoMode = appstate.StereoNone
		} else {
			state.StereoMode = appstate.StereoVertical
		}
	}
	if vb.btnInvert.Clicked(gtx) {
		state.TouchActivity()
		state.InvertStereo = !state.InvertStereo
	}
	if vb.btnRecenter.Clicked(gtx) {
		state.TouchActivity()
		state.Yaw = 0
		state.Pitch = 0
		if vb.OnRecenter != nil {
			vb.OnRecenter()
		}
	}

	return layout.Inset{Bottom: unit.Dp(8)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle}.Layout(gtx,
			// Mode 360
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return vb.layoutChip(gtx, th, &vb.btn360, "360 Sphere", state.ViewMode == appstate.ViewMode360)
			}),
			// Mode 180
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return vb.layoutChip(gtx, th, &vb.btn180, "180 Dome", state.ViewMode == appstate.ViewMode180)
			}),
			// Mode Flat
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return vb.layoutChip(gtx, th, &vb.btnFlat, "2D Flat", state.ViewMode == appstate.ViewModeFlat)
			}),
			// Spacer
			layout.Rigid(layout.Spacer{Width: unit.Dp(8)}.Layout),
			// SBS Horizontal
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return vb.layoutChip(gtx, th, &vb.btnSBSH, "SBS (H)", state.StereoMode == appstate.StereoHorizontal)
			}),
			// Invert Eyes
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return vb.layoutChip(gtx, th, &vb.btnInvert, "Swap Eyes", state.InvertStereo)
			}),
			// Recenter Button
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return vb.layoutChip(gtx, th, &vb.btnRecenter, "Recenter", false)
			}),
		)
	})
}

func (vb *VRBar) layoutChip(gtx layout.Context, th *material.Theme, btn *widget.Clickable, label string, active bool) layout.Dimensions {
	bgColor := ColorSurfaceLight
	textColor := ColorTextSecondary
	if active {
		bgColor = ColorPrimary
		textColor = ColorTextPrimary
	}

	return layout.Inset{Right: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return material.Clickable(gtx, btn, func(gtx layout.Context) layout.Dimensions {
			return layout.Background{}.Layout(gtx,
				func(gtx layout.Context) layout.Dimensions {
					defer clip.RRect{
						Rect: image.Rectangle{Max: gtx.Constraints.Min},
						NE:   6, NW: 6, SE: 6, SW: 6,
					}.Push(gtx.Ops).Pop()
					paint.Fill(gtx.Ops, bgColor)
					return layout.Dimensions{Size: gtx.Constraints.Min}
				},
				func(gtx layout.Context) layout.Dimensions {
					return layout.Inset{
						Top:    unit.Dp(6),
						Bottom: unit.Dp(6),
						Left:   unit.Dp(10),
						Right:  unit.Dp(10),
					}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
						lbl := material.Caption(th, label)
						lbl.Color = textColor
						return lbl.Layout(gtx)
					})
				},
			)
		})
	})
}
