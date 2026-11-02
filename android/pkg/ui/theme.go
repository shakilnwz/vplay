package ui

import (
	"image/color"

	"gioui.org/widget/material"
)

// Theme colors adhering to the cinema-dark palette.
var (
	ColorBackground     = color.NRGBA{R: 10, G: 12, B: 18, A: 255}   // Deep cinema dark
	ColorSurface        = color.NRGBA{R: 20, G: 24, B: 36, A: 240}   // Translucent scrim
	ColorSurfaceLight   = color.NRGBA{R: 32, G: 38, B: 56, A: 255}   // Lighter card/button background
	ColorPrimary        = color.NRGBA{R: 59, G: 130, B: 246, A: 255} // Vibrant blue #3B82F6
	ColorPrimaryHover   = color.NRGBA{R: 37, G: 99, B: 235, A: 255}  // Blue #2563EB
	ColorAccentOrange   = color.NRGBA{R: 245, G: 158, B: 11, A: 255} // MX Player volume boost amber
	ColorTextPrimary    = color.NRGBA{R: 248, G: 250, B: 252, A: 255} // Clean white text
	ColorTextSecondary  = color.NRGBA{R: 148, G: 163, B: 184, A: 255} // Muted gray text
	ColorScrubberBuffer = color.NRGBA{R: 71, G: 85, B: 105, A: 180}  // Buffered range
	ColorScrubberTrack  = color.NRGBA{R: 30, G: 41, B: 59, A: 200}   // Unbuffered track
	ColorLockActive     = color.NRGBA{R: 239, G: 68, B: 68, A: 255}  // Red lock accent
	ColorHUDOverlay     = color.NRGBA{R: 0, G: 0, B: 0, A: 190}      // Semi-black HUD backdrop
)

// NewTheme creates a customized Gio Material theme styled for the cinema player.
func NewTheme() *material.Theme {
	th := material.NewTheme()
	th.Bg = ColorBackground
	th.Fg = ColorTextPrimary
	th.Palette.Bg = ColorBackground
	th.Palette.Fg = ColorTextPrimary
	th.Palette.ContrastBg = ColorPrimary
	th.Palette.ContrastFg = ColorTextPrimary
	return th
}
