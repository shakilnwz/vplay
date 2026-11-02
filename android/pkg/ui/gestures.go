package ui

import (
	"math"
	"time"

	"gioui.org/io/event"
	"gioui.org/io/pointer"
	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
)

// GestureHandler manages MX Player multi-touch gesture disambiguation.
type GestureHandler struct {
	dragStartPos   [2]float32
	lastDragPos    [2]float32
	isDragging     bool
	dragZone       string // "left", "right", "center"
	lastTapTime    time.Time
	lastTapPos     [2]float32
	tapCount       int

	// Multi-touch pinch tracking
	activeTouches  map[pointer.ID][2]float32
	initialPinchDist float32
	initialFOV     float32
}

// NewGestureHandler creates an initialized gesture recognizer.
func NewGestureHandler() *GestureHandler {
	return &GestureHandler{
		activeTouches: make(map[pointer.ID][2]float32),
	}
}

// Layout registers the pointer input operation and processes gestures.
func (gh *GestureHandler) Layout(gtx layout.Context, state *appstate.AppState) layout.Dimensions {
	defer clip.Rect{Max: gtx.Constraints.Max}.Push(gtx.Ops).Pop()

	// Register pointer listener for gestures
	event.Op(gtx.Ops, gh)

	width := float32(gtx.Constraints.Max.X)
	height := float32(gtx.Constraints.Max.Y)

	for {
		ev, ok := gtx.Event(pointer.Filter{
			Target: gh,
			Kinds:  pointer.Press | pointer.Drag | pointer.Release | pointer.Cancel,
		})
		if !ok {
			break
		}

		pe, ok := ev.(pointer.Event)
		if !ok {
			continue
		}

		switch pe.Kind {
		case pointer.Press:
			state.TouchActivity()
			gh.activeTouches[pe.PointerID] = [2]float32{pe.Position.X, pe.Position.Y}

			// Handle multi-touch pinch start
			if len(gh.activeTouches) == 2 {
				gh.initialPinchDist = gh.computePinchDistance()
				gh.initialFOV = state.CameraFOV
				continue
			}

			if len(gh.activeTouches) == 1 {
				gh.dragStartPos = [2]float32{pe.Position.X, pe.Position.Y}
				gh.lastDragPos = gh.dragStartPos
				gh.isDragging = true

				// Disambiguate screen zone: Left 15% (Brightness), Right 15% (Volume), Center 70%
				if pe.Position.X < width*0.15 {
					gh.dragZone = "left"
				} else if pe.Position.X > width*0.85 {
					gh.dragZone = "right"
				} else {
					gh.dragZone = "center"
				}
			}

		case pointer.Drag:
			state.TouchActivity()
			gh.activeTouches[pe.PointerID] = [2]float32{pe.Position.X, pe.Position.Y}

			// Two-finger pinch: FOV zoom in VR or scale in 2D
			if len(gh.activeTouches) == 2 && gh.initialPinchDist > 0 {
				currentDist := gh.computePinchDistance()
				ratio := currentDist / gh.initialPinchDist
				newFOV := gh.initialFOV / ratio
				if newFOV < 45.0 {
					newFOV = 45.0
				} else if newFOV > 110.0 {
					newFOV = 110.0
				}
				state.CameraFOV = newFOV
				gtx.Execute(op.InvalidateCmd{})
				continue
			}

			// Single-finger drag handling
			if gh.isDragging && len(gh.activeTouches) == 1 {
				deltaX := pe.Position.X - gh.lastDragPos[0]
				deltaY := pe.Position.Y - gh.lastDragPos[1]
				gh.lastDragPos = [2]float32{pe.Position.X, pe.Position.Y}

				switch gh.dragZone {
				case "left":
					// Left Edge Vertical Swipe: Brightness HUD
					state.ShowBrightnessHUD = true
					state.Brightness -= deltaY / height
					if state.Brightness < 0.0 {
						state.Brightness = 0.0
					} else if state.Brightness > 1.0 {
						state.Brightness = 1.0
					}
					gtx.Execute(op.InvalidateCmd{})

				case "right":
					// Right Edge Vertical Swipe: Volume HUD (with 200% boost)
					state.ShowVolumeHUD = true
					state.Volume -= (deltaY / height) * 2.0
					if state.Volume < 0.0 {
						state.Volume = 0.0
					} else if state.Volume > 2.0 {
						state.Volume = 2.0
					}
					gtx.Execute(op.InvalidateCmd{})

				case "center":
					// In VR mode: Single-finger drag pans/tilts the 360 camera!
					if state.ViewMode == appstate.ViewMode360 || state.ViewMode == appstate.ViewMode180 {
						// Sensitivity scaling: ~1.5 radians per screen width
						sensitivity := float32(1.8) / width
						state.Yaw += deltaX * sensitivity
						state.Pitch += deltaY * sensitivity

						// Clamp vertical pitch to avoid gimbal lock (-85 deg to +85 deg)
						maxPitch := float32(85.0 * math.Pi / 180.0)
						if state.Pitch > maxPitch {
							state.Pitch = maxPitch
						} else if state.Pitch < -maxPitch {
							state.Pitch = -maxPitch
						}
						gtx.Execute(op.InvalidateCmd{})
					} else {
						// Flat 2D Mode: Horizontal drag scrubs timeline preview
						state.ShowSeekHUD = true
						state.SeekDeltaSeconds += float64(deltaX) * 0.1
						gtx.Execute(op.InvalidateCmd{})
					}
				}
			}

		case pointer.Release, pointer.Cancel:
			delete(gh.activeTouches, pe.PointerID)
			if len(gh.activeTouches) == 0 {
				gh.isDragging = false
				state.ShowBrightnessHUD = false
				state.ShowVolumeHUD = false
				state.ShowSeekHUD = false

				// Check tap vs drag distance
				totalDist := float32(math.Hypot(float64(pe.Position.X-gh.dragStartPos[0]), float64(pe.Position.Y-gh.dragStartPos[1])))
				if totalDist < 15.0 {
					gh.handleTap(pe.Position.X, width, state)
				}
			}
		}
	}

	return layout.Dimensions{Size: gtx.Constraints.Max}
}

func (gh *GestureHandler) computePinchDistance() float32 {
	var points [][2]float32
	for _, p := range gh.activeTouches {
		points = append(points, p)
	}
	if len(points) < 2 {
		return 0
	}
	dx := points[0][0] - points[1][0]
	dy := points[0][1] - points[1][1]
	return float32(math.Hypot(float64(dx), float64(dy)))
}

func (gh *GestureHandler) handleTap(tapX, screenWidth float32, state *appstate.AppState) {
	now := time.Now()
	if now.Sub(gh.lastTapTime) < 320*time.Millisecond {
		// Double tap detected!
		if tapX < screenWidth*0.20 {
			// Double tap left 20%: -10s seek
			if state.Position > 10*time.Second {
				state.Position -= 10 * time.Second
			} else {
				state.Position = 0
			}
		} else if tapX > screenWidth*0.80 {
			// Double tap right 20%: +10s seek
			state.Position += 10 * time.Second
		} else {
			// Double tap center: Play/Pause
			state.TogglePlayPause()
		}
		gh.tapCount = 0
	} else {
		// Single tap: toggle OSD controls visibility
		gh.tapCount = 1
		state.ControlsVisible = !state.ControlsVisible
	}
	gh.lastTapTime = now
}
