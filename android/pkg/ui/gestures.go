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
	dragStartPos     [2]float32
	lastDragPos      [2]float32
	dragStartTime    time.Time
	lastDragTime     time.Time
	isDragging       bool
	dragZone         string // "left", "right", "center"
	lastTapTime      time.Time
	lastTapPos       [2]float32
	tapCount         int

	// Callbacks wired to Player backend
	OnSeek          func(target time.Duration)
	OnVolume        func(volume float32)
	OnPlaybackSpeed func(speed float32)

	// Long press 2x speed preview
	isLongPressing   bool
	prevSpeed        float32

	// VR Drag Inertia
	inertiaVX        float32
	inertiaVY        float32

	// Multi-touch pinch tracking
	activeTouches    map[pointer.ID][2]float32
	initialPinchDist float32
	initialFOV       float32
}

// NewGestureHandler creates an initialized gesture recognizer.
func NewGestureHandler() *GestureHandler {
	return &GestureHandler{
		activeTouches: make(map[pointer.ID][2]float32),
	}
}

// IsSeeking returns true if user is scrubbing the timeline via horizontal drag.
func (gh *GestureHandler) IsSeeking() bool {
	return gh.isDragging && gh.dragZone == "center"
}

// Layout registers the pointer input operation and processes gestures.
func (gh *GestureHandler) Layout(gtx layout.Context, state *appstate.AppState) layout.Dimensions {
	defer clip.Rect{Max: gtx.Constraints.Max}.Push(gtx.Ops).Pop()

	// Register pointer listener for gestures
	event.Op(gtx.Ops, gh)

	width := float32(gtx.Constraints.Max.X)
	height := float32(gtx.Constraints.Max.Y)

	// Apply damped VR camera inertia when finger is lifted
	if !gh.isDragging && (math.Abs(float64(gh.inertiaVX)) > 0.0001 || math.Abs(float64(gh.inertiaVY)) > 0.0001) {
		state.Yaw -= gh.inertiaVX
		state.Pitch -= gh.inertiaVY
		maxPitch := float32(85.0 * math.Pi / 180.0)
		if state.Pitch > maxPitch {
			state.Pitch = maxPitch
		} else if state.Pitch < -maxPitch {
			state.Pitch = -maxPitch
		}
		gh.inertiaVX *= 0.92
		gh.inertiaVY *= 0.92
		gtx.Execute(op.InvalidateCmd{})
	}

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
				gh.dragStartTime = time.Now()
				gh.lastDragTime = gh.dragStartTime
				gh.isDragging = true
				gh.inertiaVX = 0
				gh.inertiaVY = 0

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
					if gh.OnVolume != nil {
						gh.OnVolume(state.Volume)
					}
					gtx.Execute(op.InvalidateCmd{})

				case "center":
					// In VR mode: Single-finger drag pans/tilts the 360 camera!
					if state.ViewMode == appstate.ViewMode360 || state.ViewMode == appstate.ViewMode180 || state.ViewMode == appstate.ViewModeCurved {
						// Sensitivity scaling: ~1.5 radians per screen width
						sensitivity := float32(1.8) / width
						state.Yaw -= deltaX * sensitivity
						state.Pitch -= deltaY * sensitivity

						// Track inertia velocity
						now := time.Now()
						dt := float32(now.Sub(gh.lastDragTime).Seconds())
						if dt > 0.001 {
							gh.inertiaVX = (deltaX * sensitivity) / (dt * 60.0)
							gh.inertiaVY = (deltaY * sensitivity) / (dt * 60.0)
							gh.lastDragTime = now
						}

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

					// Long-press 2x speed preview detection in center zone
					totalMove := float32(math.Hypot(float64(pe.Position.X-gh.dragStartPos[0]), float64(pe.Position.Y-gh.dragStartPos[1])))
					if totalMove < 25.0 && time.Since(gh.dragStartTime) > 400*time.Millisecond && !gh.isLongPressing {
						gh.isLongPressing = true
						gh.prevSpeed = state.PlaybackSpeed
						state.PlaybackSpeed = 2.0
						if gh.OnPlaybackSpeed != nil {
							gh.OnPlaybackSpeed(2.0)
						}
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

				// Reset long-press speed if active
				if gh.isLongPressing {
					gh.isLongPressing = false
					state.PlaybackSpeed = gh.prevSpeed
					if gh.OnPlaybackSpeed != nil {
						gh.OnPlaybackSpeed(gh.prevSpeed)
					}
					gtx.Execute(op.InvalidateCmd{})
				}

				// Apply scrub seek from 2D flat mode horizontal drag
				if state.ShowSeekHUD && state.SeekDeltaSeconds != 0 {
					targetSec := state.Position.Seconds() + state.SeekDeltaSeconds
					if targetSec < 0 {
						targetSec = 0
					}
					target := time.Duration(targetSec * float64(time.Second))
					if state.Duration > 0 && target > state.Duration {
						target = state.Duration
					}
					state.Position = target
					state.SeekDeltaSeconds = 0
					state.ShowSeekHUD = false
					if gh.OnSeek != nil {
						gh.OnSeek(target)
					}
					gtx.Execute(op.InvalidateCmd{})
				} else {
					state.ShowSeekHUD = false
				}

				// Check tap vs drag distance
				totalDist := float32(math.Hypot(float64(pe.Position.X-gh.dragStartPos[0]), float64(pe.Position.Y-gh.dragStartPos[1])))
				if totalDist < 15.0 {
					gh.handleTap(gtx, pe.Position.X, width, state)
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

func (gh *GestureHandler) handleTap(gtx layout.Context, tapX, screenWidth float32, state *appstate.AppState) {
	state.TouchActivity()
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
			if gh.OnSeek != nil {
				gh.OnSeek(state.Position)
			}
		} else if tapX > screenWidth*0.80 {
			// Double tap right 20%: +10s seek
			state.Position += 10 * time.Second
			if state.Duration > 0 && state.Position > state.Duration {
				state.Position = state.Duration
			}
			if gh.OnSeek != nil {
				gh.OnSeek(state.Position)
			}
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
	gtx.Execute(op.InvalidateCmd{})
}
